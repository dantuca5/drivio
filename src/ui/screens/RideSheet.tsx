import { useMemo, useRef, useState } from 'react';
import { buildCostSnapshot, PLATFORMS, type Platform } from '../../domain';
import { emptyRideForm, liveCalculation, parseRideForm, rideInputToForm, type RideFormValues } from '../../features/rideForm';
import { useVehicles } from '../../features/hooks';
import type { AppSettings, RideEntity } from '../../services/entities';
import { saveRide, softDeleteRide, restoreRide, ValidationError } from '../../services/repositories';
import { NumberField, Segmented, SelectField, TextField } from '../components/controls';
import { CalcDetails, VerdictCard } from '../components/RideResultViews';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { fromLocalInput, toLocalInput } from '../format';
import { PLATFORM_LABEL } from '../text';

export type RideSheetMode = 'new' | 'simulate' | 'edit';

interface Props {
  mode: RideSheetMode;
  settings: AppSettings;
  ride?: RideEntity;
  onClose: () => void;
}

/**
 * Introducerea unei curse. Același ecran servește pentru cursă nouă, editare și simulare
 * înainte de acceptare (fără salvare). Verdictul se recalculează la fiecare tastă.
 */
export function RideSheet({ mode: initialMode, settings, ride, onClose }: Props) {
  const [mode, setMode] = useState<RideSheetMode>(initialMode);
  const vehicles = useVehicles(true);
  const toast = useToast();

  const [platform, setPlatform] = useState<Platform>(ride?.platform ?? settings.lastPlatform);
  const [vehicleId, setVehicleId] = useState<string>(ride?.vehicleId ?? settings.activeVehicleId ?? '');
  const [values, setValues] = useState<RideFormValues>(() =>
    ride ? rideInputToForm(ride.input, ride.commissionOverridden ? ride.snapshot.commissionPct : undefined) : emptyRideForm,
  );
  const [startedAt, setStartedAt] = useState(() => toLocalInput(ride?.startedAt ?? new Date()));
  const [note, setNote] = useState(ride?.note ?? '');
  const [showMore, setShowMore] = useState(() => !!ride && (ride.input.waitMin > 0 || ride.input.tipMinor > 0 || ride.input.bonusMinor > 0 || ride.commissionOverridden || ride.input.energyCostOverrideMinor != null || !!ride.note));
  const [touched, setTouched] = useState<Set<keyof RideFormValues>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const activeVehicles = (vehicles ?? []).filter((v) => !v.archived || v.id === vehicleId);
  const vehicle = vehicles?.find((v) => v.id === vehicleId) ?? activeVehicles[0];

  const [recalculate, setRecalculate] = useState(false);
  const parsed = useMemo(() => parseRideForm(values), [values]);

  // La editare, cursa își păstrează costurile de atunci, dacă nu ceri recalcularea
  // (aceeași regulă ca la salvare, în services/repositories.ts).
  const keepOld = mode === 'edit' && !!ride && !recalculate;
  const platformCommission = keepOld && ride!.platform === platform ? ride!.snapshot.commissionPct : settings.commissionPct[platform];
  const live = useMemo(() => {
    if (!vehicle) return null;
    const base = keepOld && ride!.vehicleId === vehicle.id ? ride!.snapshot : buildCostSnapshot(vehicle, platformCommission);
    return liveCalculation(parsed, { energyCostPerKm: base.energyCostPerKm, wearCostPerKm: base.wearCostPerKm, platformCommissionPct: platformCommission }, settings.thresholds);
  }, [parsed, vehicle, platformCommission, settings.thresholds, keepOld, ride]);

  const set = (k: keyof RideFormValues) => (val: string) => {
    setValues((s) => ({ ...s, [k]: val }));
    setTouched((t) => new Set(t).add(k));
    setSaveError(null);
  };
  const err = (k: keyof RideFormValues) => (submitted || (touched.has(k) && values[k] !== '') ? parsed.errors[k] : undefined);

  async function save() {
    if (savingRef.current) return; // Enter apăsat de două ori nu salvează de două ori
    setSubmitted(true);
    if (!parsed.input || !vehicle) return;
    const when = fromLocalInput(startedAt);
    if (!when) {
      setSaveError('Data și ora nu sunt valide.');
      return;
    }
    if (when.getTime() > Date.now() + 60 * 60 * 1000) {
      setSaveError('Data cursei este în viitor. Verifică data și ora.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await saveRide(
        { startedAt: when, platform, vehicleId: vehicle.id, input: parsed.input, commissionPct: parsed.commissionPct, note, recalculate },
        mode === 'edit' ? ride?.id : undefined,
      );
      if (mode === 'edit') {
        toast('Modificări salvate');
      } else {
        toast('Cursă salvată', { actionLabel: 'Anulează', onAction: () => void softDeleteRide(saved.id) });
      }
      onClose();
    } catch (e) {
      setSaveError(e instanceof ValidationError ? e.message : 'Cursa nu a putut fi salvată. Datele tale nu s-au pierdut; încearcă din nou.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (!ride) return;
    await softDeleteRide(ride.id);
    toast('Cursă ștearsă', { actionLabel: 'Anulează', onAction: () => void restoreRide(ride.id) });
    onClose();
  }

  const title = mode === 'edit' ? 'Editează cursa' : mode === 'simulate' ? 'Simulează o cursă' : 'Cursă nouă';
  const c = settings.currency;

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (mode !== 'simulate') void save();
        }}
      >
        <Segmented
          label="Platformă"
          value={platform}
          onChange={setPlatform}
          options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
        />
        {activeVehicles.length > 1 && (
          <SelectField label="Vehicul" value={vehicle?.id ?? ''} onChange={setVehicleId} options={activeVehicles.map((v) => ({ value: v.id, label: v.name }))} />
        )}

        <div className="grid-2">
          <NumberField
            className="span-2"
            label={values.fareMode === 'gross' ? 'Sumă cursă (înainte de comision)' : 'Sumă primită (după comision)'}
            unit={c}
            value={values.fare}
            onChange={set('fare')}
            error={err('fare')}
            autoFocus={mode !== 'edit'}
          />
          <NumberField label="Km cu client" unit="km" value={values.tripKm} onChange={set('tripKm')} error={err('tripKm')} />
          <NumberField label="Minute cursă" unit="min" mode="numeric" value={values.tripMin} onChange={set('tripMin')} error={err('tripMin')} />
          <NumberField label="Km până la client" unit="km" value={values.pickupKm} onChange={set('pickupKm')} error={err('pickupKm')} />
          <NumberField label="Minute până la client" unit="min" mode="numeric" value={values.pickupMin} onChange={set('pickupMin')} error={err('pickupMin')} />
        </div>

        <button type="button" className="link-btn row" aria-expanded={showMore} onClick={() => setShowMore((s) => !s)} style={{ justifyContent: 'space-between', width: '100%' }}>
          <span>Mai mult: așteptare, bacșiș, bonus, comision</span>
          <span aria-hidden="true">{showMore ? '－' : '＋'}</span>
        </button>
        {showMore && (
          <div className="grid-2">
            <Segmented
              className="span-2"
              label="Tipul sumei"
              value={values.fareMode}
              onChange={(m) => setValues((s) => ({ ...s, fareMode: m }))}
              options={[
                { value: 'gross', label: 'Sumă brută' },
                { value: 'net', label: 'Sumă netă' },
              ]}
            />
            <NumberField label="Minute așteptare" unit="min" mode="numeric" value={values.waitMin} onChange={set('waitMin')} error={err('waitMin')} />
            <NumberField label={`Comision ${PLATFORM_LABEL[platform]}`} unit="%" value={values.commission} onChange={set('commission')} error={err('commission')} placeholder={String(platformCommission).replace('.', ',')} hint="Gol = din setări" />
            <NumberField label="Bacșiș" unit={c} value={values.tip} onChange={set('tip')} error={err('tip')} />
            <NumberField label="Bonus" unit={c} value={values.bonus} onChange={set('bonus')} error={err('bonus')} />
            <NumberField className="span-2" label="Cost energie exact (opțional)" unit={c} value={values.energyOverride} onChange={set('energyOverride')} error={err('energyOverride')} hint="Gol = estimat din consumul vehiculului" />
            {mode !== 'simulate' && (
              <>
                <TextField className="span-2" type="datetime-local" label="Data și ora" value={startedAt} onChange={setStartedAt} />
                <TextField className="span-2" label="Notă (opțional)" value={note} onChange={setNote} maxLength={200} placeholder="Ex.: aeroport, trafic" />
              </>
            )}
          </div>
        )}

        {mode === 'edit' && (
          <label className="checkbox">
            <input type="checkbox" checked={recalculate} onChange={(e) => setRecalculate(e.target.checked)} />
            <span>
              Recalculează cu costurile și comisionul actuale
              <span className="small muted" style={{ display: 'block' }}>Altfel cursa își păstrează valorile din momentul salvării.</span>
            </span>
          </label>
        )}

        <VerdictCard result={live?.result ?? null} verdict={live?.verdict ?? null} thresholds={settings.thresholds} currency={c} />
        {live && <CalcDetails result={live.result} currency={c} />}
        {!vehicle && vehicles && <p className="field-error">Adaugă un vehicul în Setări ca să poți calcula.</p>}
        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}

        {mode === 'simulate' ? (
          <div className="grid-2">
            <button type="button" className="btn" onClick={() => { setValues(emptyRideForm); setTouched(new Set()); setSubmitted(false); }}>
              Golește
            </button>
            <button type="button" className="btn btn-primary" disabled={!live} onClick={() => setMode('new')}>
              Am acceptat-o
            </button>
          </div>
        ) : (
          <div className="grid-2">
            {mode === 'edit' ? (
              <button type="button" className="btn btn-danger" onClick={() => void remove()}>
                Șterge
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => setMode('simulate')}>
                Doar simulez
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {mode === 'edit' ? 'Salvează modificările' : 'Salvează cursa'}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
