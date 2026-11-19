import { describe, expect, it } from 'vitest';
import { blendedKWhPrice, buildCostSnapshot, energyCostPerKm, tiresCostPerKm, wearCostPerKm } from '../vehicleCost';
import { referenceEv, referenceVehicle, referenceWear } from './fixtures';

describe('vehicul electric', () => {
  it('prețul mediu kWh ponderează acasă și public', () => {
    expect(blendedKWhPrice(referenceEv)).toBeCloseTo(1.36, 10);
  });
  it('100% acasă → prețul de acasă', () => {
    expect(blendedKWhPrice({ ...referenceEv, homeSharePct: 100 })).toBeCloseTo(1.0, 10);
  });
  it('energie pe km = consum/100 × preț mediu', () => {
    expect(energyCostPerKm(referenceEv)).toBeCloseTo(0.2312, 10);
  });
  it('pierderile la încărcare cresc costul', () => {
    expect(energyCostPerKm({ ...referenceEv, chargingLossPct: 10 })).toBeCloseTo(0.2312 / 0.9, 10);
  });
});

describe('vehicul cu combustibil', () => {
  it('benzină 7 L/100 km la 7,50 RON/L → 0,525 RON/km', () => {
    expect(energyCostPerKm({ powertrain: 'petrol', fuelConsumptionLPer100: 7, fuelPricePerL: 7.5 })).toBeCloseTo(0.525, 10);
  });
  it('GPL și hibrid folosesc aceeași formulă', () => {
    expect(energyCostPerKm({ powertrain: 'lpg', fuelConsumptionLPer100: 10, fuelPricePerL: 3.6 })).toBeCloseTo(0.36, 10);
    expect(energyCostPerKm({ powertrain: 'hybrid', fuelConsumptionLPer100: 4.5, fuelPricePerL: 7.2 })).toBeCloseTo(0.324, 10);
  });
});

describe('uzură', () => {
  it('anvelope: cost set / durată de viață', () => {
    expect(tiresCostPerKm({ ...referenceWear, tiresSetCost: 2000, tiresLifetimeKm: 40000 })).toBeCloseTo(0.05, 10);
  });
  it('anvelope fără durată de viață → 0, nu Infinity', () => {
    expect(tiresCostPerKm({ ...referenceWear, tiresSetCost: 2000, tiresLifetimeKm: 0 })).toBe(0);
  });
  it('uzura totală adună toate componentele', () => {
    expect(wearCostPerKm(referenceWear)).toBeCloseTo(0.4, 10);
    expect(wearCostPerKm({ ...referenceWear, tiresSetCost: 2000, tiresLifetimeKm: 40000 })).toBeCloseTo(0.45, 10);
  });
});

describe('buildCostSnapshot', () => {
  it('captează comisionul și costurile pe km', () => {
    const s = buildCostSnapshot(referenceVehicle, 25);
    expect(s.commissionPct).toBe(25);
    expect(s.energyCostPerKm).toBeCloseTo(0.2312, 10);
    expect(s.wearCostPerKm).toBeCloseTo(0.4, 10);
  });
  it('respinge comision de 100% sau mai mare', () => {
    expect(() => buildCostSnapshot(referenceVehicle, 100)).toThrow();
    expect(() => buildCostSnapshot(referenceVehicle, -1)).toThrow();
  });
});
