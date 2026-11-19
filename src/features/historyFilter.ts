import { evaluateVerdict, formatNumber, fromMinor, isInRange, type DateRange, type Platform, type Thresholds, type VerdictLevel } from '../domain';
import type { RideEntity } from '../services/entities';

export type RideSort = 'newest' | 'oldest' | 'profitDesc' | 'perHourDesc' | 'perHourAsc' | 'perKmDesc';

export interface RideFilter {
  query: string;
  platform: Platform | 'all';
  verdict: VerdictLevel | 'all';
  range: DateRange | null;
  sort: RideSort;
  /** null = toate */
  limit: number | null;
}

export const defaultRideFilter: RideFilter = { query: '', platform: 'all', verdict: 'all', range: null, sort: 'newest', limit: null };

/** Fără diacritice și majuscule: „ștefan” găsește „Stefan”. */
export const normalize = (s: string) =>
  s
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[şș]/g, 's')
    .replace(/[ţț]/g, 't');

/** Textul căutabil al fiecărei curse, calculat o singură dată (nu la fiecare tastă). */
const haystackCache = new WeakMap<RideEntity, { vehicleName: string; text: string }>();

function haystack(r: RideEntity, vehicleName: string): string {
  const cached = haystackCache.get(r);
  if (cached && cached.vehicleName === vehicleName) return cached.text;
  const text = buildHaystack(r, vehicleName);
  haystackCache.set(r, { vehicleName, text });
  return text;
}

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Textul în care se caută: notă, platformă, vehicul, sume, dată (formatare directă, fără biblioteci: e pe drumul rapid). */
function buildHaystack(r: RideEntity, vehicleName: string): string {
  const d = r.startedAt;
  return normalize(
    [
      r.note ?? '',
      r.platform,
      vehicleName,
      formatNumber(fromMinor(r.result.grossIncomeMinor)),
      formatNumber(fromMinor(r.result.grossFareMinor)),
      formatNumber(fromMinor(r.result.profitMinor)),
      `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      `${d.getDate()} ${MONTHS[d.getMonth()]}`,
    ].join(' '),
  );
}

const metric = (r: RideEntity, s: RideSort): number | null => {
  switch (s) {
    case 'profitDesc':
      return r.result.profitMinor;
    case 'perHourDesc':
    case 'perHourAsc':
      return r.result.profitPerHour;
    case 'perKmDesc':
      return r.result.profitPerKm;
    default:
      return r.startedAt.getTime();
  }
};

export function filterRides(
  rides: readonly RideEntity[],
  f: RideFilter,
  thresholds: Thresholds,
  vehicleNames: ReadonlyMap<string, string> = new Map(),
): RideEntity[] {
  const terms = normalize(f.query).split(/\s+/).filter(Boolean);
  let out = rides.filter((r) => {
    if (r.deletedAt !== null) return false;
    if (f.platform !== 'all' && r.platform !== f.platform) return false;
    if (f.range && !isInRange(r.startedAt, f.range)) return false;
    if (f.verdict !== 'all' && evaluateVerdict(r.result, thresholds).level !== f.verdict) return false;
    if (terms.length) {
      const h = haystack(r, vehicleNames.get(r.vehicleId) ?? '');
      if (!terms.every((t) => h.includes(t))) return false;
    }
    return true;
  });

  // Sortările după profit/oră sau profit/km exclud cursele fără acea metrică (0 km / 0 minute).
  if (f.sort !== 'newest' && f.sort !== 'oldest' && f.sort !== 'profitDesc') {
    out = out.filter((r) => metric(r, f.sort) !== null);
  }
  const dir = f.sort === 'oldest' || f.sort === 'perHourAsc' ? 1 : -1;
  out = [...out].sort((a, b) => dir * (metric(a, f.sort)! - metric(b, f.sort)!) || b.startedAt.getTime() - a.startedAt.getTime());
  return f.limit === null ? out : out.slice(0, f.limit);
}
