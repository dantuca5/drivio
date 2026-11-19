import { describe, expect, it } from 'vitest';
import { allocateFixedCosts, dailySeries, platformComparison, rankRides, summarize } from '../aggregate';
import { resolvePeriod } from '../periods';
import { calculateRide } from '../rideCalc';
import type { ExpenseItem, FixedCost, RideRecord } from '../types';
import { referenceRide, referenceSnapshot } from './fixtures';

const now = new Date(2026, 10, 19, 21, 47);

const rec = (startedAt: Date, platform: 'uber' | 'bolt', patch: Partial<typeof referenceRide> = {}): RideRecord => ({
  startedAt,
  platform,
  result: calculateRide({ ...referenceRide, ...patch }, referenceSnapshot),
});

// Cursa A = referința (profit 1868, comision 875, energie 277, uzură 480, 12 km, 27 min)
// Cursa B: 50 RON, 20 km cu client, 3 km preluare, 30+6+0 min
const rideA = rec(new Date(2026, 10, 19, 10), 'bolt');
const rideB = rec(new Date(2026, 10, 19, 14), 'uber', { fareMinor: 5000, tripKm: 20, pickupKm: 3, tripMin: 30, pickupMin: 6, waitMin: 0 });
const rideYesterday = rec(new Date(2026, 10, 18, 22), 'uber');

const expenses: ExpenseItem[] = [
  { date: new Date(2026, 10, 19, 9), category: 'carwash', amountMinor: 3000 },
  { date: new Date(2026, 10, 19, 20), category: 'charging', amountMinor: 1000 },
  { date: new Date(2026, 10, 10, 12), category: 'service', amountMinor: 50000 },
];
const fixedCosts: FixedCost[] = [
  { monthlyAmountMinor: 30000, activeFrom: new Date(2026, 0, 1), activeUntil: null },
  // oprit înainte de noiembrie: nu mai contează
  { monthlyAmountMinor: 99999, activeFrom: new Date(2026, 0, 1), activeUntil: new Date(2026, 9, 1) },
];

describe('allocateFixedCosts', () => {
  it('o lună întreagă alocă exact costul lunar', () => {
    expect(allocateFixedCosts(30000, new Date(2026, 10, 1), new Date(2026, 11, 1))).toBe(30000);
    expect(allocateFixedCosts(28000, new Date(2026, 1, 1), new Date(2026, 2, 1))).toBe(28000);
  });
  it('o zi din noiembrie = 1/30', () => {
    expect(allocateFixedCosts(30000, new Date(2026, 10, 19), new Date(2026, 10, 20))).toBe(1000);
  });
  it('un interval peste două luni folosește zilele fiecărei luni', () => {
    // 30 nov (1/30 × 30000) + 1 dec (1/31 × 31000)
    const v = allocateFixedCosts(30000, new Date(2026, 10, 30), new Date(2026, 11, 2));
    expect(v).toBe(1000 + Math.round(30000 / 31));
  });
  it('interval gol → 0', () => {
    expect(allocateFixedCosts(30000, new Date(2026, 10, 2), new Date(2026, 10, 2))).toBe(0);
  });
});

describe('summarize', () => {
  const rB = rideB.result;

  it('astăzi: totaluri, cheltuieli separate de bonurile de energie, costuri fixe pe o zi', () => {
    const s = summarize({
      rides: [rideA, rideB, rideYesterday],
      expenses,
      fixedCosts,
      range: resolvePeriod({ kind: 'today' }, now),
      now,
      taxReservePct: 10,
    });
    expect(s.rideCount).toBe(2);
    expect(s.grossIncomeMinor).toBe(3500 + 5000);
    expect(s.commissionMinor).toBe(875 + rB.commissionMinor);
    expect(s.energyEstimatedMinor).toBe(277 + rB.energyCostMinor);
    expect(s.wearMinor).toBe(480 + rB.wearCostMinor);
    expect(s.rideProfitMinor).toBe(1868 + rB.profitMinor);
    expect(s.km).toBeCloseTo(12 + 23, 10);
    expect(s.minutes).toBe(27 + 36);
    expect(s.hours).toBeCloseTo(63 / 60, 10);
    expect(s.expensesMinor).toBe(3000); // spălătoria; bonul de încărcare NU
    expect(s.energyPaidMinor).toBe(1000);
    expect(s.fixedCostsAllocatedMinor).toBe(1000);
    expect(s.periodProfitMinor).toBe(1868 + rB.profitMinor - 3000 - 1000);
    expect(s.taxReserveMinor).toBe(Math.round(s.periodProfitMinor * 0.1));
    expect(s.afterReserveMinor).toBe(s.periodProfitMinor - s.taxReserveMinor);
    expect(s.avgProfitPerRideMinor).toBe(Math.round((1868 + rB.profitMinor) / 2));
    expect(s.profitPerKm).toBeCloseTo((1868 + rB.profitMinor) / 100 / 35, 10);
    expect(s.profitPerHour).toBeCloseTo((1868 + rB.profitMinor) / 100 / (63 / 60), 10);
    expect(s.totalCostsMinor).toBe(s.commissionMinor + s.energyEstimatedMinor + s.wearMinor + 3000 + 1000);
  });

  it('luna curentă la 19 noiembrie alocă doar 19/30 din costul fix', () => {
    const s = summarize({ rides: [], expenses: [], fixedCosts, range: resolvePeriod({ kind: 'thisMonth' }, now), now, taxReservePct: 0 });
    expect(s.fixedCostsAllocatedMinor).toBe(19000);
  });

  it('un cost fix contează doar în perioada lui de valabilitate', () => {
    const october = resolvePeriod({ kind: 'month', month: '2026-10' }, now);
    const septemberToOct = [{ monthlyAmountMinor: 31000, activeFrom: new Date(2026, 8, 1), activeUntil: new Date(2026, 9, 11) }];
    // 1–10 octombrie = 10/31 din 31000
    expect(summarize({ rides: [], expenses: [], fixedCosts: septemberToOct, range: october, now, taxReservePct: 0 }).fixedCostsAllocatedMinor).toBe(10000);
    const startsMid = [{ monthlyAmountMinor: 31000, activeFrom: new Date(2026, 9, 22), activeUntil: null }];
    // 22–31 octombrie = 10 zile
    expect(summarize({ rides: [], expenses: [], fixedCosts: startsMid, range: october, now, taxReservePct: 0 }).fixedCostsAllocatedMinor).toBe(10000);
    // oprirea unui cost nu schimbă lunile anterioare
    const stopped = [{ monthlyAmountMinor: 31000, activeFrom: new Date(2026, 0, 1), activeUntil: new Date(2026, 10, 19) }];
    expect(summarize({ rides: [], expenses: [], fixedCosts: stopped, range: october, now, taxReservePct: 0 }).fixedCostsAllocatedMinor).toBe(31000);
  });

  it('fără curse: medii indisponibile, rezerva de taxe 0 la pierdere', () => {
    const s = summarize({ rides: [], expenses, fixedCosts, range: resolvePeriod({ kind: 'thisMonth' }, now), now, taxReservePct: 10 });
    expect(s.rideCount).toBe(0);
    expect(s.avgProfitPerRideMinor).toBeNull();
    expect(s.profitPerKm).toBeNull();
    expect(s.profitPerHour).toBeNull();
    expect(s.periodProfitMinor).toBeLessThan(0);
    expect(s.taxReserveMinor).toBe(0);
  });
});

describe('dailySeries', () => {
  it('o intrare pe zi, cu profitul zilei consecvent cu sumarul', () => {
    const range = resolvePeriod({ kind: 'last7' }, now);
    const series = dailySeries({ rides: [rideA, rideB, rideYesterday], expenses, fixedCosts, range, now });
    expect(series).toHaveLength(7);
    const today = series.at(-1)!;
    expect(today.day).toBe('2026-11-19');
    expect(today.incomeMinor).toBe(8500);
    expect(today.profitMinor).toBe(1868 + rideB.result.profitMinor - 3000 - 1000);
    expect(today.costsMinor).toBe(today.incomeMinor - today.profitMinor);
    const yesterday = series.at(-2)!;
    expect(yesterday.profitMinor).toBe(1868 - 1000);
  });
});

describe('platformComparison', () => {
  it('separă Uber de Bolt', () => {
    const c = platformComparison([rideA, rideB, rideYesterday]);
    expect(c.bolt.rideCount).toBe(1);
    expect(c.uber.rideCount).toBe(2);
    expect(c.bolt.profitPerHour).toBeCloseTo(18.68 / 0.45, 10);
    expect(c.uber.avgCommissionPct).toBeCloseTo(((rideB.result.commissionMinor + 875) / (5000 + 3500)) * 100, 10);
  });
  it('platformă fără curse → valori nule', () => {
    const c = platformComparison([rideA]);
    expect(c.uber.rideCount).toBe(0);
    expect(c.uber.profitPerHour).toBeNull();
    expect(c.uber.avgCommissionPct).toBeNull();
  });
});

describe('rankRides', () => {
  const zero = rec(new Date(2026, 10, 19, 15), 'bolt', { tripKm: 0, pickupKm: 0, tripMin: 0, pickupMin: 0, waitMin: 0, fareMinor: 1000 });
  it('cele mai bune după profit pe oră, fără curse cu metrică lipsă', () => {
    const best = rankRides([rideA, rideB, zero], 'profitPerHour', 10, 'best');
    expect(best).not.toContain(zero);
    expect(best[0]!.result.profitPerHour!).toBeGreaterThanOrEqual(best[1]!.result.profitPerHour!);
  });
  it('cele mai slabe după profit, limitat la n', () => {
    const worst = rankRides([rideA, rideB, zero], 'profit', 1, 'worst');
    expect(worst).toEqual([zero]);
  });
});
