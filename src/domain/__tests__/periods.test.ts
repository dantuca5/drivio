import { describe, expect, it } from 'vitest';
import { daysInRange, dayKey, isInRange, parseDayKey, resolvePeriod } from '../periods';

// Joi, 19 noiembrie 2026, 21:47 ora României
const now = new Date(2026, 10, 19, 21, 47);

describe('resolvePeriod', () => {
  it('astăzi', () => {
    const r = resolvePeriod({ kind: 'today' }, now);
    expect(r.start).toEqual(new Date(2026, 10, 19));
    expect(r.end).toEqual(new Date(2026, 10, 20));
  });
  it('ieri', () => {
    const r = resolvePeriod({ kind: 'yesterday' }, now);
    expect(r.start).toEqual(new Date(2026, 10, 18));
    expect(r.end).toEqual(new Date(2026, 10, 19));
  });
  it('ultimele 7 zile = azi + 6 zile anterioare', () => {
    const r = resolvePeriod({ kind: 'last7' }, now);
    expect(daysInRange(r)).toEqual([
      '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
    ]);
  });
  it('ultimele 30 de zile', () => {
    expect(daysInRange(resolvePeriod({ kind: 'last30' }, now))).toHaveLength(30);
  });
  it('luna curentă', () => {
    const r = resolvePeriod({ kind: 'thisMonth' }, now);
    expect(r.start).toEqual(new Date(2026, 10, 1));
    expect(r.end).toEqual(new Date(2026, 11, 1));
  });
  it('o lună anterioară', () => {
    const r = resolvePeriod({ kind: 'month', month: '2026-02' }, now);
    expect(daysInRange(r)).toHaveLength(28);
  });
  it('interval personalizat, capete incluse', () => {
    const r = resolvePeriod({ kind: 'custom', from: '2026-11-01', to: '2026-11-03' }, now);
    expect(daysInRange(r)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
  it('interval inversat sau dată invalidă → eroare', () => {
    expect(() => resolvePeriod({ kind: 'custom', from: '2026-11-05', to: '2026-11-01' }, now)).toThrow();
    expect(() => resolvePeriod({ kind: 'custom', from: '2026-02-30', to: '2026-03-01' }, now)).toThrow();
    expect(() => resolvePeriod({ kind: 'month', month: '2026-13' }, now)).toThrow();
  });
});

describe('ora de vară (25 octombrie 2026, ora 4 devine 3)', () => {
  it('săptămâna 22–28 octombrie are 7 zile distincte', () => {
    const r = resolvePeriod({ kind: 'last7' }, new Date(2026, 9, 28, 12));
    expect(daysInRange(r)).toEqual([
      '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28',
    ]);
  });
  it('o cursă la 23:30 pe 25 octombrie aparține zilei de 25', () => {
    const r = resolvePeriod({ kind: 'custom', from: '2026-10-25', to: '2026-10-25' }, now);
    expect(isInRange(new Date(2026, 9, 25, 23, 30), r)).toBe(true);
    expect(isInRange(new Date(2026, 9, 26, 0, 0), r)).toBe(false);
  });
});

describe('chei de zi', () => {
  it('dayKey și parseDayKey sunt inverse', () => {
    expect(dayKey(new Date(2026, 0, 5, 13))).toBe('2026-01-05');
    expect(parseDayKey('2026-01-05')).toEqual(new Date(2026, 0, 5));
    expect(parseDayKey('2026-1-5')).toBeNull();
  });
});
