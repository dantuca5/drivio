import { addDays, addMonths, differenceInCalendarDays, getDaysInMonth, startOfDay, startOfMonth } from 'date-fns';
import { roundHalfUp, type Minor } from './money';
import { daysInRange, isInRange, parseDayKey } from './periods';
import {
  ENERGY_EXPENSE_CATEGORIES,
  PLATFORMS,
  type DateRange,
  type ExpenseItem,
  type FixedCost,
  type Platform,
  type RideRecord,
} from './types';

/**
 * Costul fix lunar alocat unui interval: pentru fiecare lună atinsă,
 * cost × zile din interval în acea lună / zile în lună. Rotunjit o dată, la final.
 */
export function allocateFixedCosts(monthlyMinor: Minor, start: Date, end: Date): Minor {
  if (end <= start || monthlyMinor === 0) return 0;
  let total = 0;
  for (let month = startOfMonth(start); month < end; month = addMonths(month, 1)) {
    const next = addMonths(month, 1);
    const from = start > month ? start : month;
    const to = end < next ? end : next;
    const days = differenceInCalendarDays(to, from);
    if (days > 0) total += (monthlyMinor * days) / getDaysInMonth(month);
  }
  return roundHalfUp(total);
}

/**
 * Costurile fixe se alocă doar până la sfârșitul zilei curente (nu pentru zile încă netrăite)
 * și doar în perioada de valabilitate a fiecărui cost.
 */
function fixedCostsFor(fixedCosts: readonly FixedCost[], range: DateRange, now: Date): Minor {
  const tomorrow = addDays(startOfDay(now), 1);
  const end = range.end < tomorrow ? range.end : tomorrow;
  let total = 0;
  for (const f of fixedCosts) {
    const from = startOfDay(f.activeFrom);
    const start = range.start > from ? range.start : from;
    const until = f.activeUntil ? startOfDay(f.activeUntil) : null;
    const stop = until && until < end ? until : end;
    if (stop > start) total += allocateFixedCosts(f.monthlyAmountMinor, start, stop);
  }
  return total;
}

const isEnergyExpense = (e: ExpenseItem) => ENERGY_EXPENSE_CATEGORIES.includes(e.category);

export interface PeriodInput {
  rides: readonly RideRecord[];
  expenses: readonly ExpenseItem[];
  fixedCosts: readonly FixedCost[];
  range: DateRange;
  now: Date;
}

export interface PeriodSummary {
  rideCount: number;
  grossIncomeMinor: Minor;
  commissionMinor: Minor;
  /** energie estimată din curse */
  energyEstimatedMinor: Minor;
  wearMinor: Minor;
  /** suma profiturilor operaționale ale curselor */
  rideProfitMinor: Minor;
  km: number;
  minutes: number;
  hours: number;
  avgProfitPerRideMinor: Minor | null;
  /** profitul curselor / km (fără cheltuieli și costuri fixe) */
  profitPerKm: number | null;
  /** profitul curselor / ore cu cursă */
  profitPerHour: number | null;
  /** cheltuieli manuale, fără bonurile de combustibil/încărcare */
  expensesMinor: Minor;
  /** bonuri de combustibil/încărcare: doar pentru comparație cu estimarea */
  energyPaidMinor: Minor;
  fixedCostsAllocatedMinor: Minor;
  /** profitul curselor − cheltuieli manuale − costuri fixe alocate */
  periodProfitMinor: Minor;
  taxReserveMinor: Minor;
  afterReserveMinor: Minor;
  /** comision + energie estimată + uzură + cheltuieli + costuri fixe */
  totalCostsMinor: Minor;
}

export function summarize(input: PeriodInput & { taxReservePct: number }): PeriodSummary {
  const { range, now } = input;
  const rides = input.rides.filter((r) => isInRange(r.startedAt, range));
  const expenses = input.expenses.filter((e) => isInRange(e.date, range));

  let grossIncomeMinor = 0;
  let commissionMinor = 0;
  let energyEstimatedMinor = 0;
  let wearMinor = 0;
  let rideProfitMinor = 0;
  let km = 0;
  let minutes = 0;
  for (const { result: r } of rides) {
    grossIncomeMinor += r.grossIncomeMinor;
    commissionMinor += r.commissionMinor;
    energyEstimatedMinor += r.energyCostMinor;
    wearMinor += r.wearCostMinor;
    rideProfitMinor += r.profitMinor;
    km += r.totalKm;
    minutes += r.totalMin;
  }

  const expensesMinor = expenses.filter((e) => !isEnergyExpense(e)).reduce((s, e) => s + e.amountMinor, 0);
  const energyPaidMinor = expenses.filter(isEnergyExpense).reduce((s, e) => s + e.amountMinor, 0);
  const fixedCostsAllocatedMinor = fixedCostsFor(input.fixedCosts, range, now);

  const periodProfitMinor = rideProfitMinor - expensesMinor - fixedCostsAllocatedMinor;
  const taxReserveMinor = roundHalfUp((Math.max(0, periodProfitMinor) * input.taxReservePct) / 100);
  const hours = minutes / 60;

  return {
    rideCount: rides.length,
    grossIncomeMinor,
    commissionMinor,
    energyEstimatedMinor,
    wearMinor,
    rideProfitMinor,
    km,
    minutes,
    hours,
    avgProfitPerRideMinor: rides.length > 0 ? roundHalfUp(rideProfitMinor / rides.length) : null,
    profitPerKm: km > 0 ? rideProfitMinor / 100 / km : null,
    profitPerHour: hours > 0 ? rideProfitMinor / 100 / hours : null,
    expensesMinor,
    energyPaidMinor,
    fixedCostsAllocatedMinor,
    periodProfitMinor,
    taxReserveMinor,
    afterReserveMinor: periodProfitMinor - taxReserveMinor,
    totalCostsMinor: commissionMinor + energyEstimatedMinor + wearMinor + expensesMinor + fixedCostsAllocatedMinor,
  };
}

export interface DailyPoint {
  day: string;
  incomeMinor: Minor;
  costsMinor: Minor;
  profitMinor: Minor;
}

/**
 * Seria zilnică pentru grafice. Pe fiecare zi: venit, costuri (comision + mașină +
 * cheltuieli + cost fix al zilei) și profit = venit − costuri. Costul fix se rotunjește
 * pe zi, deci suma zilelor poate diferi cu câțiva bani de totalul perioadei.
 */
export function dailySeries(input: PeriodInput): DailyPoint[] {
  return daysInRange(input.range).map((day) => {
    const start = parseDayKey(day)!;
    const dayInput = { ...input, range: { start, end: addDays(start, 1) } };
    const s = summarize({ ...dayInput, taxReservePct: 0 });
    return {
      day,
      incomeMinor: s.grossIncomeMinor,
      costsMinor: s.grossIncomeMinor - s.periodProfitMinor,
      profitMinor: s.periodProfitMinor,
    };
  });
}

export interface PlatformStats {
  rideCount: number;
  grossIncomeMinor: Minor;
  profitMinor: Minor;
  km: number;
  minutes: number;
  profitPerHour: number | null;
  profitPerKm: number | null;
  /** comision / tarif brut, ponderat */
  avgCommissionPct: number | null;
}

export function platformComparison(rides: readonly RideRecord[]): Record<Platform, PlatformStats> {
  const out = {} as Record<Platform, PlatformStats>;
  for (const p of PLATFORMS) {
    const list = rides.filter((r) => r.platform === p);
    let gross = 0;
    let fare = 0;
    let commission = 0;
    let profit = 0;
    let km = 0;
    let minutes = 0;
    for (const { result: r } of list) {
      gross += r.grossIncomeMinor;
      fare += r.grossFareMinor;
      commission += r.commissionMinor;
      profit += r.profitMinor;
      km += r.totalKm;
      minutes += r.totalMin;
    }
    out[p] = {
      rideCount: list.length,
      grossIncomeMinor: gross,
      profitMinor: profit,
      km,
      minutes,
      profitPerHour: minutes > 0 ? profit / 100 / (minutes / 60) : null,
      profitPerKm: km > 0 ? profit / 100 / km : null,
      avgCommissionPct: fare > 0 ? (commission / fare) * 100 : null,
    };
  }
  return out;
}

export type RankBy = 'profit' | 'profitPerHour' | 'profitPerKm';

/** Cele mai bune / slabe n curse; cursele fără metrica cerută (0 km, 0 minute) sunt excluse. */
export function rankRides<T extends RideRecord>(rides: readonly T[], by: RankBy, n: number, dir: 'best' | 'worst'): T[] {
  const metric = (r: T): number | null =>
    by === 'profit' ? r.result.profitMinor : by === 'profitPerHour' ? r.result.profitPerHour : r.result.profitPerKm;
  const sign = dir === 'best' ? -1 : 1;
  return rides
    .filter((r) => metric(r) !== null)
    .slice()
    .sort((a, b) => sign * (metric(a)! - metric(b)!) || b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, Math.max(0, n));
}
