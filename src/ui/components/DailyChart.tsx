import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { formatNumber, fromMinor, parseDayKey, type DailyPoint } from '../../domain';

export type ChartMetric = 'profit' | 'income' | 'costs';

const VALUE: Record<ChartMetric, (p: DailyPoint) => number> = {
  profit: (p) => p.profitMinor,
  income: (p) => p.incomeMinor,
  costs: (p) => p.costsMinor,
};

const capitalizeFirst = (s: string) => s.charAt(0).toLocaleUpperCase('ro-RO') + s.slice(1);

const H = 150;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const AXIS_W = 40;

/** Rotunjește maximul axei la o valoare „frumoasă” (1, 2, 5 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Bară cu capăt rotunjit (4px) spre exterior și bază dreaptă pe linia de zero. */
function barPath(x: number, w: number, y0: number, y1: number): string {
  const h = Math.abs(y1 - y0);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return '';
  if (y1 < y0) {
    // în sus
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

/**
 * Grafic cu bare pe zile pentru o singură serie (profit, venit sau costuri), o singură axă.
 * Atingerea sau săgețile stânga/dreapta selectează o zi și îi arată valoarea.
 */
export function DailyChart({ points, metric, currency, title }: { points: DailyPoint[]; metric: ChartMetric; currency: string; title: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [sel, setSel] = useState<number | null>(null);
  const descId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSel(null), [points, metric]);

  const values = points.map(VALUE[metric]);
  const maxV = niceMax(Math.max(0, ...values));
  const minV = -niceMax(-Math.min(0, ...values));
  const span = maxV - minV || 1;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => PAD_TOP + ((maxV - v) / span) * plotH;
  const plotW = width - AXIS_W;
  const slot = plotW / Math.max(points.length, 1);
  const gap = Math.min(2, slot * 0.3);
  const barW = Math.max(1, Math.min(28, slot - gap));
  const y0 = y(0);
  // fără duplicate când toate valorile sunt 0
  const ticks = [...new Set(minV < 0 ? [maxV, 0, minV] : [maxV, maxV / 2, 0])].map((t) => t + 0);

  const labelIdx = points.length <= 7 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const day = (i: number) => parseDayKey(points[i]!.day)!;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setSel((s) => Math.min(points.length - 1, (s ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, (s ?? points.length) - 1));
    else if (e.key === 'Escape') setSel(null);
    else return;
    e.preventDefault();
  };

  const selected = sel !== null ? points[sel] : null;

  return (
    <div ref={wrap} className="chart">
      <div className="chart-readout" aria-live="polite">
        {selected ? (
          <>
            <span className="muted">{capitalizeFirst(format(day(sel!), 'EEEE, d MMMM', { locale: ro }))}</span>
            <b className="num">
              {formatNumber(fromMinor(VALUE[metric](selected)))} {currency}
            </b>
          </>
        ) : (
          <span className="muted">Atinge o bară pentru valoarea zilei.</span>
        )}
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={title}
        aria-describedby={descId}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setSel(null)}
        style={{ display: 'block', touchAction: 'pan-y' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={AXIS_W} x2={width} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-zero' : 'chart-grid'} />
            <text x={AXIS_W - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">
              {formatNumber(fromMinor(t), 0)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = AXIS_W + i * slot + (slot - barW) / 2;
          const v = values[i]!;
          return (
            <g key={p.day} onClick={() => setSel(i === sel ? null : i)} style={{ cursor: 'pointer' }}>
              {/* zonă de atingere pe toată înălțimea coloanei */}
              <rect x={AXIS_W + i * slot} y={PAD_TOP} width={slot} height={plotH} fill="transparent" />
              <path d={barPath(x, barW, y0, y(v))} className={`chart-bar ${sel !== null && sel !== i ? 'dim' : ''}`} />
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text key={i} x={AXIS_W + i * slot + slot / 2} y={H - 6} textAnchor={points.length > 7 ? (i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle') : 'middle'} className="chart-tick">
            {format(day(i), points.length <= 7 ? 'EEEEEE' : 'd MMM', { locale: ro })}
          </text>
        ))}
      </svg>
      <table id={descId} className="visually-hidden">
        <caption>{title}</caption>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.day}>
              <th scope="row">{format(day(i), 'd MMMM', { locale: ro })}</th>
              <td>{formatNumber(fromMinor(values[i]!))} {currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
