import { z } from 'zod';
import { EXPENSE_CATEGORIES } from './types';

/**
 * Scheme de validare pentru toate intrările. Aceleași scheme vor valida formularele,
 * importul de backup și importurile viitoare. Limitele superioare prind greșelile
 * de tastare (ex. 20000 km în loc de 20), nu impun valori financiare.
 */

const num = (label: string, min: number, max: number, opts: { exclusiveMin?: boolean } = {}) => {
  const base = z.number({ error: `${label}: introdu un număr.` });
  const withMin = opts.exclusiveMin
    ? base.gt(min, `${label}: trebuie să fie mai mare decât ${fmt(min)}.`)
    : base.min(min, `${label}: minim ${fmt(min)}.`);
  return withMin.max(max, `${label}: maxim ${fmt(max)}.`);
};

const minor = (label: string, max: number, opts: { positive?: boolean } = {}) =>
  z
    .number({ error: `${label}: introdu un număr.` })
    .int(`${label}: suma are prea multe zecimale.`)
    .min(opts.positive ? 1 : 0, opts.positive ? `${label}: trebuie să fie mai mare decât 0.` : `${label}: minim 0.`)
    .max(max, `${label}: maxim ${fmt(max / 100)}.`);

const fmt = (n: number) => n.toLocaleString('ro-RO');

const name = (label: string) =>
  z.string({ error: `${label}: obligatoriu.` }).trim().min(1, `${label}: obligatoriu.`).max(60, `${label}: maxim 60 de caractere.`);

export const commissionPctSchema = num('Comision %', 0, 99.9);

export const rideInputSchema = z.object({
  fareMinor: minor('Sumă cursă', 10_000_000),
  fareMode: z.enum(['gross', 'net'], { error: 'Alege brut sau net.' }),
  tripKm: num('Km cu client', 0, 2000),
  tripMin: num('Minute cursă', 0, 1440),
  pickupKm: num('Km până la client', 0, 500),
  pickupMin: num('Minute preluare', 0, 600),
  waitMin: num('Minute așteptare', 0, 600),
  tipMinor: minor('Bacșiș', 1_000_000),
  bonusMinor: minor('Bonus', 1_000_000),
  energyCostOverrideMinor: minor('Cost energie', 1_000_000).nullable().optional(),
});

const wearSchema = z.object({
  tiresSetCost: num('Cost set anvelope', 0, 100_000),
  tiresLifetimeKm: num('Durată de viață anvelope (km)', 0, 500_000),
  maintenancePerKm: num('Mentenanță pe km', 0, 20),
  depreciationPerKm: num('Depreciere pe km', 0, 20),
  otherPerKm: num('Alte costuri pe km', 0, 20),
});

const vehicleMeta = z.object({
  name: name('Nume vehicul'),
  make: z.string().trim().max(40).optional(),
  model: z.string().trim().max(40).optional(),
});

const fuelVehicle = vehicleMeta.extend(wearSchema.shape).extend({
  powertrain: z.enum(['petrol', 'diesel', 'lpg', 'hybrid']),
  fuelConsumptionLPer100: num('Consum (L/100 km)', 0, 50, { exclusiveMin: true }),
  fuelPricePerL: num('Preț combustibil pe litru', 0, 100, { exclusiveMin: true }),
});

const evVehicle = vehicleMeta.extend(wearSchema.shape).extend({
  powertrain: z.literal('electric'),
  evConsumptionKWhPer100: num('Consum (kWh/100 km)', 0, 60, { exclusiveMin: true }),
  homePricePerKWh: num('Preț kWh acasă', 0, 20),
  publicPricePerKWh: num('Preț kWh la stații publice', 0, 20),
  homeSharePct: num('Procent încărcare acasă', 0, 100),
  chargingLossPct: num('Pierderi la încărcare %', 0, 50),
  batteryKWh: num('Capacitate baterie (kWh)', 1, 250).nullable().optional(),
});

export const vehicleSchema = z
  .discriminatedUnion('powertrain', [fuelVehicle, evVehicle], { error: 'Alege tipul de motorizare.' })
  .refine((v) => !(v.tiresSetCost > 0 && v.tiresLifetimeKm === 0), {
    message: 'Durată de viață anvelope: introdu câți km rezistă setul, altfel costul lor nu poate fi calculat.',
    path: ['tiresLifetimeKm'],
  });

export const thresholdsSchema = z
  .object({
    redBelowPerHour: num('Prag roșu RON/oră', 0, 10_000),
    greenFromPerHour: num('Prag verde RON/oră', 0, 10_000),
    redBelowPerKm: num('Prag roșu RON/km', 0, 1_000),
    greenFromPerKm: num('Prag verde RON/km', 0, 1_000),
  })
  .refine((t) => t.redBelowPerHour <= t.greenFromPerHour, {
    message: 'Pragul roșu pe oră trebuie să fie cel mult egal cu pragul verde.',
    path: ['redBelowPerHour'],
  })
  .refine((t) => t.redBelowPerKm <= t.greenFromPerKm, {
    message: 'Pragul roșu pe km trebuie să fie cel mult egal cu pragul verde.',
    path: ['redBelowPerKm'],
  });

export const expenseSchema = z.object({
  date: z.date({ error: 'Alege data.' }),
  category: z.enum(EXPENSE_CATEGORIES as [string, ...string[]], { error: 'Alege categoria.' }),
  amountMinor: minor('Sumă cheltuială', 100_000_000, { positive: true }),
  note: z.string().trim().max(200, 'Nota: maxim 200 de caractere.').optional(),
});

export const fixedCostSchema = z
  .object({
    name: name('Nume cost'),
    monthlyAmountMinor: minor('Sumă lunară', 100_000_000, { positive: true }),
    activeFrom: z.date({ error: 'Alege data de început.' }),
    activeUntil: z.date().nullable(),
  })
  .refine((f) => f.activeUntil === null || f.activeUntil > f.activeFrom, {
    message: 'Data de oprire trebuie să fie după data de început.',
    path: ['activeUntil'],
  });

export const goalsSchema = z.object({
  dailyMinor: minor('Obiectiv zilnic', 100_000_000).nullable(),
  monthlyMinor: minor('Obiectiv lunar', 1_000_000_000).nullable(),
});

export const taxReservePctSchema = num('Rezervă taxe %', 0, 100);

export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'Moneda trebuie să fie un cod de 3 litere (ex. RON, EUR).');
