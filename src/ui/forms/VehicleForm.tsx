import { useMemo, useState } from 'react';
import {
  blendedKWhPrice,
  energyCostPerKm,
  formatNumber,
  parseDecimal,
  parseMoney,
  POWERTRAINS,
  wearCostPerKm,
  type Powertrain,
} from '../../domain';
import type { VehicleData, VehicleEntity } from '../../services/entities';
import { saveVehicle, ValidationError } from '../../services/repositories';
import { NumberField, SelectField, TextField } from '../components/controls';
import { toField } from '../format';
import { POWERTRAIN_LABEL } from '../text';

type NumKey =
  | 'fuelConsumptionLPer100'
  | 'fuelPricePerL'
  | 'evConsumptionKWhPer100'
  | 'homePricePerKWh'
  | 'publicPricePerKWh'
  | 'chargingLossPct'
  | 'batteryKWh'
  | 'tiresSetCost'
  | 'tiresLifetimeKm'
  | 'maintenancePerKm'
  | 'depreciationPerKm'
  | 'otherPerKm';

type Values = { name: string; make: string; model: string; powertrain: Powertrain; homeSharePct: number } & Record<NumKey, string>;

/** Câmpuri care, lăsate goale, înseamnă 0 (nu sunt obligatorii). */
const ZERO_IF_EMPTY: NumKey[] = ['chargingLossPct', 'tiresSetCost', 'tiresLifetimeKm', 'otherPerKm'];

function initialValues(v?: VehicleEntity): Values {
  const get = (k: NumKey) => toField((v as unknown as Record<string, number | null | undefined>)?.[k]);
  return {
    name: v?.name ?? '',
    make: v?.make ?? '',
    model: v?.model ?? '',
    powertrain: v?.powertrain ?? 'electric',
    homeSharePct: v && v.powertrain === 'electric' ? v.homeSharePct : 50,
    fuelConsumptionLPer100: get('fuelConsumptionLPer100'),
    fuelPricePerL: get('fuelPricePerL'),
    evConsumptionKWhPer100: get('evConsumptionKWhPer100'),
    homePricePerKWh: get('homePricePerKWh'),
    publicPricePerKWh: get('publicPricePerKWh'),
    chargingLossPct: get('chargingLossPct'),
    batteryKWh: get('batteryKWh'),
    tiresSetCost: get('tiresSetCost'),
    tiresLifetimeKm: get('tiresLifetimeKm'),
    maintenancePerKm: get('maintenancePerKm'),
    depreciationPerKm: get('depreciationPerKm'),
    otherPerKm: get('otherPerKm'),
  };
}

/** Transformă formularul în date de vehicul; numerele invalide sunt raportate separat. */
function toVehicleData(v: Values): { data: Record<string, unknown>; badNumbers: Partial<Record<NumKey, string>> } {
  const badNumbers: Partial<Record<NumKey, string>> = {};
  const n = (k: NumKey): number | undefined => {
    const raw = v[k].trim();
    if (raw === '') return ZERO_IF_EMPTY.includes(k) ? 0 : undefined;
    // costul setului de anvelope e o sumă în lei: „2.000” înseamnă 2000, nu 2
    const parsed = k === 'tiresSetCost' ? parseMoney(raw) : parseDecimal(raw);
    if (parsed === null) badNumbers[k] = k === 'tiresSetCost' && parseDecimal(raw) !== null ? 'Suma poate avea cel mult 2 zecimale.' : 'Număr invalid.';
    return parsed ?? undefined;
  };
  const common = {
    name: v.name,
    make: v.make.trim() || undefined,
    model: v.model.trim() || undefined,
    tiresSetCost: n('tiresSetCost'),
    tiresLifetimeKm: n('tiresLifetimeKm'),
    maintenancePerKm: n('maintenancePerKm'),
    depreciationPerKm: n('depreciationPerKm'),
    otherPerKm: n('otherPerKm'),
  };
  const data =
    v.powertrain === 'electric'
      ? {
          ...common,
          powertrain: 'electric',
          evConsumptionKWhPer100: n('evConsumptionKWhPer100'),
          homePricePerKWh: n('homePricePerKWh'),
          publicPricePerKWh: n('publicPricePerKWh'),
          homeSharePct: v.homeSharePct,
          chargingLossPct: n('chargingLossPct'),
          batteryKWh: v.batteryKWh.trim() === '' ? null : n('batteryKWh'),
        }
      : { ...common, powertrain: v.powertrain, fuelConsumptionLPer100: n('fuelConsumptionLPer100'), fuelPricePerL: n('fuelPricePerL') };
  return { data, badNumbers };
}

interface Props {
  vehicle?: VehicleEntity;
  currency: string;
  submitLabel: string;
  onSaved: (v: VehicleEntity) => void;
}

export function VehicleForm({ vehicle, currency, submitLabel, onSaved }: Props) {
  const [values, setValues] = useState<Values>(() => initialValues(vehicle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Values>(k: K) => (val: Values[K]) => {
    setValues((s) => ({ ...s, [k]: val }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const { [k as string]: _gone, ...rest } = e;
      return rest;
    });
  };

  // Previzualizare live a costului pe km, când datele necesare sunt valide.
  const preview = useMemo(() => {
    const { data } = toVehicleData(values);
    const d = data as Record<string, number | undefined>;
    const ok = (...keys: string[]) => keys.every((k) => typeof d[k] === 'number' && Number.isFinite(d[k]));
    let energy: number | null = null;
    let blended: number | null = null;
    if (values.powertrain === 'electric' && ok('evConsumptionKWhPer100', 'homePricePerKWh', 'publicPricePerKWh', 'chargingLossPct') && d.chargingLossPct! < 100) {
      const ev = data as unknown as Parameters<typeof blendedKWhPrice>[0];
      blended = blendedKWhPrice(ev);
      energy = energyCostPerKm(ev);
    } else if (values.powertrain !== 'electric' && ok('fuelConsumptionLPer100', 'fuelPricePerL')) {
      energy = energyCostPerKm(data as unknown as Parameters<typeof energyCostPerKm>[0]);
    }
    const wear = ok('maintenancePerKm', 'depreciationPerKm', 'tiresSetCost', 'tiresLifetimeKm', 'otherPerKm')
      ? wearCostPerKm(data as unknown as Parameters<typeof wearCostPerKm>[0])
      : null;
    return { energy, blended, wear };
  }, [values]);

  async function submit() {
    const { data, badNumbers } = toVehicleData(values);
    if (Object.keys(badNumbers).length) {
      setErrors(badNumbers as Record<string, string>);
      return;
    }
    setSaving(true);
    try {
      onSaved(await saveVehicle(data as VehicleData, vehicle?.id));
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fieldErrors);
      else setErrors({ _: 'Vehiculul nu a putut fi salvat. Încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  }

  const unit = (u: string) => `${currency}/${u}`;
  const isEv = values.powertrain === 'electric';

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TextField label="Nume (cum îl recunoști)" value={values.name} onChange={set('name')} error={errors.name} placeholder="Ex.: Tesla albă" maxLength={60} />
      <div className="grid-2">
        <TextField label="Marcă" value={values.make} onChange={set('make')} maxLength={40} />
        <TextField label="Model" value={values.model} onChange={set('model')} maxLength={40} />
      </div>
      <SelectField
        label="Motorizare"
        value={values.powertrain}
        onChange={set('powertrain')}
        options={POWERTRAINS.map((p) => ({ value: p, label: POWERTRAIN_LABEL[p] }))}
      />

      <p className="section-label">Energie</p>
      {isEv ? (
        <>
          <div className="grid-2">
            <NumberField label="Consum real" unit="kWh/100 km" value={values.evConsumptionKWhPer100} onChange={set('evConsumptionKWhPer100')} error={errors.evConsumptionKWhPer100} placeholder="Ex.: 17" />
            <NumberField label="Baterie (opțional)" unit="kWh" value={values.batteryKWh} onChange={set('batteryKWh')} error={errors.batteryKWh} />
            <NumberField label="Preț acasă" unit={unit('kWh')} value={values.homePricePerKWh} onChange={set('homePricePerKWh')} error={errors.homePricePerKWh} />
            <NumberField label="Preț stații publice" unit={unit('kWh')} value={values.publicPricePerKWh} onChange={set('publicPricePerKWh')} error={errors.publicPricePerKWh} />
          </div>
          <div className="panel">
            <div className="row small">
              <span>
                Acasă <b className="num">{values.homeSharePct}%</b>
              </span>
              <span>
                Stații publice <b className="num">{100 - values.homeSharePct}%</b>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={values.homeSharePct}
              aria-label="Procentul de energie încărcat acasă"
              onChange={(e) => set('homeSharePct')(Number(e.target.value))}
            />
            <NumberField label="Pierderi la încărcare (opțional)" unit="%" value={values.chargingLossPct} onChange={set('chargingLossPct')} error={errors.chargingLossPct} hint="Lasă gol dacă nu știi; consumul din mașină le exclude de obicei." />
            <div className="result-line">
              <span className="muted">Preț mediu</span>
              <b className="num">{preview.blended === null ? '—' : `${formatNumber(preview.blended, 3)} ${unit('kWh')}`}</b>
            </div>
          </div>
        </>
      ) : (
        <div className="grid-2">
          <NumberField label="Consum mediu" unit="L/100 km" value={values.fuelConsumptionLPer100} onChange={set('fuelConsumptionLPer100')} error={errors.fuelConsumptionLPer100} />
          <NumberField label="Preț combustibil" unit={unit('L')} value={values.fuelPricePerL} onChange={set('fuelPricePerL')} error={errors.fuelPricePerL} />
        </div>
      )}

      <p className="section-label">Uzură și alte costuri</p>
      <div className="grid-2">
        <NumberField label="Set anvelope (opțional)" unit={currency} value={values.tiresSetCost} onChange={set('tiresSetCost')} error={errors.tiresSetCost} />
        <NumberField label="Rezistă (opțional)" unit="km" value={values.tiresLifetimeKm} onChange={set('tiresLifetimeKm')} error={errors.tiresLifetimeKm} />
        <NumberField label="Mentenanță" unit={unit('km')} value={values.maintenancePerKm} onChange={set('maintenancePerKm')} error={errors.maintenancePerKm} hint="Revizii, frâne, filtre" />
        <NumberField label="Depreciere" unit={unit('km')} value={values.depreciationPerKm} onChange={set('depreciationPerKm')} error={errors.depreciationPerKm} hint="Cât pierde mașina din valoare" />
        <NumberField label="Alte costuri (opțional)" unit={unit('km')} value={values.otherPerKm} onChange={set('otherPerKm')} error={errors.otherPerKm} className="span-2" />
      </div>

      <div className="panel">
        <div className="row">
          <span className="muted">Energie pe km</span>
          <b className="num">{preview.energy === null ? '—' : `${formatNumber(preview.energy, 3)} ${unit('km')}`}</b>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="muted">Uzură pe km</span>
          <b className="num">{preview.wear === null ? '—' : `${formatNumber(preview.wear, 3)} ${unit('km')}`}</b>
        </div>
        <div className="result-line">
          <span>Cost mașină pe km</span>
          <b className="num">{preview.energy === null || preview.wear === null ? '—' : `${formatNumber(preview.energy + preview.wear, 3)} ${unit('km')}`}</b>
        </div>
      </div>

      {errors._ && <p className="field-error" role="alert">{errors._}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
        {submitLabel}
      </button>
    </form>
  );
}
