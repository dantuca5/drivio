import { beforeEach, describe, expect, it } from 'vitest';
import { referenceEv, referenceRide, referenceThresholds, referenceWear } from '../../domain/__tests__/fixtures';
import { DrivioDB, db, resetDatabaseForTests } from '../db';
import { BackupError, createBackupJson, getRestorePoint, parseBackup, restoreBackup, undoLastRestore } from '../backup';
import { offerFareMode } from '../entities';
import { createSettings, saveExpense, saveFixedCost, saveRide, saveVehicle, softDeleteRide } from '../repositories';

async function seed() {
  const v = await saveVehicle({ name: 'Tesla', ...referenceEv, ...referenceWear });
  await createSettings({ currency: 'RON', commissionPct: { uber: 25, bolt: 25 }, thresholds: referenceThresholds }, v.id);
  const r1 = await saveRide({ startedAt: new Date(2026, 10, 18, 9), platform: 'uber', vehicleId: v.id, input: referenceRide, note: 'Aeroport; „ș” și ț' });
  const r2 = await saveRide({ startedAt: new Date(2026, 10, 19, 9), platform: 'bolt', vehicleId: v.id, input: { ...referenceRide, fareMinor: 5000 } });
  await softDeleteRide(r2.id);
  await saveExpense({ date: new Date(2026, 10, 19), category: 'carwash', amountMinor: 3000 });
  await saveFixedCost({ name: 'RCA', monthlyAmountMinor: 25000, activeFrom: new Date(2026, 0, 1), activeUntil: null });
  return { v, r1, r2 };
}

beforeEach(async () => {
  await resetDatabaseForTests();
});

describe('backup → restaurare', () => {
  it('restaurarea completă reproduce exact datele (inclusiv coșul și datele calendaristice)', async () => {
    await seed();
    const before = await db.rides.toArray();
    const { json, counts } = await createBackupJson(new Date(2026, 10, 19, 22));
    expect(counts).toEqual({ vehicles: 1, rides: 1, expenses: 1, fixedCosts: 1 });

    await resetDatabaseForTests();
    const parsed = await parseBackup(json);
    expect(parsed.counts.rides).toBe(1);
    expect(parsed.firstRide).toEqual(new Date(2026, 10, 18, 9));
    await restoreBackup(parsed, 'replace');

    const after = await db.rides.toArray();
    expect(after.sort((a, b) => a.id.localeCompare(b.id))).toEqual(before.sort((a, b) => a.id.localeCompare(b.id)));
    expect(after.find((r) => r.note)?.note).toBe('Aeroport; „ș” și ț');
    expect((await db.fixedCosts.toArray())[0]?.activeFrom).toEqual(new Date(2026, 0, 1));
    expect((await db.settings.get('app'))?.commissionPct.uber).toBe(25);
  });

  it('un backup cu setări mai vechi (fără tipul sumei) se restaurează și pornește pe suma netă', async () => {
    await seed();
    const s = await db.settings.get('app');
    delete s!.fareModeByPlatform;
    await db.settings.put(s!);
    const { json } = await createBackupJson();
    await resetDatabaseForTests();
    await restoreBackup(await parseBackup(json), 'replace');
    const restored = await db.settings.get('app');
    expect(restored?.fareModeByPlatform).toBeUndefined();
    expect(offerFareMode(restored!, 'uber')).toBe('net');
  });

  it('respinge un fișier modificat (suma de control) fără să atingă datele', async () => {
    await seed();
    const { json } = await createBackupJson();
    const tampered = json.replace('"fareMinor":3500', '"fareMinor":9999');
    await expect(parseBackup(tampered)).rejects.toThrow(/suma de control/);
  });

  it('respinge fișiere care nu sunt backup-uri sau sunt din versiuni viitoare', async () => {
    await expect(parseBackup('nu e json')).rejects.toBeInstanceOf(BackupError);
    await expect(parseBackup('{"a":1}')).rejects.toThrow(/nu este un backup/);
    await seed();
    const { json } = await createBackupJson();
    const future = JSON.stringify({ ...JSON.parse(json), schemaVersion: 99 });
    await expect(parseBackup(future)).rejects.toThrow(/versiune mai nouă/);
  });

  it('combinarea adaugă înregistrările și păstrează setările actuale', async () => {
    await seed();
    const { json } = await createBackupJson();
    await resetDatabaseForTests();
    const v = await saveVehicle({ name: 'Alt vehicul', ...referenceEv, ...referenceWear });
    await createSettings({ currency: 'EUR', commissionPct: { uber: 20, bolt: 20 }, thresholds: referenceThresholds }, v.id);
    await saveRide({ startedAt: new Date(), platform: 'uber', vehicleId: v.id, input: referenceRide });

    await restoreBackup(await parseBackup(json), 'merge');
    expect(await db.vehicles.count()).toBe(2);
    expect(await db.rides.count()).toBe(3); // 1 locală + 2 din backup (una în coș)
    expect((await db.settings.get('app'))?.currency).toBe('EUR');
  });

  it('restaurarea poate fi anulată', async () => {
    await seed();
    const { json } = await createBackupJson();
    await resetDatabaseForTests();
    const v = await saveVehicle({ name: 'Doar local', ...referenceEv, ...referenceWear });
    await createSettings({ currency: 'RON', commissionPct: { uber: 25, bolt: 25 }, thresholds: referenceThresholds }, v.id);

    await restoreBackup(await parseBackup(json), 'replace');
    expect((await db.vehicles.toArray()).map((x) => x.name)).toEqual(['Tesla']);
    expect(await getRestorePoint()).toBeTruthy();

    await undoLastRestore();
    expect((await db.vehicles.toArray()).map((x) => x.name)).toEqual(['Doar local']);
    expect(await getRestorePoint()).toBeUndefined();
  });
});

describe('migrare v1 → v2', () => {
  it('costurile fixe vechi primesc perioadă de valabilitate', async () => {
    const name = `drivio-mig-${crypto.randomUUID()}`;
    // creează o bază v1 cu un cost fix „activ: false”
    const { default: Dexie } = await import('dexie');
    const old = new Dexie(name);
    old.version(1).stores({ vehicles: 'id, archived', rides: 'id, startedAt, platform, vehicleId', expenses: 'id, date, category', fixedCosts: 'id', settings: 'id' });
    await old.open();
    const created = new Date(2026, 0, 1);
    const updated = new Date(2026, 5, 1);
    await old.table('fixedCosts').bulkAdd([
      { id: 'a', name: 'RCA', monthlyAmountMinor: 100, active: true, createdAt: created, updatedAt: created },
      { id: 'b', name: 'Leasing', monthlyAmountMinor: 200, active: false, createdAt: created, updatedAt: updated },
    ]);
    old.close();

    const upgraded = new DrivioDB(name);
    await upgraded.open();
    const rows = await upgraded.fixedCosts.toArray();
    expect(rows.find((r) => r.id === 'a')).toMatchObject({ activeFrom: created, activeUntil: null });
    expect(rows.find((r) => r.id === 'b')).toMatchObject({ activeFrom: created, activeUntil: updated });
    expect(rows.every((r) => !('active' in r))).toBe(true);
    upgraded.close();
  });
});
