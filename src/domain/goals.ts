import { differenceInCalendarDays } from 'date-fns';
import { allocateFixedCosts } from './aggregate';
import type { Minor } from './money';
import type { DateRange, Goals } from './types';

/**
 * Obiectivul de profit pentru un interval:
 * o zi → obiectivul zilnic; altfel obiectivul lunar repartizat pe zile
 * (o lună întreagă = obiectivul lunar exact); fără obiectiv lunar → zilnic × zile.
 */
export function goalForRange(goals: Goals, range: DateRange): Minor | null {
  const days = differenceInCalendarDays(range.end, range.start);
  if (days <= 0) return null;
  if (days === 1) return goals.dailyMinor;
  if (goals.monthlyMinor !== null) return allocateFixedCosts(goals.monthlyMinor, range.start, range.end);
  if (goals.dailyMinor !== null) return goals.dailyMinor * days;
  return null;
}

export interface GoalProgress {
  /** 0 … (poate depăși 1); null fără obiectiv */
  ratio: number | null;
  remainingMinor: Minor | null;
  reached: boolean;
}

export function goalProgress(profitMinor: Minor, goalMinor: Minor | null): GoalProgress {
  if (goalMinor === null || goalMinor <= 0) return { ratio: null, remainingMinor: null, reached: false };
  const achieved = Math.max(0, profitMinor);
  return {
    ratio: achieved / goalMinor,
    remainingMinor: Math.max(0, goalMinor - achieved),
    reached: achieved >= goalMinor,
  };
}
