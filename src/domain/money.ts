import { DomainError } from './errors';

/**
 * Sumă de bani în subunități întregi (bani pentru RON, cenți pentru EUR).
 * Toate sumele de tranzacție (tarif, bacșiș, cheltuieli, obiective) se păstrează așa,
 * ca adunările să fie exacte. Prețurile unitare (RON/L, RON/kWh, RON/km) rămân zecimale.
 */
export type Minor = number;

/**
 * Rotunjire „jumătate în sus” (în afară de zero pentru negative), cu corecție pentru
 * reprezentarea binară: 2.675 se rotunjește la 2.68, nu la 2.67.
 */
export function roundHalfUp(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) throw new DomainError(`Nu se poate rotunji ${String(value)}.`);
  const factor = 10 ** decimals;
  const scaled = Number((Math.abs(value) * factor).toPrecision(15));
  const rounded = (Math.sign(value) * Math.round(scaled)) / factor;
  return rounded + 0; // elimină -0
}

export function toMinor(major: number): Minor {
  return roundHalfUp(major * 100);
}

export function fromMinor(minor: Minor): number {
  return minor / 100;
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

/**
 * Interpretează un număr tastat de utilizator. Acceptă virgula și punctul ca separator
 * zecimal și separatoare de mii („1.234,56”, „1,234.56”, „1 234,5”).
 * Un singur separator e mereu zecimal („35.5” = 35,5), cu excepția grupărilor repetate
 * de câte 3 cifre („1.234.567”). Întoarce null pentru text care nu e un număr.
 */
export function parseDecimal(input: string): number | null {
  let s = input.trim().replace(/[\s  ']/g, '');
  if (s === '') return null;

  const commas = count(s, ',');
  const dots = count(s, '.');

  if (commas > 0 && dots > 0) {
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    if (count(s, decimal) > 1) return null;
    const [intPart = ''] = s.split(decimal);
    if (!new RegExp(`^-?\\d{1,3}(\\${thousands}\\d{3})+$`).test(intPart)) return null;
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (commas > 1 || dots > 1) {
    const sep = commas > 1 ? ',' : '.';
    if (!new RegExp(`^-?\\d{1,3}(\\${sep}\\d{3})+$`).test(s)) return null;
    s = s.split(sep).join('');
  } else {
    s = s.replace(',', '.');
  }

  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Interpretează o sumă de bani tastată. Spre deosebire de parseDecimal, un singur punct urmat
 * de exact 3 cifre e separator de mii („1.500” = 1500 lei, cum se scrie în română), iar
 * sumele cu mai mult de 2 zecimale sunt respinse (null), în loc să fie rotunjite pe tăcute.
 */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/[\s  ']/g, '');
  const normalized = /^-?[1-9]\d{0,2}\.\d{3}$/.test(s) ? s.replace('.', '') : s;
  const n = parseDecimal(normalized);
  if (n === null) return null;
  const cents = n * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6 ? n : null;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(minor: Minor, currency: string, locale = 'ro-RO'): string {
  const key = `${locale}|${currency}`;
  let f = moneyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    moneyFormatters.set(key, f);
  }
  return f.format(fromMinor(minor));
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

/** Formatează un număr; valorile lipsă sau nefinite apar ca „—”. Formatoarele se refolosesc (crearea lor e lentă). */
export function formatNumber(value: number | null | undefined, decimals = 2, locale = 'ro-RO'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const key = `${locale}|${decimals}`;
  let f = numberFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: 'always', // și pentru 1.234, nu doar de la 10.000
    });
    numberFormatters.set(key, f);
  }
  return f.format(value);
}
