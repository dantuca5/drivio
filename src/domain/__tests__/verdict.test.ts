import { describe, expect, it } from 'vitest';
import { calculateRide } from '../rideCalc';
import { evaluateVerdict } from '../verdict';
import { referenceRide, referenceSnapshot, referenceThresholds } from './fixtures';

const ride = (patch: Partial<typeof referenceRide>) => calculateRide({ ...referenceRide, ...patch }, referenceSnapshot);

describe('evaluateVerdict', () => {
  it('cursa de referință (41,51 RON/oră, 1,56 RON/km) → verde', () => {
    expect(evaluateVerdict(ride({}), referenceThresholds)).toEqual({ level: 'go', reasons: ['meetsTargets'] });
  });

  it('pierdere → roșu cu motiv „loss”', () => {
    expect(evaluateVerdict(ride({ fareMinor: 500 }), referenceThresholds)).toEqual({ level: 'stop', reasons: ['loss'] });
  });

  it('sub pragul roșu pe oră → roșu', () => {
    // 15 RON, 4 km preluare: profit mic pe timp lung
    const v = evaluateVerdict(ride({ fareMinor: 1500, pickupKm: 4 }), referenceThresholds);
    expect(v.level).toBe('stop');
    expect(v.reasons).toContain('belowRedHour');
  });

  it('între praguri pe oră → galben', () => {
    // 30 min în loc de 27 → 18,68 / 0,5 h = 37,36 RON/oră
    const v = evaluateVerdict(ride({ waitMin: 5 }), referenceThresholds);
    expect(v).toEqual({ level: 'slow', reasons: ['belowGreenHour'] });
  });

  it('între praguri pe km → galben', () => {
    const v = evaluateVerdict(ride({ tripMin: 5, pickupMin: 0, waitMin: 0, pickupKm: 6 }), referenceThresholds);
    // 16 km: profit 35 − 8,75 − 3,70 − 6,40 = 16,15 → 1,01 RON/km
    expect(v.level).toBe('slow');
    expect(v.reasons).toEqual(['belowGreenKm']);
  });

  it('0 km și 0 minute cu profit → galben, date insuficiente', () => {
    const v = evaluateVerdict(
      ride({ fareMinor: 1000, tripKm: 0, tripMin: 0, pickupKm: 0, pickupMin: 0, waitMin: 0 }),
      referenceThresholds,
    );
    expect(v).toEqual({ level: 'slow', reasons: ['insufficientData'] });
  });

  it('o singură metrică disponibilă e suficientă', () => {
    // 0 minute, dar km există: doar profit/km se verifică
    const v = evaluateVerdict(ride({ tripMin: 0, pickupMin: 0, waitMin: 0 }), referenceThresholds);
    expect(v.level).toBe('go');
  });
});
