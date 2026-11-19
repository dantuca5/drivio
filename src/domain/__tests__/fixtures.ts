import type { CostSnapshot, EvEnergy, RideInput, Thresholds, VehicleCostProfile, WearCosts } from '../types';

/**
 * Exemplul de referință din docs/ARHITECTURA.md § 10, calculat de mână.
 * Valorile sunt DOAR pentru teste; aplicația nu are valori financiare implicite.
 */
export const referenceWear: WearCosts = {
  tiresSetCost: 0,
  tiresLifetimeKm: 0,
  maintenancePerKm: 0.1,
  depreciationPerKm: 0.25,
  otherPerKm: 0.05,
};

export const referenceEv: EvEnergy = {
  powertrain: 'electric',
  evConsumptionKWhPer100: 17,
  homePricePerKWh: 1.0,
  publicPricePerKWh: 2.2,
  homeSharePct: 70,
  chargingLossPct: 0,
};

export const referenceVehicle: VehicleCostProfile = { ...referenceEv, ...referenceWear };

export const referenceSnapshot: CostSnapshot = {
  commissionPct: 25,
  energyCostPerKm: 0.2312,
  wearCostPerKm: 0.4,
};

export const referenceRide: RideInput = {
  fareMinor: 3500,
  fareMode: 'gross',
  tripKm: 10,
  tripMin: 20,
  pickupKm: 2,
  pickupMin: 5,
  waitMin: 2,
  tipMinor: 0,
  bonusMinor: 0,
};

export const referenceThresholds: Thresholds = {
  redBelowPerHour: 30,
  greenFromPerHour: 40,
  redBelowPerKm: 1.0,
  greenFromPerKm: 1.4,
};
