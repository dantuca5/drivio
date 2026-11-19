import { describe, expect, it } from 'vitest';
import { calculateRide, dailySeries, resolvePeriod, summarize } from '../../domain';
import { referenceRide, referenceSnapshot, referenceThresholds } from '../../domain/__tests__/fixtures';
import type { RideEntity } from '../../services/entities';
import { defaultRideFilter, filterRides } from '../historyFilter';

/** ~5 ani × 300 zile × 12 curse/zi = 18.000 de curse: mult peste utilizarea reală. */
function manyRides(n: number): RideEntity[] {
  const out: RideEntity[] = [];
  const start = new Date(2021, 10, 19).getTime();
  for (let i = 0; i < n; i++) {
    const input = { ...referenceRide, fareMinor: 1500 + (i % 37) * 100, tripKm: 3 + (i % 11), tripMin: 8 + (i % 23) };
    out.push({
      id: `r${i}`,
      startedAt: new Date(start + i * 2.4 * 3600_000),
      platform: i % 2 ? 'uber' : 'bolt',
      vehicleId: 'v',
      source: 'manual',
      input,
      commissionOverridden: false,
      note: i % 50 === 0 ? 'Aeroport Otopeni' : undefined,
      snapshot: referenceSnapshot,
      result: calculateRide(input, referenceSnapshot),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }
  return out;
}

const time = (fn: () => unknown) => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

describe('performanță cu 18.000 de curse', () => {
  const rides = manyRides(18_000);
  const now = rides.at(-1)!.startedAt;

  it('sumarul lunii, seria pe 30 de zile și căutarea rămân rapide', () => {
    const month = resolvePeriod({ kind: 'thisMonth' }, now);
    const last30 = resolvePeriod({ kind: 'last30' }, now);
    const tSummary = time(() => summarize({ rides, expenses: [], fixedCosts: [], range: month, now, taxReservePct: 10 }));
    const tSeries = time(() => dailySeries({ rides: rides.filter((r) => r.startedAt >= last30.start), expenses: [], fixedCosts: [], range: last30, now }));
    const tFirstSearch = time(() => filterRides(rides, { ...defaultRideFilter, query: 'o' }, referenceThresholds));
    const tNextKey = time(() => filterRides(rides, { ...defaultRideFilter, query: 'otopeni' }, referenceThresholds));
    const tSort = time(() => filterRides(rides, { ...defaultRideFilter, sort: 'perHourAsc', limit: 10 }, referenceThresholds));
    console.log(
      `sumar ${tSummary.toFixed(1)} ms · serie ${tSeries.toFixed(1)} ms · prima tastă ${tFirstSearch.toFixed(1)} ms · tastele următoare ${tNextKey.toFixed(1)} ms · sortare ${tSort.toFixed(1)} ms`,
    );
    // praguri generoase (iPhone-ul e mai lent decât calculatorul de test, iar testele rulează în paralel)
    expect(tSummary).toBeLessThan(100);
    expect(tSeries).toBeLessThan(150);
    expect(tFirstSearch).toBeLessThan(600);
    expect(tNextKey).toBeLessThan(100);
    expect(tSort).toBeLessThan(200);
    expect(filterRides(rides, { ...defaultRideFilter, query: 'otopeni' }, referenceThresholds)).toHaveLength(360);
  });
});
