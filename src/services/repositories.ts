import {
  buildCostSnapshot,
  calculateRide,
  commissionPctSchema,
  expenseSchema,
  fixedCostSchema,
  rideInputSchema,
  vehicleSchema,
  type ExpenseCategory,
  type Platform,
  type RideInput,
} from '../domain';
import { db } from './db';
import { DEFAULT_FARE_MODE_BY_PLATFORM, type AppSettings, type ExpenseEntity, type FixedCostEntity, type RideEntity, type VehicleData, type VehicleEntity } from './entities';

/** Eroare de validare cu mesajele pentru utilizator, pe câmpuri. */
export class ValidationError extends Error {
  override name = 'ValidationError';
  constructor(public readonly fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? 'Date invalide.');
  }
}

function issuesToFieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join('.') || '_';
    out[key] ??= i.message;
  }
  return out;
}

const newId = () => crypto.randomUUID();

// ---------- Setări ----------

export async function getSettings(): Promise<AppSettings | undefined> {
  return db.settings.get('app');
}

export type InitialSettings = Pick<AppSettings, 'commissionPct' | 'thresholds' | 'currency' | 'fareModeByPlatform'>;

/** Creează setările la finalul ghidului de pornire. Valorile financiare vin de la utilizator. */
export async function createSettings(initial: InitialSettings, activeVehicleId: string): Promise<AppSettings> {
  const now = new Date();
  const settings: AppSettings = {
    id: 'app',
    currency: initial.currency,
    theme: 'system',
    commissionPct: initial.commissionPct,
    thresholds: initial.thresholds,
    goals: { dailyMinor: null, monthlyMinor: null },
    taxReservePct: 0,
    activeVehicleId,
    lastPlatform: 'uber',
    fareModeByPlatform: { ...(initial.fareModeByPlatform ?? DEFAULT_FARE_MODE_BY_PLATFORM) },
    backupReminderDays: 7,
    lastBackupAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.settings.put(settings);
  return settings;
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id' | 'createdAt'>>): Promise<void> {
  const updated = await db.settings.update('app', { ...patch, updatedAt: new Date() });
  if (updated === 0) throw new Error('Setările nu există încă.');
}

// ---------- Vehicule ----------

export async function saveVehicle(data: VehicleData, id?: string): Promise<VehicleEntity> {
  const parsed = vehicleSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError(issuesToFieldErrors(parsed.error.issues));
  const now = new Date();
  const existing = id ? await db.vehicles.get(id) : undefined;
  const entity: VehicleEntity = {
    ...parsed.data,
    id: existing?.id ?? newId(),
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.vehicles.put(entity);
  return entity;
}

export async function setVehicleArchived(id: string, archived: boolean): Promise<void> {
  await db.vehicles.update(id, { archived, updatedAt: new Date() });
}

// ---------- Curse ----------

export interface RideDraft {
  startedAt: Date;
  platform: Platform;
  vehicleId: string;
  input: RideInput;
  /** dacă lipsește se folosește comisionul platformei din setări */
  commissionPct?: number;
  note?: string;
  /**
   * Doar la editare: true = recalculează cu costurile și comisionul actuale.
   * Implicit o cursă editată își păstrează costurile de atunci (dacă vehiculul și platforma nu se schimbă).
   */
  recalculate?: boolean;
}

/**
 * Validează, calculează și salvează o cursă. Cursa păstrează instantaneul valorilor
 * folosite, ca modificările ulterioare ale setărilor să nu-i schimbe rezultatul.
 */
export async function saveRide(draft: RideDraft, id?: string): Promise<RideEntity> {
  const parsedInput = rideInputSchema.safeParse(draft.input);
  if (!parsedInput.success) throw new ValidationError(issuesToFieldErrors(parsedInput.error.issues));

  return db.transaction('rw', db.rides, db.vehicles, db.settings, async () => {
    const settings = await db.settings.get('app');
    if (!settings) throw new Error('Setările lipsesc. Finalizează ghidul de pornire.');
    const vehicle = await db.vehicles.get(draft.vehicleId);
    if (!vehicle) throw new ValidationError({ vehicleId: 'Alege un vehicul.' });
    const existing = id ? await db.rides.get(id) : undefined;
    if (id && !existing) throw new Error('Cursa nu mai există.');

    const keepOld = !!existing && !draft.recalculate;
    const keepCommission = keepOld && existing!.platform === draft.platform;
    const keepVehicleCosts = keepOld && existing!.vehicleId === draft.vehicleId;

    const commissionPct =
      draft.commissionPct ?? (keepCommission ? existing!.snapshot.commissionPct : settings.commissionPct[draft.platform]);
    const commission = commissionPctSchema.safeParse(commissionPct);
    if (!commission.success) throw new ValidationError({ commissionPct: commission.error.issues[0]!.message });

    const fresh = buildCostSnapshot(vehicle, commission.data);
    const snapshot = keepVehicleCosts
      ? { ...existing!.snapshot, commissionPct: commission.data }
      : fresh;
    const result = calculateRide(parsedInput.data, snapshot);
    const now = new Date();
    const note = draft.note?.trim();
    const entity: RideEntity = {
      id: existing?.id ?? newId(),
      startedAt: draft.startedAt,
      platform: draft.platform,
      vehicleId: vehicle.id,
      source: existing?.source ?? 'manual',
      input: parsedInput.data,
      commissionOverridden:
        draft.commissionPct !== undefined
          ? draft.commissionPct !== settings.commissionPct[draft.platform]
          : keepCommission && existing!.commissionOverridden,
      ...(note ? { note } : {}),
      snapshot,
      result,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.rides.put(entity);
    if (settings.lastPlatform !== draft.platform) {
      await db.settings.update('app', { lastPlatform: draft.platform });
    }
    return entity;
  });
}

export async function softDeleteRide(id: string): Promise<void> {
  await db.rides.update(id, { deletedAt: new Date() });
}

export async function restoreRide(id: string): Promise<void> {
  await db.rides.update(id, { deletedAt: null });
}

/** Curse active (nu în coș) într-un interval [start, end), cele mai noi primele. */
export async function listRides(start: Date, end: Date): Promise<RideEntity[]> {
  const rides = await db.rides.where('startedAt').between(start, end, true, false).reverse().toArray();
  return rides.filter((r) => r.deletedAt === null);
}

// ---------- Cheltuieli ----------

export interface ExpenseDraft {
  date: Date;
  category: ExpenseCategory;
  amountMinor: number;
  vehicleId?: string;
  note?: string;
}

export async function saveExpense(draft: ExpenseDraft, id?: string): Promise<ExpenseEntity> {
  const parsed = expenseSchema.safeParse({ date: draft.date, category: draft.category, amountMinor: draft.amountMinor, note: draft.note });
  if (!parsed.success) throw new ValidationError(issuesToFieldErrors(parsed.error.issues));
  const now = new Date();
  const existing = id ? await db.expenses.get(id) : undefined;
  const note = parsed.data.note?.trim();
  const entity: ExpenseEntity = {
    id: existing?.id ?? newId(),
    date: parsed.data.date,
    category: parsed.data.category as ExpenseCategory,
    amountMinor: parsed.data.amountMinor,
    ...(draft.vehicleId ? { vehicleId: draft.vehicleId } : {}),
    ...(note ? { note } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.expenses.put(entity);
  return entity;
}

export async function softDeleteExpense(id: string): Promise<void> {
  await db.expenses.update(id, { deletedAt: new Date() });
}

export async function restoreExpense(id: string): Promise<void> {
  await db.expenses.update(id, { deletedAt: null });
}

// ---------- Costuri fixe ----------

export interface FixedCostDraft {
  name: string;
  monthlyAmountMinor: number;
  activeFrom: Date;
  activeUntil: Date | null;
}

export async function saveFixedCost(draft: FixedCostDraft, id?: string): Promise<FixedCostEntity> {
  const parsed = fixedCostSchema.safeParse(draft);
  if (!parsed.success) throw new ValidationError(issuesToFieldErrors(parsed.error.issues));
  const now = new Date();
  const existing = id ? await db.fixedCosts.get(id) : undefined;
  const entity: FixedCostEntity = {
    ...parsed.data,
    id: existing?.id ?? newId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.fixedCosts.put(entity);
  return entity;
}

/** Oprește un cost fix de la o dată; lunile anterioare își păstrează costul. */
export async function stopFixedCost(id: string, from: Date): Promise<void> {
  const f = await db.fixedCosts.get(id);
  if (!f) return;
  const until = from > f.activeFrom ? from : new Date(f.activeFrom.getTime() + 1);
  await db.fixedCosts.update(id, { activeUntil: until, updatedAt: new Date() });
}

/** Șterge definitiv un cost fix introdus greșit (și din toate perioadele). */
export async function deleteFixedCost(id: string): Promise<void> {
  await db.fixedCosts.delete(id);
}

// ---------- Coș ----------

export const TRASH_DAYS = 30;

export async function listTrash(): Promise<{ rides: RideEntity[]; expenses: ExpenseEntity[] }> {
  const [rides, expenses] = await Promise.all([
    db.rides.filter((r) => r.deletedAt !== null).toArray(),
    db.expenses.filter((e) => e.deletedAt !== null).toArray(),
  ]);
  const byDeleted = <T extends { deletedAt: Date | null }>(a: T, b: T) => b.deletedAt!.getTime() - a.deletedAt!.getTime();
  return { rides: rides.sort(byDeleted), expenses: expenses.sort(byDeleted) };
}

/** Șterge definitiv ce stă în coș de mai mult de 30 de zile. Întoarce câte înregistrări au fost șterse. */
export async function purgeOldTrash(now: Date): Promise<number> {
  const limit = new Date(now.getTime() - TRASH_DAYS * 24 * 60 * 60 * 1000);
  return db.transaction('rw', db.rides, db.expenses, async () => {
    const r = await db.rides.filter((x) => x.deletedAt !== null && x.deletedAt < limit).delete();
    const e = await db.expenses.filter((x) => x.deletedAt !== null && x.deletedAt < limit).delete();
    return r + e;
  });
}

export async function deleteForever(kind: 'ride' | 'expense', id: string): Promise<void> {
  const table = kind === 'ride' ? db.rides : db.expenses;
  const item = await table.get(id);
  if (item && item.deletedAt === null) throw new Error('Doar elementele din coș pot fi șterse definitiv.');
  await table.delete(id);
}
