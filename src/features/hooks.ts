import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { DateRange } from '../domain';
import { db } from '../services/db';
import type { AppSettings, ThemePreference } from '../services/entities';

/** undefined = se încarcă; null = încă nu există (ghidul de pornire nu e terminat). */
export function useSettings(): AppSettings | null | undefined {
  return useLiveQuery(async () => (await db.settings.get('app')) ?? null, []);
}

export function useVehicles(includeArchived = false) {
  return useLiveQuery(async () => {
    const all = await db.vehicles.toArray();
    return all
      .filter((v) => includeArchived || !v.archived)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [includeArchived]);
}

export function useRidesInRange(range: DateRange | null) {
  const start = range?.start.getTime();
  const end = range?.end.getTime();
  return useLiveQuery(async () => {
    if (start === undefined || end === undefined) return [];
    const rides = await db.rides.where('startedAt').between(new Date(start), new Date(end), true, false).reverse().toArray();
    return rides.filter((r) => r.deletedAt === null);
  }, [start, end]);
}

export function useExpensesAndFixedCosts() {
  return useLiveQuery(async () => {
    const [expenses, fixedCosts] = await Promise.all([db.expenses.toArray(), db.fixedCosts.toArray()]);
    return { expenses: expenses.filter((e) => e.deletedAt === null), fixedCosts };
  }, []);
}

/** Aplică tema (sistem / luminos / întunecat) pe <html>. */
export function useApplyTheme(pref: ThemePreference | undefined) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const resolved = pref === 'light' || pref === 'dark' ? pref : systemDark ? 'dark' : 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
  return resolved;
}

/** „Acum”, reîmprospătat la fiecare minut, ca „Astăzi” să treacă singur la miezul nopții. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
