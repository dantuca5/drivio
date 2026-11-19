import type { RideResult, Thresholds, Verdict, VerdictReason } from './types';

/**
 * Verdict verde / galben / roșu (docs/ARHITECTURA.md § 6.3).
 * Metricile indisponibile (0 km sau 0 minute) nu se verifică.
 */
export function evaluateVerdict(r: RideResult, t: Thresholds): Verdict {
  if (r.profitMinor <= 0) return { level: 'stop', reasons: ['loss'] };

  const perHour = r.profitPerHour;
  const perKm = r.profitPerKm;
  if (perHour === null && perKm === null) return { level: 'slow', reasons: ['insufficientData'] };

  const red: VerdictReason[] = [];
  if (perHour !== null && perHour < t.redBelowPerHour) red.push('belowRedHour');
  if (perKm !== null && perKm < t.redBelowPerKm) red.push('belowRedKm');
  if (red.length > 0) return { level: 'stop', reasons: red };

  const yellow: VerdictReason[] = [];
  if (perHour !== null && perHour < t.greenFromPerHour) yellow.push('belowGreenHour');
  if (perKm !== null && perKm < t.greenFromPerKm) yellow.push('belowGreenKm');
  if (yellow.length > 0) return { level: 'slow', reasons: yellow };

  return { level: 'go', reasons: ['meetsTargets'] };
}
