import { describe, expect, it } from 'vitest';
import { referenceRide, referenceThresholds } from '../../domain/__tests__/fixtures';
import { emptyRideForm, liveCalculation, parseRideForm, rideInputToForm } from '../rideForm';

const typed = { ...emptyRideForm, fare: '35,00', tripKm: '10', tripMin: '20', pickupKm: '2', pickupMin: '5', waitMin: '2' };

describe('parseRideForm', () => {
  it('transformă textul tastat în date (virgulă zecimală, câmpuri goale = 0)', () => {
    const p = parseRideForm({ ...typed, waitMin: '' });
    expect(p.errors).toEqual({});
    expect(p.input).toMatchObject({ fareMinor: 3500, tripKm: 10, pickupKm: 2, waitMin: 0, tipMinor: 0, energyCostOverrideMinor: null });
    expect(p.commissionPct).toBeUndefined();
  });

  it('cere suma, km și minutele cursei', () => {
    const p = parseRideForm(emptyRideForm);
    expect(p.input).toBeNull();
    expect(p.errors).toEqual({ fare: 'Introdu suma cursei.', tripKm: 'Introdu km cu client.', tripMin: 'Introdu durata cursei.' });
  });

  it('semnalează text invalid și valori în afara limitelor pe câmpul corect', () => {
    expect(parseRideForm({ ...typed, pickupKm: 'doi' }).errors).toEqual({ pickupKm: 'Număr invalid.' });
    expect(parseRideForm({ ...typed, tripKm: '5000' }).errors.tripKm).toMatch(/maxim/);
    expect(parseRideForm({ ...typed, commission: '100' }).errors.commission).toMatch(/Comision/);
  });

  it('sumele acceptă punct de mii și refuză mai mult de 2 zecimale', () => {
    expect(parseRideForm({ ...typed, fare: '1.250' }).input?.fareMinor).toBe(125000);
    expect(parseRideForm({ ...typed, tip: '5,555' }).errors.tip).toMatch(/2 zecimale/);
    // km rămân zecimali: 1.250 km = 1,25 km
    expect(parseRideForm({ ...typed, tripKm: '1.250' }).input?.tripKm).toBe(1.25);
  });

  it('comisionul introdus manual se transmite separat', () => {
    expect(parseRideForm({ ...typed, commission: '22,5' }).commissionPct).toBe(22.5);
  });
});

describe('liveCalculation', () => {
  it('produce rezultatul și verdictul cursei de referință', () => {
    const live = liveCalculation(parseRideForm(typed), { energyCostPerKm: 0.2312, wearCostPerKm: 0.4, platformCommissionPct: 25 }, referenceThresholds);
    expect(live?.result.profitMinor).toBe(1868);
    expect(live?.verdict.level).toBe('go');
  });
  it('fără date valide nu calculează nimic', () => {
    expect(liveCalculation(parseRideForm(emptyRideForm), { energyCostPerKm: 0.2, wearCostPerKm: 0.4, platformCommissionPct: 25 }, referenceThresholds)).toBeNull();
  });
});

describe('rideInputToForm', () => {
  it('drum dus-întors: formular → date → formular → aceleași date', () => {
    const input = { ...referenceRide, fareMinor: 123456, pickupKm: 2.5, tipMinor: 500, energyCostOverrideMinor: 310 };
    const back = parseRideForm(rideInputToForm(input, 22.5));
    expect(back.input).toEqual(input);
    expect(back.commissionPct).toBe(22.5);
  });
});
