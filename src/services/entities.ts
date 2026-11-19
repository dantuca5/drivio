import type { z } from 'zod';
import type {
  CostSnapshot,
  ExpenseCategory,
  FareMode,
  Goals,
  Minor,
  Platform,
  RideInput,
  RideResult,
  Thresholds,
} from '../domain';
import type { vehicleSchema } from '../domain/schemas';

/** Entitățile salvate pe telefon (IndexedDB). Datele calendaristice se păstrează ca Date. */

export type VehicleData = z.infer<typeof vehicleSchema>;

export type VehicleEntity = VehicleData & {
  id: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** De unde provine cursa; punct de extensie pentru importuri autorizate viitoare. */
export type RideSource = 'manual' | 'import';

export interface RideEntity {
  id: string;
  startedAt: Date;
  platform: Platform;
  vehicleId: string;
  source: RideSource;
  input: RideInput;
  /** true dacă comisionul a fost modificat manual pentru această cursă */
  commissionOverridden: boolean;
  note?: string;
  snapshot: CostSnapshot;
  result: RideResult;
  createdAt: Date;
  updatedAt: Date;
  /** ștergere „moale”: cursa stă în coș 30 de zile */
  deletedAt: Date | null;
}

export interface ExpenseEntity {
  id: string;
  date: Date;
  category: ExpenseCategory;
  amountMinor: Minor;
  vehicleId?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface FixedCostEntity {
  id: string;
  name: string;
  monthlyAmountMinor: Minor;
  /** valabil de la (inclusiv) */
  activeFrom: Date;
  /** oprit de la (exclusiv); null = încă activ */
  activeUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Copie a datelor făcută automat înainte de o restaurare, ca restaurarea să poată fi anulată. */
export interface RestorePointEntity {
  id: string;
  createdAt: Date;
  /** conținutul unui fișier de backup, ca text JSON */
  backupJson: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  id: 'app';
  currency: string;
  theme: ThemePreference;
  commissionPct: Record<Platform, number>;
  thresholds: Thresholds;
  goals: Goals;
  taxReservePct: number;
  activeVehicleId: string | null;
  lastPlatform: Platform;
  /**
   * Ce sumă arată oferta fiecărei platforme. Uber și Bolt afișează azi suma netă,
   * deci lipsa valorii (setări mai vechi) înseamnă „net”.
   */
  fareModeByPlatform?: Record<Platform, FareMode>;
  /** după câte zile fără backup apare mementoul */
  backupReminderDays: number;
  lastBackupAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_FARE_MODE_BY_PLATFORM: Readonly<Record<Platform, FareMode>> = { uber: 'net', bolt: 'net' };

/** Tipul sumei cu care pornește o cursă nouă pe platforma dată. */
export function offerFareMode(settings: Pick<AppSettings, 'fareModeByPlatform'>, platform: Platform): FareMode {
  return settings.fareModeByPlatform?.[platform] ?? DEFAULT_FARE_MODE_BY_PLATFORM[platform];
}
