import { z } from 'zod';
import { calculateRide, EXPENSE_CATEGORIES, PLATFORMS, rideInputSchema, vehicleSchema } from '../domain';
import { db, SCHEMA_VERSION } from './db';
import type { AppSettings, ExpenseEntity, FixedCostEntity, RideEntity, VehicleEntity } from './entities';

/**
 * Backup complet ca fișier JSON. Conține o versiune de format și o sumă de control
 * (SHA-256), ca un fișier deteriorat sau modificat să fie respins înainte de restaurare.
 */

export interface BackupData {
  settings: AppSettings | null;
  vehicles: VehicleEntity[];
  rides: RideEntity[];
  expenses: ExpenseEntity[];
  fixedCosts: FixedCostEntity[];
}

export interface BackupFile {
  app: 'drivio';
  kind: 'backup';
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  data: BackupData;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readAllData(): Promise<BackupData> {
  return db.transaction('r', [db.settings, db.vehicles, db.rides, db.expenses, db.fixedCosts], async () => ({
    settings: (await db.settings.get('app')) ?? null,
    vehicles: await db.vehicles.toArray(),
    rides: await db.rides.toArray(),
    expenses: await db.expenses.toArray(),
    fixedCosts: await db.fixedCosts.toArray(),
  }));
}

/** Construiește textul fișierului de backup. */
export async function createBackupJson(now = new Date()): Promise<{ json: string; counts: BackupCounts }> {
  const data = await readAllData();
  const dataJson = JSON.stringify(data);
  const file = {
    app: 'drivio',
    kind: 'backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    checksum: await sha256(dataJson),
    data: JSON.parse(dataJson) as unknown,
  };
  return { json: JSON.stringify(file), counts: countsOf(data) };
}

export interface BackupCounts {
  vehicles: number;
  rides: number;
  expenses: number;
  fixedCosts: number;
}

const countsOf = (d: BackupData): BackupCounts => ({
  vehicles: d.vehicles.length,
  rides: d.rides.filter((r) => r.deletedAt === null).length,
  expenses: d.expenses.filter((e) => e.deletedAt === null).length,
  fixedCosts: d.fixedCosts.length,
});

// ---------- Validare la import ----------

const date = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Dată invalidă');
const nullableDate = z.union([z.null(), date]);
const finite = z.number().refine(Number.isFinite);
const nullableFinite = z.union([z.null(), finite]);

const snapshotSchema = z.object({ commissionPct: finite, energyCostPerKm: finite, wearCostPerKm: finite });
const resultSchema = z.object({
  grossFareMinor: finite,
  commissionMinor: finite,
  grossIncomeMinor: finite,
  incomeAfterCommissionMinor: finite,
  energyCostMinor: finite,
  wearCostMinor: finite,
  vehicleCostMinor: finite,
  totalCostMinor: finite,
  profitMinor: finite,
  totalKm: finite,
  totalMin: finite,
  profitPerKm: nullableFinite,
  profitPerHour: nullableFinite,
  realCostPerKm: nullableFinite,
  yieldPct: nullableFinite,
});
const timestamps = { createdAt: date, updatedAt: date };
const platform = z.enum(PLATFORMS as [string, ...string[]]);

const rideSchema = z.object({
  id: z.string().min(1),
  startedAt: date,
  platform,
  vehicleId: z.string().min(1),
  source: z.enum(['manual', 'import']),
  input: rideInputSchema,
  commissionOverridden: z.boolean(),
  note: z.string().max(200).optional(),
  snapshot: snapshotSchema,
  result: resultSchema,
  deletedAt: nullableDate,
  ...timestamps,
});

const vehicleEntitySchema = z.intersection(
  vehicleSchema,
  z.object({ id: z.string().min(1), archived: z.boolean(), ...timestamps }),
);

const expenseEntitySchema = z.object({
  id: z.string().min(1),
  date,
  category: z.enum(EXPENSE_CATEGORIES as [string, ...string[]]),
  amountMinor: z.number().int().positive(),
  vehicleId: z.string().optional(),
  note: z.string().max(200).optional(),
  deletedAt: nullableDate,
  ...timestamps,
});

const fixedCostEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  monthlyAmountMinor: z.number().int().nonnegative(),
  activeFrom: date,
  activeUntil: nullableDate,
  ...timestamps,
});

const settingsSchema = z.object({
  id: z.literal('app'),
  currency: z.string().regex(/^[A-Z]{3}$/),
  theme: z.enum(['system', 'light', 'dark']),
  commissionPct: z.object({ uber: finite, bolt: finite }),
  thresholds: z.object({ redBelowPerHour: finite, greenFromPerHour: finite, redBelowPerKm: finite, greenFromPerKm: finite }),
  goals: z.object({ dailyMinor: z.union([z.null(), z.number().int()]), monthlyMinor: z.union([z.null(), z.number().int()]) }),
  taxReservePct: finite,
  activeVehicleId: z.union([z.null(), z.string()]),
  lastPlatform: platform,
  backupReminderDays: z.number().int().min(1).max(365),
  lastBackupAt: nullableDate,
  ...timestamps,
});

const fileSchema = z.object({
  app: z.literal('drivio'),
  kind: z.literal('backup'),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  data: z.unknown(),
});

const dataSchema = z.object({
  settings: z.union([z.null(), settingsSchema]),
  vehicles: z.array(vehicleEntitySchema),
  rides: z.array(rideSchema),
  expenses: z.array(expenseEntitySchema),
  fixedCosts: z.array(fixedCostEntitySchema),
});

export class BackupError extends Error {
  override name = 'BackupError';
}

export interface ParsedBackup {
  exportedAt: Date;
  schemaVersion: number;
  data: BackupData;
  counts: BackupCounts;
  /** prima și ultima cursă, pentru previzualizare */
  firstRide: Date | null;
  lastRide: Date | null;
}

/** Citește și verifică un fișier de backup. Aruncă BackupError cu un mesaj clar dacă nu e valid. */
export async function parseBackup(text: string): Promise<ParsedBackup> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Fișierul nu este un backup Drivio (nu e JSON valid).');
  }
  const file = fileSchema.safeParse(raw);
  if (!file.success) throw new BackupError('Fișierul nu este un backup Drivio.');
  if (file.data.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('Backup-ul a fost făcut cu o versiune mai nouă a aplicației. Actualizează aplicația, apoi încearcă din nou.');
  }
  if ((await sha256(JSON.stringify(file.data.data))) !== file.data.checksum) {
    throw new BackupError('Fișierul este deteriorat sau a fost modificat (suma de control nu se potrivește). Nu a fost restaurat nimic.');
  }
  const data = dataSchema.safeParse(migrateData(file.data.data, file.data.schemaVersion));
  if (!data.success) {
    const issue = data.error.issues[0];
    throw new BackupError(`Backup-ul conține date invalide${issue ? ` (${issue.path.join('.')})` : ''}. Nu a fost restaurat nimic.`);
  }
  const d = data.data as unknown as BackupData;

  // Verificare de integritate: rezultatul fiecărei curse trebuie să corespundă datelor ei.
  const broken = d.rides.filter((r) => {
    try {
      return calculateRide(r.input, r.snapshot).profitMinor !== r.result.profitMinor;
    } catch {
      return true;
    }
  });
  if (broken.length > 0) throw new BackupError(`${broken.length} curse din backup au calcule care nu se potrivesc. Nu a fost restaurat nimic.`);

  const times = d.rides.map((r) => r.startedAt.getTime());
  return {
    exportedAt: new Date(file.data.exportedAt),
    schemaVersion: file.data.schemaVersion,
    data: d,
    counts: countsOf(d),
    firstRide: times.length ? new Date(Math.min(...times)) : null,
    lastRide: times.length ? new Date(Math.max(...times)) : null,
  };
}

/** Aduce datele dintr-un backup mai vechi la formatul curent. */
function migrateData(data: unknown, version: number): unknown {
  if (version >= 2 || typeof data !== 'object' || data === null) return data;
  const d = data as Record<string, unknown>;
  const fixed = Array.isArray(d.fixedCosts) ? d.fixedCosts : [];
  return {
    ...d,
    fixedCosts: fixed.map((f: Record<string, unknown>) => ({
      ...f,
      activeFrom: f.activeFrom ?? f.createdAt,
      activeUntil: f.activeUntil ?? (f.active === false ? f.updatedAt : null),
    })),
  };
}

export type RestoreMode = 'replace' | 'merge';

/**
 * Restaurează un backup verificat, într-o singură tranzacție (totul sau nimic).
 * Înainte salvează automat starea curentă ca punct de restaurare, ca operația să poată fi anulată.
 *  - replace: datele de pe telefon sunt înlocuite complet;
 *  - merge: înregistrările din backup se adaugă; cele cu același id sunt actualizate; setările actuale rămân.
 */
export async function restoreBackup(backup: ParsedBackup, mode: RestoreMode, now = new Date()): Promise<void> {
  const { json } = await createBackupJson(now);
  const d = backup.data;
  await db.transaction('rw', [db.settings, db.vehicles, db.rides, db.expenses, db.fixedCosts, db.restorePoints], async () => {
    await db.restorePoints.clear();
    await db.restorePoints.add({ id: crypto.randomUUID(), createdAt: now, backupJson: json });

    if (mode === 'replace') {
      await Promise.all([db.settings.clear(), db.vehicles.clear(), db.rides.clear(), db.expenses.clear(), db.fixedCosts.clear()]);
      if (d.settings) await db.settings.put(d.settings);
    } else if (d.settings && !(await db.settings.get('app'))) {
      await db.settings.put(d.settings);
    }
    await db.vehicles.bulkPut(d.vehicles);
    await db.rides.bulkPut(d.rides);
    await db.expenses.bulkPut(d.expenses);
    await db.fixedCosts.bulkPut(d.fixedCosts);

    // vehiculul activ trebuie să existe
    const settings = await db.settings.get('app');
    if (settings && settings.activeVehicleId && !(await db.vehicles.get(settings.activeVehicleId))) {
      const first = await db.vehicles.filter((v) => !v.archived).first();
      await db.settings.update('app', { activeVehicleId: first?.id ?? null });
    }
  });
}

export async function getRestorePoint() {
  return db.restorePoints.orderBy('createdAt').last();
}

/** Revine la datele de dinaintea ultimei restaurări. */
export async function undoLastRestore(): Promise<void> {
  const point = await getRestorePoint();
  if (!point) throw new BackupError('Nu există o restaurare de anulat.');
  const parsed = await parseBackup(point.backupJson);
  const d = parsed.data;
  await db.transaction('rw', [db.settings, db.vehicles, db.rides, db.expenses, db.fixedCosts, db.restorePoints], async () => {
    await Promise.all([db.settings.clear(), db.vehicles.clear(), db.rides.clear(), db.expenses.clear(), db.fixedCosts.clear()]);
    if (d.settings) await db.settings.put(d.settings);
    await db.vehicles.bulkPut(d.vehicles);
    await db.rides.bulkPut(d.rides);
    await db.expenses.bulkPut(d.expenses);
    await db.fixedCosts.bulkPut(d.fixedCosts);
    await db.restorePoints.clear();
  });
}

export async function markBackupDone(at = new Date()): Promise<void> {
  await db.settings.update('app', { lastBackupAt: at });
}
