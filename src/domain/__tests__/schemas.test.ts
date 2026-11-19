import { describe, expect, it } from 'vitest';
import {
  commissionPctSchema,
  expenseSchema,
  fixedCostSchema,
  goalsSchema,
  rideInputSchema,
  thresholdsSchema,
  vehicleSchema,
} from '../schemas';
import { referenceEv, referenceRide, referenceThresholds, referenceWear } from './fixtures';

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message ?? '';

describe('rideInputSchema', () => {
  it('acceptă cursa de referință', () => {
    expect(rideInputSchema.safeParse(referenceRide).success).toBe(true);
  });
  it('respinge km negativi cu mesaj în română', () => {
    const r = rideInputSchema.safeParse({ ...referenceRide, tripKm: -1 });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toMatch(/Km cu client/);
  });
  it('respinge peste 2.000 km', () => {
    expect(rideInputSchema.safeParse({ ...referenceRide, tripKm: 2001 }).success).toBe(false);
  });
  it('respinge sume cu fracțiuni de ban', () => {
    expect(rideInputSchema.safeParse({ ...referenceRide, fareMinor: 35.5 }).success).toBe(false);
  });
  it('respinge text în loc de număr', () => {
    const r = rideInputSchema.safeParse({ ...referenceRide, tripMin: 'abc' });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toMatch(/număr/);
  });
});

describe('commissionPctSchema', () => {
  it('0–99,9 acceptat, 100 respins', () => {
    expect(commissionPctSchema.safeParse(0).success).toBe(true);
    expect(commissionPctSchema.safeParse(99.9).success).toBe(true);
    const r = commissionPctSchema.safeParse(100);
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toMatch(/Comision/);
  });
});

describe('vehicleSchema', () => {
  const ev = { name: 'Tesla Model 3', ...referenceEv, ...referenceWear };
  it('acceptă un electric complet', () => {
    expect(vehicleSchema.safeParse(ev).success).toBe(true);
  });
  it('respinge electric fără preț acasă', () => {
    const { homePricePerKWh: _omit, ...rest } = ev;
    expect(vehicleSchema.safeParse(rest).success).toBe(false);
  });
  it('respinge consum 0', () => {
    expect(vehicleSchema.safeParse({ ...ev, evConsumptionKWhPer100: 0 }).success).toBe(false);
  });
  it('acceptă benzină și respinge benzină fără preț', () => {
    const petrol = {
      name: 'Dacia Logan',
      powertrain: 'petrol',
      fuelConsumptionLPer100: 6.5,
      fuelPricePerL: 7.3,
      tiresSetCost: 1200,
      tiresLifetimeKm: 40000,
      maintenancePerKm: 0.08,
      depreciationPerKm: 0.15,
      otherPerKm: 0,
    };
    expect(vehicleSchema.safeParse(petrol).success).toBe(true);
    const { fuelPricePerL: _omit, ...rest } = petrol;
    expect(vehicleSchema.safeParse(rest).success).toBe(false);
  });
  it('cost de anvelope fără durată de viață e respins (altfel ar fi ignorat)', () => {
    const r = vehicleSchema.safeParse({ ...ev, tiresSetCost: 2000, tiresLifetimeKm: 0 });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toMatch(/km rezistă/);
  });
  it('respinge nume gol', () => {
    expect(vehicleSchema.safeParse({ ...ev, name: '  ' }).success).toBe(false);
  });
});

describe('thresholdsSchema', () => {
  it('acceptă praguri coerente', () => {
    expect(thresholdsSchema.safeParse(referenceThresholds).success).toBe(true);
  });
  it('respinge prag roșu peste cel verde', () => {
    const r = thresholdsSchema.safeParse({ ...referenceThresholds, redBelowPerHour: 50 });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toMatch(/roșu/);
  });
});

describe('alte scheme', () => {
  it('cheltuială validă și invalidă', () => {
    expect(expenseSchema.safeParse({ date: new Date(), category: 'service', amountMinor: 25000 }).success).toBe(true);
    expect(expenseSchema.safeParse({ date: new Date(), category: 'service', amountMinor: 0 }).success).toBe(false);
    expect(expenseSchema.safeParse({ date: new Date(), category: 'vacanta', amountMinor: 100 }).success).toBe(false);
  });
  it('cost fix', () => {
    const from = new Date(2026, 0, 1);
    expect(fixedCostSchema.safeParse({ name: 'RCA', monthlyAmountMinor: 25000, activeFrom: from, activeUntil: null }).success).toBe(true);
    expect(fixedCostSchema.safeParse({ name: '', monthlyAmountMinor: 25000, activeFrom: from, activeUntil: null }).success).toBe(false);
    expect(fixedCostSchema.safeParse({ name: 'RCA', monthlyAmountMinor: 25000, activeFrom: from, activeUntil: new Date(2025, 0, 1) }).success).toBe(false);
  });
  it('obiective opționale', () => {
    expect(goalsSchema.safeParse({ dailyMinor: null, monthlyMinor: 800000 }).success).toBe(true);
    expect(goalsSchema.safeParse({ dailyMinor: -1, monthlyMinor: null }).success).toBe(false);
  });
});
