import { describe, expect, it } from 'vitest';
import { calculateRide, resolvePeriod } from '../../domain';
import { referenceRide, referenceSnapshot, referenceThresholds } from '../../domain/__tests__/fixtures';
import type { RideEntity } from '../../services/entities';
import { defaultRideFilter, filterRides, normalize } from '../historyFilter';

let n = 0;
const ride = (patch: Partial<RideEntity> & { fare?: number; min?: number } = {}): RideEntity => {
  const { fare, min, ...rest } = patch;
  const input = { ...referenceRide, ...(fare !== undefined ? { fareMinor: fare } : {}), ...(min !== undefined ? { tripMin: min } : {}) };
  n += 1;
  return {
    id: `r${n}`,
    startedAt: new Date(2026, 10, 19, 8 + n),
    platform: 'uber',
    vehicleId: 'v',
    source: 'manual',
    input,
    commissionOverridden: false,
    snapshot: referenceSnapshot,
    result: calculateRide(input, referenceSnapshot),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...rest,
  };
};

const a = ride({ note: 'Aeroport Otopeni' }); // 41,51/oră → verde
const b = ride({ platform: 'bolt', fare: 1500 }); // pierdere mică → roșu
const c = ride({ platform: 'bolt', note: 'Ștefan cel Mare', min: 23 }); // 30 min → 37,36/oră → galben
const zero = ride({ fare: 1000, min: 0, ...{} });
zero.input = { ...zero.input, tripKm: 0, pickupKm: 0, tripMin: 0, pickupMin: 0, waitMin: 0 };
zero.result = calculateRide(zero.input, referenceSnapshot);
const deleted = ride({ deletedAt: new Date() });
const all = [a, b, c, zero, deleted];
const run = (patch: Partial<typeof defaultRideFilter>) => filterRides(all, { ...defaultRideFilter, ...patch }, referenceThresholds).map((r) => r.id);

describe('filterRides', () => {
  it('implicit: cele mai noi primele, fără coș', () => {
    expect(run({})).toEqual([zero.id, c.id, b.id, a.id]);
  });
  it('căutare fără diacritice și după mai multe cuvinte', () => {
    expect(run({ query: 'stefan' })).toEqual([c.id]);
    expect(run({ query: 'aeroport otopeni' })).toEqual([a.id]);
    expect(run({ query: 'bolt mare' })).toEqual([c.id]);
    expect(run({ query: '35,00' })).toEqual(expect.arrayContaining([a.id, c.id]));
  });
  it('filtru platformă și verdict', () => {
    expect(run({ platform: 'bolt' })).toEqual([c.id, b.id]);
    expect(run({ verdict: 'go' })).toEqual([a.id]);
    expect(run({ verdict: 'slow' })).toEqual(expect.arrayContaining([c.id]));
    expect(run({ verdict: 'stop' })).toEqual([b.id]);
  });
  it('cele mai bune și cele mai slabe pe oră, fără curse cu 0 minute', () => {
    expect(run({ sort: 'perHourDesc', limit: 2 })).toEqual([a.id, c.id]);
    expect(run({ sort: 'perHourAsc', limit: 1 })).toEqual([b.id]);
    expect(run({ sort: 'perHourDesc' })).not.toContain(zero.id);
  });
  it('perioadă', () => {
    const other = ride({ startedAt: new Date(2026, 9, 1) });
    const r = filterRides([a, other], { ...defaultRideFilter, range: resolvePeriod({ kind: 'month', month: '2026-10' }, new Date()) }, referenceThresholds);
    expect(r.map((x) => x.id)).toEqual([other.id]);
  });
  it('normalize', () => {
    expect(normalize('ȘȚĂÎÂ şţ')).toBe('staia st');
  });
});
