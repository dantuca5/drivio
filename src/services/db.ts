import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, ExpenseEntity, FixedCostEntity, RestorePointEntity, RideEntity, VehicleEntity } from './entities';

/**
 * Baza de date locală. Fiecare schimbare de structură primește o versiune nouă
 * (cu migrare dacă e nevoie), niciodată o modificare a unei versiuni existente.
 */
export class DrivioDB extends Dexie {
  vehicles!: EntityTable<VehicleEntity, 'id'>;
  rides!: EntityTable<RideEntity, 'id'>;
  expenses!: EntityTable<ExpenseEntity, 'id'>;
  fixedCosts!: EntityTable<FixedCostEntity, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  restorePoints!: EntityTable<RestorePointEntity, 'id'>;

  constructor(name = 'drivio') {
    super(name);
    this.version(1).stores({
      vehicles: 'id, archived',
      rides: 'id, startedAt, platform, vehicleId',
      expenses: 'id, date, category',
      fixedCosts: 'id',
      settings: 'id',
    });
    // v2: punct de restaurare; costurile fixe primesc perioadă de valabilitate în loc de „activ”.
    this.version(2)
      .stores({ restorePoints: 'id, createdAt' })
      .upgrade(async (tx) => {
        await tx
          .table('fixedCosts')
          .toCollection()
          .modify((f: Record<string, unknown>) => {
            if (!('activeFrom' in f)) {
              f.activeFrom = f.createdAt ?? new Date();
              f.activeUntil = f.active === false ? (f.updatedAt ?? new Date()) : null;
              delete f.active;
            }
          });
      });
  }
}

/** Versiunea formatului de date (și a fișierelor de backup). */
export const SCHEMA_VERSION = 2;

export let db = new DrivioDB();

/** Doar pentru teste: o bază de date curată, izolată. */
export async function resetDatabaseForTests(name = `drivio-test-${crypto.randomUUID()}`): Promise<DrivioDB> {
  db.close();
  db = new DrivioDB(name);
  await db.open();
  return db;
}

/** Cere browserului să nu șteargă datele când spațiul e puțin (iOS 17+, Chrome). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
