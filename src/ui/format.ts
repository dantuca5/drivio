import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatNumber, fromMinor, type Minor } from '../domain';

/** 1.234,56 (fără simbol; moneda se afișează separat, mai discret). */
export const amount = (minor: Minor) => formatNumber(fromMinor(minor), 2);

export const money = (minor: Minor, currency: string) => `${amount(minor)} ${currency}`;

export const perHour = (v: number | null, currency: string) => (v === null ? '—' : `${formatNumber(v)} ${currency}/oră`);
export const perKm = (v: number | null, currency: string) => (v === null ? '—' : `${formatNumber(v)} ${currency}/km`);
export const pct = (v: number | null, decimals = 0) => (v === null ? '—' : `${formatNumber(v, decimals)}%`);

/** Doar prima literă mare: „Joi, 19 noiembrie” (lunile rămân cu literă mică, ca în română). */
export const capitalizeFirst = (s: string) => s.charAt(0).toLocaleUpperCase('ro-RO') + s.slice(1);

export const time = (d: Date) => format(d, 'HH:mm');
export const dayTitle = (d: Date) => capitalizeFirst(format(d, 'EEEE, d MMMM', { locale: ro }));

/** Valoare pentru <input type="datetime-local"> în ora locală. */
export const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function fromLocalInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Afișează un număr salvat în câmpurile de formular (virgulă zecimală). */
export const toField = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
