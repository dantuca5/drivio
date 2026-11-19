import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { minFarePerPaidKm, minGrossPerHour } from '../minRate';

const base = { costPerKm: 0.6312, targetProfitPerHour: 40, avgSpeedKmh: 25, emptyKmPct: 20, commissionPct: 25 };

describe('minFarePerPaidKm', () => {
  it('exemplu: (0,6312 + 40/25) / (0,8 × 0,75) = 3,7187', () => {
    expect(minFarePerPaidKm(base)).toBeCloseTo((0.6312 + 1.6) / 0.6, 10);
  });

  it('include costurile fixe pe oră', () => {
    expect(minFarePerPaidKm({ ...base, fixedCostPerHour: 5 })).toBeCloseTo((0.6312 + 45 / 25) / 0.6, 10);
  });

  it('viteză 0 sau 100% km goi → indisponibil', () => {
    expect(minFarePerPaidKm({ ...base, avgSpeedKmh: 0 })).toBeNull();
    expect(minFarePerPaidKm({ ...base, emptyKmPct: 100 })).toBeNull();
  });

  it('verificare inversă: o tură la tariful minim dă exact profitul țintă pe oră', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 3, noNaN: true }),
        fc.double({ min: 1, max: 200, noNaN: true }),
        fc.double({ min: 5, max: 90, noNaN: true }),
        fc.double({ min: 0, max: 80, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (costPerKm, target, speed, empty, commission) => {
          const fare = minFarePerPaidKm({
            costPerKm,
            targetProfitPerHour: target,
            avgSpeedKmh: speed,
            emptyKmPct: empty,
            commissionPct: commission,
          });
          expect(fare).not.toBeNull();
          const paidKm = 1;
          const totalKm = paidKm / (1 - empty / 100);
          const hours = totalKm / speed;
          const profit = fare! * paidKm * (1 - commission / 100) - costPerKm * totalKm;
          expect(profit / hours).toBeCloseTo(target, 6);
        },
      ),
    );
  });
});

describe('minGrossPerHour', () => {
  const h = { costPerKm: 0.6312, targetProfitPerHour: 40, kmPerWorkHour: 20, commissionPct: 25 };

  it('pe oră de lucru: (40 + 20 × 0,6312) / 0,75', () => {
    expect(minGrossPerHour(h).perWorkHour).toBeCloseTo((40 + 12.624) / 0.75, 10);
    expect(minGrossPerHour(h).perPaidHour).toBeNull();
  });

  it('pe oră cu client, dacă știi procentul de timp cu client', () => {
    const r = minGrossPerHour({ ...h, paidTimePct: 60 });
    expect(r.perPaidHour).toBeCloseTo(r.perWorkHour / 0.6, 10);
  });

  it('procent 0 cu client → indisponibil', () => {
    expect(minGrossPerHour({ ...h, paidTimePct: 0 }).perPaidHour).toBeNull();
  });

  it('respinge comision ≥ 100%', () => {
    expect(() => minGrossPerHour({ ...h, commissionPct: 100 })).toThrow();
  });
});
