import { useState } from 'react';
import { commissionPctSchema, parseDecimal, thresholdsSchema, type Platform, type Thresholds } from '../../domain';
import { NumberField } from '../components/controls';
import { toField } from '../format';

export interface FinancialValues {
  commissionPct: Record<Platform, number>;
  thresholds: Thresholds;
}

interface Props {
  initial?: FinancialValues;
  currency: string;
  submitLabel: string;
  onSubmit: (v: FinancialValues) => Promise<void> | void;
}

type Key = 'uber' | 'bolt' | keyof Thresholds;

/** Comisioanele platformelor și pragurile verdictului. Nicio valoare nu e pre-completată. */
export function FinancialForm({ initial, currency, submitLabel, onSubmit }: Props) {
  const [v, setV] = useState<Record<Key, string>>({
    uber: toField(initial?.commissionPct.uber),
    bolt: toField(initial?.commissionPct.bolt),
    redBelowPerHour: toField(initial?.thresholds.redBelowPerHour),
    greenFromPerHour: toField(initial?.thresholds.greenFromPerHour),
    redBelowPerKm: toField(initial?.thresholds.redBelowPerKm),
    greenFromPerKm: toField(initial?.thresholds.greenFromPerKm),
  });
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: Key) => (val: string) => {
    setV((s) => ({ ...s, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit() {
    const errs: Partial<Record<Key, string>> = {};
    const num = (k: Key): number | undefined => {
      if (v[k].trim() === '') {
        errs[k] = 'Completează valoarea.';
        return undefined;
      }
      const n = parseDecimal(v[k]);
      if (n === null) errs[k] = 'Număr invalid.';
      return n ?? undefined;
    };
    const uber = num('uber');
    const bolt = num('bolt');
    for (const [k, val] of [['uber', uber], ['bolt', bolt]] as const) {
      if (val !== undefined) {
        const r = commissionPctSchema.safeParse(val);
        if (!r.success) errs[k] = r.error.issues[0]?.message;
      }
    }
    const t = {
      redBelowPerHour: num('redBelowPerHour'),
      greenFromPerHour: num('greenFromPerHour'),
      redBelowPerKm: num('redBelowPerKm'),
      greenFromPerKm: num('greenFromPerKm'),
    };
    const parsed = thresholdsSchema.safeParse(t);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as Key;
        errs[k] ??= issue.message;
      }
    }
    if (Object.values(errs).some(Boolean) || !parsed.success) {
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ commissionPct: { uber: uber!, bolt: bolt! }, thresholds: parsed.data });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="section-label" style={{ marginTop: 4 }}>Comisionul platformelor</p>
      <p className="small muted">Procentul reținut din tariful cursei. Îl găsești în rapoartele din aplicația de șofer.</p>
      <div className="grid-2">
        <NumberField label="Uber" unit="%" value={v.uber} onChange={set('uber')} error={errors.uber} />
        <NumberField label="Bolt" unit="%" value={v.bolt} onChange={set('bolt')} error={errors.bolt} />
      </div>

      <p className="section-label">Când e o cursă bună</p>
      <p className="small muted">
        Verde dacă atinge ambele ținte; roșu dacă scade sub oricare prag minim sau pierzi bani; galben între ele.
      </p>
      <div className="grid-2">
        <NumberField label="Roșu sub" unit={`${currency}/oră`} value={v.redBelowPerHour} onChange={set('redBelowPerHour')} error={errors.redBelowPerHour} />
        <NumberField label="Verde de la" unit={`${currency}/oră`} value={v.greenFromPerHour} onChange={set('greenFromPerHour')} error={errors.greenFromPerHour} />
        <NumberField label="Roșu sub" unit={`${currency}/km`} value={v.redBelowPerKm} onChange={set('redBelowPerKm')} error={errors.redBelowPerKm} />
        <NumberField label="Verde de la" unit={`${currency}/km`} value={v.greenFromPerKm} onChange={set('greenFromPerKm')} error={errors.greenFromPerKm} />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 8 }}>
        {submitLabel}
      </button>
    </form>
  );
}
