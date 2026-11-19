import { beforeEach, describe, expect, it } from 'vitest';
import { referenceEv, referenceRide, referenceThresholds, referenceWear } from '../../domain/__tests__/fixtures';
import { db, resetDatabaseForTests } from '../db';
import {
  createSettings,
  deleteForever,
  listRides,
  listTrash,
  purgeOldTrash,
  restoreRide,
  saveExpense,
  saveFixedCost,
  saveRide,
  saveVehicle,
  softDeleteRide,
  stopFixedCost,
  updateSettings,
  ValidationError,
} from '../repositories';

async function setup() {
  const vehicle = await saveVehicle({ name: 'Tesla Model 3', ...referenceEv, ...referenceWear });
  await createSettings(
    { currency: 'RON', commissionPct: { uber: 25, bolt: 20 }, thresholds: referenceThresholds },
    vehicle.id,
  );
  return vehicle;
}

beforeEach(async () => {
  await resetDatabaseForTests();
});

describe('saveRide', () => {
  it('calculează cu comisionul platformei și salvează instantaneul', async () => {
    const v = await setup();
    const ride = await saveRide({ startedAt: new Date(2026, 10, 19, 10), platform: 'uber', vehicleId: v.id, input: referenceRide });
    expect(ride.snapshot.commissionPct).toBe(25);
    expect(ride.result.profitMinor).toBe(1868);
    expect(ride.commissionOverridden).toBe(false);
    expect((await db.rides.get(ride.id))?.result.profitMinor).toBe(1868);
  });

  it('istoricul nu se schimbă când se schimbă setările sau vehiculul', async () => {
    const v = await setup();
    const ride = await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });
    await updateSettings({ commissionPct: { uber: 40, bolt: 40 } });
    await saveVehicle({ name: 'Tesla Model 3', ...referenceEv, ...referenceWear, homePricePerKWh: 3 }, v.id);
    const stored = await db.rides.get(ride.id);
    expect(stored?.snapshot.commissionPct).toBe(25);
    expect(stored?.result.profitMinor).toBe(1868);
  });

  it('comisionul modificat pe cursă e marcat', async () => {
    const v = await setup();
    const ride = await saveRide({ startedAt: new Date(), platform: 'bolt', vehicleId: v.id, input: referenceRide, commissionPct: 25 });
    expect(ride.commissionOverridden).toBe(true);
    expect(ride.result.commissionMinor).toBe(875);
  });

  it('reține ultima platformă folosită', async () => {
    const v = await setup();
    await saveRide({ startedAt: new Date(), platform: 'bolt', vehicleId: v.id, input: referenceRide });
    expect((await db.settings.get('app'))?.lastPlatform).toBe('bolt');
  });

  it('respinge date invalide fără să scrie nimic', async () => {
    const v = await setup();
    await expect(
      saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: { ...referenceRide, tripKm: -5 } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: 'inexistent', input: referenceRide }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.rides.count()).toBe(0);
  });

  it('editarea păstrează costurile de atunci; „recalculează” le actualizează', async () => {
    const v = await setup();
    const first = await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });
    await updateSettings({ commissionPct: { uber: 40, bolt: 40 } });
    await saveVehicle({ name: 'Tesla Model 3', ...referenceEv, ...referenceWear, maintenancePerKm: 1 }, v.id);

    const kept = await saveRide({ startedAt: first.startedAt, platform: 'uber', vehicleId: v.id, input: referenceRide, note: 'doar o notă' }, first.id);
    expect(kept.snapshot).toEqual(first.snapshot);
    expect(kept.result.profitMinor).toBe(1868);

    const recalculated = await saveRide({ startedAt: first.startedAt, platform: 'uber', vehicleId: v.id, input: referenceRide, recalculate: true }, first.id);
    expect(recalculated.snapshot.commissionPct).toBe(40);
    expect(recalculated.snapshot.wearCostPerKm).toBeCloseTo(1.3, 10);
  });

  it('schimbarea platformei la editare folosește comisionul noii platforme', async () => {
    const v = await setup();
    const first = await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });
    const moved = await saveRide({ startedAt: first.startedAt, platform: 'bolt', vehicleId: v.id, input: referenceRide }, first.id);
    expect(moved.snapshot.commissionPct).toBe(20);
    expect(moved.snapshot.energyCostPerKm).toBe(first.snapshot.energyCostPerKm);
  });

  it('editarea păstrează id-ul și data creării', async () => {
    const v = await setup();
    const first = await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });
    const edited = await saveRide({ startedAt: first.startedAt, platform: 'uber', vehicleId: v.id, input: { ...referenceRide, fareMinor: 4000 } }, first.id);
    expect(edited.id).toBe(first.id);
    expect(edited.createdAt).toEqual(first.createdAt);
    expect(await db.rides.count()).toBe(1);
  });
});

describe('listRides și coșul', () => {
  it('listează cele mai noi primele și ascunde cursele din coș', async () => {
    const v = await setup();
    const a = await saveRide({ startedAt: new Date(2026, 10, 19, 9), platform: 'uber', vehicleId: v.id, input: referenceRide });
    const b = await saveRide({ startedAt: new Date(2026, 10, 19, 12), platform: 'bolt', vehicleId: v.id, input: referenceRide });
    await saveRide({ startedAt: new Date(2026, 10, 18, 12), platform: 'bolt', vehicleId: v.id, input: referenceRide });
    const range: [Date, Date] = [new Date(2026, 10, 19), new Date(2026, 10, 20)];
    expect((await listRides(...range)).map((r) => r.id)).toEqual([b.id, a.id]);
    await softDeleteRide(b.id);
    expect((await listRides(...range)).map((r) => r.id)).toEqual([a.id]);
    await restoreRide(b.id);
    expect(await listRides(...range)).toHaveLength(2);
  });
});

describe('cheltuieli, costuri fixe și coș', () => {
  it('cheltuiala invalidă e respinsă, cea validă se salvează', async () => {
    await setup();
    await expect(saveExpense({ date: new Date(), category: 'service', amountMinor: 0 })).rejects.toBeInstanceOf(ValidationError);
    const e = await saveExpense({ date: new Date(2026, 10, 19), category: 'service', amountMinor: 25000, note: '  Revizie ' });
    expect(e.note).toBe('Revizie');
  });

  it('oprirea unui cost fix îi setează data de sfârșit', async () => {
    await setup();
    const f = await saveFixedCost({ name: 'Leasing', monthlyAmountMinor: 150000, activeFrom: new Date(2026, 0, 1), activeUntil: null });
    await stopFixedCost(f.id, new Date(2026, 10, 20));
    expect((await db.fixedCosts.get(f.id))?.activeUntil).toEqual(new Date(2026, 10, 20));
  });

  it('coșul: listare, ștergere definitivă doar din coș, golire automată după 30 de zile', async () => {
    const v = await setup();
    const keep = await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });
    const old = await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });
    const recent = await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });
    await db.rides.update(old.id, { deletedAt: new Date(2026, 9, 1) });
    await db.rides.update(recent.id, { deletedAt: new Date(2026, 10, 18) });

    expect((await listTrash()).rides.map((r) => r.id)).toEqual([recent.id, old.id]);
    await expect(deleteForever('ride', keep.id)).rejects.toThrow(/coș/);

    expect(await purgeOldTrash(new Date(2026, 10, 19))).toBe(1);
    expect(await db.rides.get(old.id)).toBeUndefined();
    expect(await db.rides.get(recent.id)).toBeTruthy();

    await deleteForever('ride', recent.id);
    expect(await db.rides.count()).toBe(1);
  });
});

describe('saveVehicle', () => {
  it('respinge un vehicul incomplet cu erori pe câmpuri', async () => {
    try {
      await saveVehicle({ name: '', ...referenceEv, ...referenceWear });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).fieldErrors.name).toMatch(/obligatoriu/);
    }
  });
});
