import { assertCommissionPct, assertNonNegativeFinite } from './errors';
import { roundHalfUp } from './money';
import type { CostSnapshot, RideInput, RideResult } from './types';

/**
 * Calculează profitabilitatea unei curse (docs/ARHITECTURA.md § 6.2).
 *
 * Fiecare componentă se rotunjește la ban, iar profitul este diferența componentelor
 * rotunjite: rândurile din „Detalii calcul” se adună exact. Rapoartele (pe km, pe oră,
 * randament) pornesc de la profitul rotunjit, adică de la cifra pe care o vede șoferul.
 */
export function calculateRide(input: RideInput, snapshot: CostSnapshot): RideResult {
  assertCommissionPct(snapshot.commissionPct);
  assertNonNegativeFinite(snapshot.energyCostPerKm, 'Cost energie/km');
  assertNonNegativeFinite(snapshot.wearCostPerKm, 'Cost uzură/km');
  assertNonNegativeFinite(input.fareMinor, 'Sumă cursă');
  assertNonNegativeFinite(input.tripKm, 'Km cu client');
  assertNonNegativeFinite(input.tripMin, 'Minute cursă');
  assertNonNegativeFinite(input.pickupKm, 'Km până la client');
  assertNonNegativeFinite(input.pickupMin, 'Minute preluare');
  assertNonNegativeFinite(input.waitMin, 'Minute așteptare');
  assertNonNegativeFinite(input.tipMinor, 'Bacșiș');
  assertNonNegativeFinite(input.bonusMinor, 'Bonus');
  const override = input.energyCostOverrideMinor ?? null;
  if (override !== null) assertNonNegativeFinite(override, 'Cost energie');

  const c = snapshot.commissionPct / 100;

  let grossFareMinor: number;
  let commissionMinor: number;
  if (input.fareMode === 'gross') {
    grossFareMinor = roundHalfUp(input.fareMinor);
    commissionMinor = roundHalfUp(grossFareMinor * c);
  } else {
    grossFareMinor = roundHalfUp(input.fareMinor / (1 - c));
    commissionMinor = grossFareMinor - roundHalfUp(input.fareMinor);
  }

  const totalKm = input.tripKm + input.pickupKm;
  const totalMin = input.tripMin + input.pickupMin + input.waitMin;

  const tipMinor = roundHalfUp(input.tipMinor);
  const bonusMinor = roundHalfUp(input.bonusMinor);
  const grossIncomeMinor = grossFareMinor + tipMinor + bonusMinor;
  const incomeAfterCommissionMinor = grossIncomeMinor - commissionMinor;

  const energyCostMinor = override !== null ? roundHalfUp(override) : roundHalfUp(totalKm * snapshot.energyCostPerKm * 100);
  const wearCostMinor = roundHalfUp(totalKm * snapshot.wearCostPerKm * 100);
  const vehicleCostMinor = energyCostMinor + wearCostMinor;
  const totalCostMinor = commissionMinor + vehicleCostMinor;
  const profitMinor = grossIncomeMinor - totalCostMinor;

  const profit = profitMinor / 100;
  return {
    grossFareMinor,
    commissionMinor,
    grossIncomeMinor,
    incomeAfterCommissionMinor,
    energyCostMinor,
    wearCostMinor,
    vehicleCostMinor,
    totalCostMinor,
    profitMinor,
    totalKm,
    totalMin,
    profitPerKm: ratio(profit, totalKm),
    profitPerHour: ratio(profit, totalMin / 60),
    realCostPerKm: ratio(vehicleCostMinor / 100, totalKm),
    yieldPct: ratio(profitMinor * 100, grossIncomeMinor),
  };
}

/** Raport sigur: null dacă numitorul e 0 sau rezultatul nu e finit (ex. distanțe infinitezimale). */
export function ratio(numerator: number, denominator: number): number | null {
  if (!(denominator > 0)) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}
