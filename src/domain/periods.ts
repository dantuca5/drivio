import { addDays, addMonths, format, startOfDay, startOfMonth } from 'date-fns';
import { DomainError } from './errors';
import type { DateRange } from './types';

export type PeriodSpec =
  | { kind: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' }
  | { kind: 'month'; month: string } // 'YYYY-MM'
  | { kind: 'custom'; from: string; to: string }; // 'YYYY-MM-DD', capete incluse

/** Cheie de zi în ora locală: 'YYYY-MM-DD'. */
export function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Începutul zilei locale pentru 'YYYY-MM-DD', sau null dacă data nu există. */
export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

function parseMonthKey(key: string): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  const month = m ? Number(m[2]) : 0;
  if (!m || month < 1 || month > 12) throw new DomainError(`Lună invalidă: ${key}.`);
  return new Date(Number(m[1]), month - 1, 1);
}

/** Transformă o perioadă într-un interval [start, end) în ora locală. */
export function resolvePeriod(spec: PeriodSpec, now: Date): DateRange {
  const today = startOfDay(now);
  switch (spec.kind) {
    case 'today':
      return { start: today, end: addDays(today, 1) };
    case 'yesterday':
      return { start: addDays(today, -1), end: today };
    case 'last7':
      return { start: addDays(today, -6), end: addDays(today, 1) };
    case 'last30':
      return { start: addDays(today, -29), end: addDays(today, 1) };
    case 'thisMonth': {
      const start = startOfMonth(now);
      return { start, end: addMonths(start, 1) };
    }
    case 'month': {
      const start = parseMonthKey(spec.month);
      return { start, end: addMonths(start, 1) };
    }
    case 'custom': {
      const from = parseDayKey(spec.from);
      const to = parseDayKey(spec.to);
      if (!from || !to) throw new DomainError('Interval invalid: verifică datele.');
      if (to < from) throw new DomainError('Interval invalid: data de sfârșit este înaintea celei de început.');
      return { start: from, end: addDays(to, 1) };
    }
  }
}

export function isInRange(d: Date, r: DateRange): boolean {
  return d >= r.start && d < r.end;
}

/** Zilele calendaristice din interval, ca chei 'YYYY-MM-DD'. */
export function daysInRange(r: DateRange): string[] {
  const out: string[] = [];
  for (let d = startOfDay(r.start); d < r.end; d = addDays(d, 1)) out.push(dayKey(d));
  return out;
}
