import { describe, expect, it } from 'vitest';
import { goalForRange, goalProgress } from '../goals';
import { resolvePeriod } from '../periods';

const now = new Date(2026, 10, 19, 21, 47);
const goals = { dailyMinor: 40000, monthlyMinor: 800000 };

describe('goalForRange', () => {
  it('o zi → obiectivul zilnic', () => {
    expect(goalForRange(goals, resolvePeriod({ kind: 'today' }, now))).toBe(40000);
  });
  it('o lună întreagă → obiectivul lunar', () => {
    expect(goalForRange(goals, resolvePeriod({ kind: 'thisMonth' }, now))).toBe(800000);
  });
  it('7 zile → proporțional din obiectivul lunar', () => {
    expect(goalForRange(goals, resolvePeriod({ kind: 'last7' }, now))).toBe(Math.round((800000 * 7) / 30));
  });
  it('fără obiectiv lunar → zilnic × zile', () => {
    expect(goalForRange({ dailyMinor: 40000, monthlyMinor: null }, resolvePeriod({ kind: 'last7' }, now))).toBe(280000);
  });
  it('fără obiective → null', () => {
    expect(goalForRange({ dailyMinor: null, monthlyMinor: null }, resolvePeriod({ kind: 'today' }, now))).toBeNull();
  });
});

describe('goalProgress', () => {
  it('progres parțial', () => {
    expect(goalProgress(28460, 40000)).toEqual({ ratio: 0.7115, remainingMinor: 11540, reached: false });
  });
  it('obiectiv depășit', () => {
    expect(goalProgress(50000, 40000)).toEqual({ ratio: 1.25, remainingMinor: 0, reached: true });
  });
  it('pierdere → progres 0', () => {
    expect(goalProgress(-500, 40000)).toEqual({ ratio: 0, remainingMinor: 40000, reached: false });
  });
  it('fără obiectiv → null', () => {
    expect(goalProgress(1000, null)).toEqual({ ratio: null, remainingMinor: null, reached: false });
  });
});
