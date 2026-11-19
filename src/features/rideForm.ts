import {
  calculateRide,
  commissionPctSchema,
  evaluateVerdict,
  formatNumber,
  fromMinor,
  parseDecimal,
  parseMoney,
  rideInputSchema,
  toMinor,
  type CostSnapshot,
  type FareMode,
  type RideInput,
  type RideResult,
  type Thresholds,
  type Verdict,
} from '../domain';

/** Valorile formularului de cursă, exact cum le-a tastat utilizatorul. */
export interface RideFormValues {
  fare: string;
  fareMode: FareMode;
  tripKm: string;
  tripMin: string;
  pickupKm: string;
  pickupMin: string;
  waitMin: string;
  tip: string;
  bonus: string;
  /** gol = comisionul platformei din setări */
  commission: string;
  /** gol = cost estimat din vehicul */
  energyOverride: string;
}

export const emptyRideForm: RideFormValues = {
  fare: '',
  fareMode: 'gross',
  tripKm: '',
  tripMin: '',
  pickupKm: '',
  pickupMin: '',
  waitMin: '',
  tip: '',
  bonus: '',
  commission: '',
  energyOverride: '',
};

export type RideFormErrors = Partial<Record<keyof RideFormValues, string>>;

const REQUIRED: Partial<Record<keyof RideFormValues, string>> = {
  fare: 'Introdu suma cursei.',
  tripKm: 'Introdu km cu client.',
  tripMin: 'Introdu durata cursei.',
};

/** Câmpurile în lei: acceptă punct de mii („1.250”) și cel mult 2 zecimale. */
const MONEY_FIELDS = new Set<keyof RideFormValues>(['fare', 'tip', 'bonus', 'energyOverride']);

const FIELD_FOR_INPUT: Record<string, keyof RideFormValues> = {
  fareMinor: 'fare',
  tripKm: 'tripKm',
  tripMin: 'tripMin',
  pickupKm: 'pickupKm',
  pickupMin: 'pickupMin',
  waitMin: 'waitMin',
  tipMinor: 'tip',
  bonusMinor: 'bonus',
  energyCostOverrideMinor: 'energyOverride',
};

export interface ParsedRideForm {
  input: RideInput | null;
  /** comisionul introdus manual, dacă există */
  commissionPct: number | undefined;
  errors: RideFormErrors;
}

/** Transformă textul din formular în date validate. Câmpurile opționale goale înseamnă 0. */
export function parseRideForm(v: RideFormValues): ParsedRideForm {
  const errors: RideFormErrors = {};
  const read = (key: keyof RideFormValues): number | null => {
    const raw = v[key];
    if (raw.trim() === '') {
      const req = REQUIRED[key];
      if (req) errors[key] = req;
      return key === 'energyOverride' || key === 'commission' ? null : 0;
    }
    if (MONEY_FIELDS.has(key)) {
      const m = parseMoney(raw);
      if (m === null) errors[key] = parseDecimal(raw) === null ? 'Număr invalid.' : 'Suma poate avea cel mult 2 zecimale.';
      return m;
    }
    const n = parseDecimal(raw);
    if (n === null) errors[key] = 'Număr invalid.';
    return n;
  };

  const fare = read('fare');
  const tripKm = read('tripKm');
  const tripMin = read('tripMin');
  const pickupKm = read('pickupKm');
  const pickupMin = read('pickupMin');
  const waitMin = read('waitMin');
  const tip = read('tip');
  const bonus = read('bonus');
  const commission = read('commission');
  const energy = read('energyOverride');

  let commissionPct: number | undefined;
  if (commission !== null && !errors.commission) {
    const c = commissionPctSchema.safeParse(commission);
    if (c.success) commissionPct = c.data;
    else errors.commission = c.error.issues[0]?.message ?? 'Comision invalid.';
  }

  if (Object.keys(errors).length > 0) return { input: null, commissionPct, errors };

  const candidate: RideInput = {
    fareMinor: toMinor(fare!),
    fareMode: v.fareMode,
    tripKm: tripKm!,
    tripMin: tripMin!,
    pickupKm: pickupKm!,
    pickupMin: pickupMin!,
    waitMin: waitMin!,
    tipMinor: toMinor(tip!),
    bonusMinor: toMinor(bonus!),
    energyCostOverrideMinor: energy === null ? null : toMinor(energy),
  };
  const parsed = rideInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = FIELD_FOR_INPUT[String(issue.path[0])];
      if (field && !errors[field]) errors[field] = issue.message;
    }
    return { input: null, commissionPct, errors };
  }
  return { input: parsed.data, commissionPct, errors };
}

/** Rezultatul live afișat în formular. */
export interface LiveCalculation {
  result: RideResult;
  verdict: Verdict;
  snapshot: CostSnapshot;
}

export function liveCalculation(
  parsed: ParsedRideForm,
  base: { energyCostPerKm: number; wearCostPerKm: number; platformCommissionPct: number },
  thresholds: Thresholds,
): LiveCalculation | null {
  if (!parsed.input) return null;
  const snapshot: CostSnapshot = {
    commissionPct: parsed.commissionPct ?? base.platformCommissionPct,
    energyCostPerKm: base.energyCostPerKm,
    wearCostPerKm: base.wearCostPerKm,
  };
  const result = calculateRide(parsed.input, snapshot);
  return { result, verdict: evaluateVerdict(result, thresholds), snapshot };
}

/** Pentru editare: transformă o cursă salvată înapoi în text de formular. */
export function rideInputToForm(input: RideInput, commissionPct: number | undefined): RideFormValues {
  const money = (m: number) => (m === 0 ? '' : formatNumber(fromMinor(m), 2).replace(/\./g, ''));
  const plain = (n: number) => (n === 0 ? '' : String(n).replace('.', ','));
  return {
    fare: formatNumber(fromMinor(input.fareMinor), 2).replace(/\./g, ''),
    fareMode: input.fareMode,
    tripKm: String(input.tripKm).replace('.', ','),
    tripMin: String(input.tripMin).replace('.', ','),
    pickupKm: plain(input.pickupKm),
    pickupMin: plain(input.pickupMin),
    waitMin: plain(input.waitMin),
    tip: money(input.tipMinor),
    bonus: money(input.bonusMinor),
    commission: commissionPct === undefined ? '' : String(commissionPct).replace('.', ','),
    energyOverride:
      input.energyCostOverrideMinor === null || input.energyCostOverrideMinor === undefined
        ? ''
        : formatNumber(fromMinor(input.energyCostOverrideMinor), 2).replace(/\./g, ''),
  };
}
