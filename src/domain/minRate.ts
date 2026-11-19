import { assertCommissionPct, assertNonNegativeFinite } from './errors';

export interface MinFarePerKmInput {
  /** costul mașinii pe km (energie + uzură) */
  costPerKm: number;
  targetProfitPerHour: number;
  /** viteza medie cu mașina în mișcare, inclusiv drumurile goale */
  avgSpeedKmh: number;
  /** procentul din km totali parcurși fără client */
  emptyKmPct: number;
  commissionPct: number;
  /** costuri fixe alocate pe oră (RCA, leasing…), 0 dacă nu vrei să le incluzi */
  fixedCostPerHour?: number;
}

/**
 * Tariful minim pe km cu client pentru a atinge profitul dorit pe oră.
 *
 * La 1 km plătit se parcurg 1/(1 − gol) km în total, în 1/((1 − gol) × viteză) ore.
 * Condiția F × (1 − c) − cost × km_total = țintă × ore dă:
 *   F = (cost + (țintă + fix) / viteză) / ((1 − gol) × (1 − c))
 *
 * Presupune că tariful e exprimat integral pe km (platformele plătesc și pe minut,
 * deci rezultatul e o limită de referință, nu o regulă exactă).
 */
export function minFarePerPaidKm(i: MinFarePerKmInput): number | null {
  assertCommissionPct(i.commissionPct);
  assertNonNegativeFinite(i.costPerKm, 'Cost pe km');
  assertNonNegativeFinite(i.targetProfitPerHour, 'Profit dorit pe oră');
  assertNonNegativeFinite(i.avgSpeedKmh, 'Viteză medie');
  assertNonNegativeFinite(i.emptyKmPct, 'Km fără client');
  const fixed = i.fixedCostPerHour ?? 0;
  assertNonNegativeFinite(fixed, 'Costuri fixe pe oră');

  if (i.avgSpeedKmh === 0 || i.emptyKmPct >= 100) return null;
  const paidShare = 1 - i.emptyKmPct / 100;
  const c = i.commissionPct / 100;
  return (i.costPerKm + (i.targetProfitPerHour + fixed) / i.avgSpeedKmh) / (paidShare * (1 - c));
}

export interface MinGrossPerHourInput {
  costPerKm: number;
  targetProfitPerHour: number;
  /** km parcurși în medie într-o oră de lucru (cu și fără client) */
  kmPerWorkHour: number;
  commissionPct: number;
  fixedCostPerHour?: number;
  /** procentul din timpul de lucru petrecut cu client; opțional */
  paidTimePct?: number;
}

/**
 * Încasarea brută minimă pe oră:
 *   pe oră de lucru  = (țintă + fix + km/oră × cost) / (1 − c)
 *   pe oră cu client = pe oră de lucru / procent timp cu client
 */
export function minGrossPerHour(i: MinGrossPerHourInput): { perWorkHour: number; perPaidHour: number | null } {
  assertCommissionPct(i.commissionPct);
  assertNonNegativeFinite(i.costPerKm, 'Cost pe km');
  assertNonNegativeFinite(i.targetProfitPerHour, 'Profit dorit pe oră');
  assertNonNegativeFinite(i.kmPerWorkHour, 'Km pe oră');
  const fixed = i.fixedCostPerHour ?? 0;
  assertNonNegativeFinite(fixed, 'Costuri fixe pe oră');

  const perWorkHour = (i.targetProfitPerHour + fixed + i.kmPerWorkHour * i.costPerKm) / (1 - i.commissionPct / 100);
  let perPaidHour: number | null = null;
  if (i.paidTimePct !== undefined) {
    assertNonNegativeFinite(i.paidTimePct, 'Timp cu client');
    perPaidHour = i.paidTimePct > 0 ? perWorkHour / (Math.min(i.paidTimePct, 100) / 100) : null;
  }
  return { perWorkHour, perPaidHour };
}
