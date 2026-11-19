import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateRide } from '../rideCalc';
import type { RideResult } from '../types';
import { referenceRide, referenceSnapshot } from './fixtures';

describe('calculateRide — exemplul de referință', () => {
  const r = calculateRide(referenceRide, referenceSnapshot);

  it('componentele în bani', () => {
    expect(r.grossFareMinor).toBe(3500);
    expect(r.commissionMinor).toBe(875);
    expect(r.grossIncomeMinor).toBe(3500);
    expect(r.incomeAfterCommissionMinor).toBe(2625);
    expect(r.energyCostMinor).toBe(277); // 12 km × 0,2312 = 2,7744
    expect(r.wearCostMinor).toBe(480);
    expect(r.vehicleCostMinor).toBe(757);
    expect(r.totalCostMinor).toBe(1632);
    expect(r.profitMinor).toBe(1868);
  });

  it('km și minute includ preluarea și așteptarea', () => {
    expect(r.totalKm).toBe(12);
    expect(r.totalMin).toBe(27);
  });

  it('rapoartele pornesc de la profitul afișat (18,68)', () => {
    expect(r.profitPerKm).toBeCloseTo(18.68 / 12, 10);
    expect(r.profitPerHour).toBeCloseTo(18.68 / (27 / 60), 10); // 41,511…
    expect(r.realCostPerKm).toBeCloseTo(7.57 / 12, 10);
    expect(r.yieldPct).toBeCloseTo((1868 / 3500) * 100, 10); // 53,37 %
  });
});

describe('calculateRide — moduri și cazuri limită', () => {
  it('suma netă se convertește în brut', () => {
    const r = calculateRide({ ...referenceRide, fareMinor: 2625, fareMode: 'net' }, referenceSnapshot);
    expect(r.grossFareMinor).toBe(3500);
    expect(r.commissionMinor).toBe(875);
    expect(r.profitMinor).toBe(1868);
  });

  it('suma netă cu comision 0% → comision 0', () => {
    const r = calculateRide({ ...referenceRide, fareMinor: 2000, fareMode: 'net' }, { ...referenceSnapshot, commissionPct: 0 });
    expect(r.grossFareMinor).toBe(2000);
    expect(r.commissionMinor).toBe(0);
  });

  it('bacșișul și bonusul nu se comisionează', () => {
    const r = calculateRide({ ...referenceRide, tipMinor: 500, bonusMinor: 300 }, referenceSnapshot);
    expect(r.commissionMinor).toBe(875);
    expect(r.grossIncomeMinor).toBe(4300);
    expect(r.profitMinor).toBe(1868 + 800);
  });

  it('costul de energie suprascris se folosește exact', () => {
    const r = calculateRide({ ...referenceRide, energyCostOverrideMinor: 400 }, referenceSnapshot);
    expect(r.energyCostMinor).toBe(400);
    expect(r.profitMinor).toBe(3500 - 875 - 400 - 480);
  });

  it('cursă cu 0 km și 0 minute (taxă de anulare) nu produce NaN', () => {
    const r = calculateRide(
      { ...referenceRide, fareMinor: 1000, tripKm: 0, tripMin: 0, pickupKm: 0, pickupMin: 0, waitMin: 0 },
      referenceSnapshot,
    );
    expect(r.profitPerKm).toBeNull();
    expect(r.profitPerHour).toBeNull();
    expect(r.realCostPerKm).toBeNull();
    expect(r.profitMinor).toBe(750);
  });

  it('venit 0 → randament indisponibil', () => {
    const r = calculateRide({ ...referenceRide, fareMinor: 0 }, referenceSnapshot);
    expect(r.yieldPct).toBeNull();
    expect(r.profitMinor).toBe(-757);
  });

  it('respinge valori negative sau nefinite', () => {
    expect(() => calculateRide({ ...referenceRide, tripKm: -1 }, referenceSnapshot)).toThrow();
    expect(() => calculateRide({ ...referenceRide, tripMin: Number.NaN }, referenceSnapshot)).toThrow();
    expect(() => calculateRide(referenceRide, { ...referenceSnapshot, commissionPct: 100 })).toThrow();
  });
});

describe('calculateRide — invarianți (proprietăți)', () => {
  const ride = fc.record({
    fareMinor: fc.integer({ min: 0, max: 1_000_000 }),
    fareMode: fc.constantFrom('gross' as const, 'net' as const),
    tripKm: fc.double({ min: 0, max: 2000, noNaN: true }),
    tripMin: fc.double({ min: 0, max: 1440, noNaN: true }),
    pickupKm: fc.double({ min: 0, max: 500, noNaN: true }),
    pickupMin: fc.double({ min: 0, max: 600, noNaN: true }),
    waitMin: fc.double({ min: 0, max: 600, noNaN: true }),
    tipMinor: fc.integer({ min: 0, max: 100_000 }),
    bonusMinor: fc.integer({ min: 0, max: 100_000 }),
  });
  const snap = fc.record({
    commissionPct: fc.double({ min: 0, max: 99.9, noNaN: true }),
    energyCostPerKm: fc.double({ min: 0, max: 5, noNaN: true }),
    wearCostPerKm: fc.double({ min: 0, max: 5, noNaN: true }),
  });

  const allFinite = (r: RideResult) =>
    Object.values(r).every((v) => v === null || (typeof v === 'number' && Number.isFinite(v)));

  it('profit = venit brut − cost total; cost total = comision + cost mașină; totul finit', () => {
    fc.assert(
      fc.property(ride, snap, (i, s) => {
        const r = calculateRide(i, s);
        expect(r.profitMinor).toBe(r.grossIncomeMinor - r.totalCostMinor);
        expect(r.totalCostMinor).toBe(r.commissionMinor + r.vehicleCostMinor);
        expect(r.vehicleCostMinor).toBe(r.energyCostMinor + r.wearCostMinor);
        expect(r.incomeAfterCommissionMinor).toBe(r.grossIncomeMinor - r.commissionMinor);
        expect(Number.isInteger(r.profitMinor)).toBe(true);
        expect(allFinite(r)).toBe(true);
      }),
    );
  });

  it('comisionul nu depășește tariful brut și nu e negativ', () => {
    fc.assert(
      fc.property(ride, snap, (i, s) => {
        const r = calculateRide(i, s);
        expect(r.commissionMinor).toBeGreaterThanOrEqual(0);
        expect(r.commissionMinor).toBeLessThanOrEqual(r.grossFareMinor);
      }),
    );
  });
});
