import { assertCommissionPct } from './errors';
import type { CostSnapshot, EvEnergy, VehicleCostProfile, VehicleEnergy, WearCosts } from './types';

/** Preț mediu pe kWh: home% × preț acasă + (100 − home)% × preț public. */
export function blendedKWhPrice(v: EvEnergy): number {
  const home = v.homeSharePct / 100;
  return home * v.homePricePerKWh + (1 - home) * v.publicPricePerKWh;
}

/** Costul energiei pe km parcurs. Pentru electric include pierderile la încărcare. */
export function energyCostPerKm(v: VehicleEnergy): number {
  if (v.powertrain === 'electric') {
    return ((v.evConsumptionKWhPer100 / 100) * blendedKWhPrice(v)) / (1 - v.chargingLossPct / 100);
  }
  return (v.fuelConsumptionLPer100 / 100) * v.fuelPricePerL;
}

export function tiresCostPerKm(w: WearCosts): number {
  return w.tiresLifetimeKm > 0 ? w.tiresSetCost / w.tiresLifetimeKm : 0;
}

/** Uzură pe km = anvelope + mentenanță + depreciere + alte costuri pe km. */
export function wearCostPerKm(w: WearCosts): number {
  return tiresCostPerKm(w) + w.maintenancePerKm + w.depreciationPerKm + w.otherPerKm;
}

export function buildCostSnapshot(v: VehicleCostProfile, commissionPct: number): CostSnapshot {
  assertCommissionPct(commissionPct);
  return {
    commissionPct,
    energyCostPerKm: energyCostPerKm(v),
    wearCostPerKm: wearCostPerKm(v),
  };
}
