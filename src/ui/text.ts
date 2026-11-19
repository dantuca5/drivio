import { formatNumber, type ExpenseCategory, type Platform, type Powertrain, type Thresholds, type Verdict, type VerdictLevel } from '../domain';

export const PLATFORM_LABEL: Record<Platform, string> = { uber: 'Uber', bolt: 'Bolt' };

export const POWERTRAIN_LABEL: Record<Powertrain, string> = {
  petrol: 'Benzină',
  diesel: 'Motorină',
  lpg: 'GPL',
  hybrid: 'Hibrid',
  electric: 'Electric',
};

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  fuel: 'Combustibil',
  charging: 'Încărcare',
  service: 'Service',
  tires: 'Anvelope',
  carwash: 'Spălătorie',
  parking: 'Parcare',
  fine: 'Amendă',
  insurance: 'Asigurare',
  phone: 'Telefon',
  accounting: 'Contabilitate',
  other: 'Altele',
};

export const VERDICT_WORD: Record<VerdictLevel, string> = {
  go: 'Merită',
  slow: 'La limită',
  stop: 'Nu merită',
};

/** Explicația verdictului, cu pragurile utilizatorului. */
export function verdictReason(v: Verdict, t: Thresholds, currency: string): string {
  const h = (n: number) => `${formatNumber(n, 0)} ${currency}/oră`;
  const k = (n: number) => `${formatNumber(n)} ${currency}/km`;
  const r = v.reasons;
  if (r.includes('loss')) return 'Pierzi bani pe această cursă.';
  if (r.includes('insufficientData')) return 'Adaugă km sau minute pentru un verdict complet.';
  if (r.includes('meetsTargets')) return `Peste pragurile de ${h(t.greenFromPerHour)} și ${k(t.greenFromPerKm)}.`;
  const parts: string[] = [];
  if (r.includes('belowRedHour')) parts.push(`sub ${h(t.redBelowPerHour)}`);
  if (r.includes('belowRedKm')) parts.push(`sub ${k(t.redBelowPerKm)}`);
  if (parts.length) return `${capitalize(parts.join(' și '))}.`;
  if (r.includes('belowGreenHour')) parts.push(h(t.greenFromPerHour));
  if (r.includes('belowGreenKm')) parts.push(k(t.greenFromPerKm));
  return `Profitabilă, dar sub ținta de ${parts.join(' și ')}.`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const ESTIMATE_NOTE = 'Estimare operațională, nu profit contabil sau fiscal.';
