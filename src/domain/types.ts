import type { Minor } from './money';

export type Platform = 'uber' | 'bolt';
export const PLATFORMS: readonly Platform[] = ['uber', 'bolt'];

/** Suma introdusă: înainte de comision (brut) sau ce rămâne după comision (net). */
export type FareMode = 'gross' | 'net';

export type FuelPowertrain = 'petrol' | 'diesel' | 'lpg' | 'hybrid';
export type Powertrain = FuelPowertrain | 'electric';
export const POWERTRAINS: readonly Powertrain[] = ['petrol', 'diesel', 'lpg', 'hybrid', 'electric'];

export interface FuelEnergy {
  powertrain: FuelPowertrain;
  fuelConsumptionLPer100: number;
  /** RON (sau moneda aleasă) pe litru */
  fuelPricePerL: number;
}

export interface EvEnergy {
  powertrain: 'electric';
  evConsumptionKWhPer100: number;
  homePricePerKWh: number;
  publicPricePerKWh: number;
  /** procentul din energie încărcat acasă; restul la stații publice */
  homeSharePct: number;
  /** pierderi la încărcare (0 dacă nu le cunoști) */
  chargingLossPct: number;
  batteryKWh?: number | null;
}

export type VehicleEnergy = FuelEnergy | EvEnergy;

/** Costuri de uzură; valorile pe km sunt în unități majore (ex. 0,08 RON/km). */
export interface WearCosts {
  tiresSetCost: number;
  tiresLifetimeKm: number;
  maintenancePerKm: number;
  depreciationPerKm: number;
  otherPerKm: number;
}

export type VehicleCostProfile = VehicleEnergy & WearCosts;

/** Valorile cu care s-a calculat o cursă; se salvează odată cu ea, ca istoricul să nu se schimbe singur. */
export interface CostSnapshot {
  commissionPct: number;
  energyCostPerKm: number;
  wearCostPerKm: number;
}

export interface RideInput {
  fareMinor: Minor;
  fareMode: FareMode;
  tripKm: number;
  tripMin: number;
  pickupKm: number;
  pickupMin: number;
  waitMin: number;
  tipMinor: Minor;
  bonusMinor: Minor;
  energyCostOverrideMinor?: Minor | null;
}

export interface RideResult {
  grossFareMinor: Minor;
  commissionMinor: Minor;
  /** tarif brut + bacșiș + bonus */
  grossIncomeMinor: Minor;
  incomeAfterCommissionMinor: Minor;
  energyCostMinor: Minor;
  wearCostMinor: Minor;
  /** energie + uzură */
  vehicleCostMinor: Minor;
  /** comision + cost mașină */
  totalCostMinor: Minor;
  /** profit operațional estimat */
  profitMinor: Minor;
  totalKm: number;
  totalMin: number;
  /** unități majore pe km; null dacă nu există km */
  profitPerKm: number | null;
  /** unități majore pe oră; null dacă nu există timp */
  profitPerHour: number | null;
  realCostPerKm: number | null;
  yieldPct: number | null;
}

export interface Thresholds {
  redBelowPerHour: number;
  greenFromPerHour: number;
  redBelowPerKm: number;
  greenFromPerKm: number;
}

export type VerdictLevel = 'go' | 'slow' | 'stop';
export type VerdictReason =
  | 'loss'
  | 'belowRedHour'
  | 'belowRedKm'
  | 'belowGreenHour'
  | 'belowGreenKm'
  | 'meetsTargets'
  | 'insufficientData';

export interface Verdict {
  level: VerdictLevel;
  reasons: VerdictReason[];
}

export type ExpenseCategory =
  | 'fuel'
  | 'charging'
  | 'service'
  | 'tires'
  | 'carwash'
  | 'parking'
  | 'fine'
  | 'insurance'
  | 'phone'
  | 'accounting'
  | 'other';

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'fuel', 'charging', 'service', 'tires', 'carwash', 'parking', 'fine', 'insurance', 'phone', 'accounting', 'other',
];

/** Bonurile de energie sunt doar pentru comparație estimat vs. real; nu se scad din profit. */
export const ENERGY_EXPENSE_CATEGORIES: readonly ExpenseCategory[] = ['fuel', 'charging'];

export interface ExpenseItem {
  date: Date;
  category: ExpenseCategory;
  amountMinor: Minor;
}

/**
 * Cost fix lunar valabil în [activeFrom, activeUntil). Oprirea unui cost îi setează
 * activeUntil, ca lunile trecute să-și păstreze costul și profitul de atunci.
 */
export interface FixedCost {
  monthlyAmountMinor: Minor;
  activeFrom: Date;
  activeUntil: Date | null;
}

export interface RideRecord {
  startedAt: Date;
  platform: Platform;
  result: RideResult;
}

export interface Goals {
  dailyMinor: Minor | null;
  monthlyMinor: Minor | null;
}

export interface DateRange {
  /** inclusiv */
  start: Date;
  /** exclusiv */
  end: Date;
}
