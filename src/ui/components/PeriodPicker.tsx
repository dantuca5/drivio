import { addMonths, format, startOfMonth } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useState } from 'react';
import { resolvePeriod, type DateRange, type PeriodSpec } from '../../domain';
import { capitalizeFirst } from '../format';
import { TextField } from './controls';
import { Sheet } from './Sheet';

const QUICK: { kind: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth'; label: string }[] = [
  { kind: 'today', label: 'Astăzi' },
  { kind: 'yesterday', label: 'Ieri' },
  { kind: 'last7', label: 'Ultimele 7 zile' },
  { kind: 'last30', label: 'Ultimele 30 de zile' },
  { kind: 'thisMonth', label: 'Luna curentă' },
];

const SHORT: Record<string, string> = { today: 'Astăzi', yesterday: 'Ieri', last7: '7 zile', last30: '30 de zile', thisMonth: 'Luna aceasta' };

/**
 * Eticheta unei perioade, scurtă: „Noiembrie 2026”, „13–19 noiembrie 2026”,
 * „28 octombrie – 3 noiembrie 2026”, „Astăzi, 19 noiembrie 2026”.
 */
export function periodLabel(spec: PeriodSpec, range: DateRange): string {
  const f = (x: Date, p: string) => format(x, p, { locale: ro });
  const first = range.start;
  const last = new Date(range.end.getTime() - 1);
  switch (spec.kind) {
    case 'today':
    case 'yesterday':
      return `${spec.kind === 'today' ? 'Astăzi' : 'Ieri'}, ${f(first, 'd MMMM yyyy')}`;
    case 'month':
    case 'thisMonth':
      return capitalizeFirst(f(first, 'LLLL yyyy'));
    default:
      if (first.getFullYear() !== last.getFullYear()) return `${f(first, 'd MMMM yyyy')} – ${f(last, 'd MMMM yyyy')}`;
      if (first.getMonth() !== last.getMonth()) return `${f(first, 'd MMMM')} – ${f(last, 'd MMMM yyyy')}`;
      if (first.getDate() === last.getDate()) return f(first, 'd MMMM yyyy');
      return `${f(first, 'd')}–${f(last, 'd MMMM yyyy')}`;
  }
}

/** Rândul de perioade rapide + „Altă perioadă” (luni anterioare, interval personalizat). */
export function PeriodPicker({ value, onChange, now }: { value: PeriodSpec; onChange: (p: PeriodSpec) => void; now: Date }) {
  const [open, setOpen] = useState(false);
  const isOther = value.kind === 'month' || value.kind === 'custom';
  const otherLabel = isOther ? periodLabel(value, resolvePeriod(value, now)) : 'Altă perioadă';
  return (
    <>
      <div className="filters" role="group" aria-label="Perioadă">
        {QUICK.map((p) => (
          <button key={p.kind} type="button" className="chip" aria-pressed={value.kind === p.kind} onClick={() => onChange({ kind: p.kind })}>
            {SHORT[p.kind]}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={isOther} onClick={() => setOpen(true)}>
          {otherLabel}
        </button>
      </div>
      {open && (
        <PeriodSheet
          now={now}
          onClose={() => setOpen(false)}
          onPick={(p) => {
            onChange(p);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function PeriodSheet({ now, onPick, onClose }: { now: Date; onPick: (p: PeriodSpec) => void; onClose: () => void }) {
  const today = format(now, 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [to, setTo] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(now), -(i + 1)));

  return (
    <Sheet title="Alege perioada" onClose={onClose}>
      <p className="section-label" style={{ marginTop: 0 }}>Interval personalizat</p>
      <div className="grid-2">
        <TextField type="date" label="De la" value={from} onChange={setFrom} />
        <TextField type="date" label="Până la (inclusiv)" value={to} onChange={setTo} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 10 }}
        onClick={() => {
          const spec: PeriodSpec = { kind: 'custom', from, to };
          try {
            resolvePeriod(spec, now);
            onPick(spec);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Interval invalid.');
          }
        }}
      >
        Aplică intervalul
      </button>

      <p className="section-label">Luni anterioare</p>
      <div className="list">
        {months.map((m) => (
          <button key={m.toISOString()} type="button" className="list-row" style={{ gridTemplateColumns: '1fr' }} onClick={() => onPick({ kind: 'month', month: format(m, 'yyyy-MM') })}>
            <b>{capitalizeFirst(format(m, 'LLLL yyyy', { locale: ro }))}</b>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
