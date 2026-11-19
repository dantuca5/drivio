import { format } from 'date-fns';
import { evaluateVerdict, fromMinor, type Thresholds } from '../domain';
import type { ExpenseEntity, RideEntity, VehicleEntity } from './entities';

/**
 * CSV pentru Excel / Numbers în setări românești: separator „;”, virgulă zecimală,
 * UTF-8 cu BOM (diacriticele apar corect în Excel).
 */

const SEP = ';';
const BOM = '﻿';

const decimal = (n: number | null, digits = 2) => (n === null || !Number.isFinite(n) ? '' : n.toFixed(digits).replace('.', ','));
const moneyCell = (minor: number) => decimal(fromMinor(minor));

/** Text sigur: ghilimele când e nevoie și protecție împotriva formulelor (=, +, -, @). */
export function textCell(value: string | undefined): string {
  let s = value ?? '';
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const VERDICT = { go: 'Merită', slow: 'La limită', stop: 'Nu merită' } as const;
const PLATFORM = { uber: 'Uber', bolt: 'Bolt' } as const;

export function ridesToCsv(rides: readonly RideEntity[], vehicles: readonly VehicleEntity[], thresholds: Thresholds, currency: string): string {
  const vName = new Map(vehicles.map((v) => [v.id, v.name]));
  const header = [
    'Data', 'Ora', 'Platformă', 'Vehicul', `Tarif brut (${currency})`, `Bacșiș (${currency})`, `Bonus (${currency})`,
    `Venit brut (${currency})`, 'Comision %', `Comision (${currency})`, 'Km cu client', 'Km până la client', 'Km total',
    'Minute total', `Energie (${currency})`, `Uzură (${currency})`, `Cost total (${currency})`,
    `Profit operațional estimat (${currency})`, `Profit/km (${currency})`, `Profit/oră (${currency})`, 'Randament %', 'Verdict', 'Notă',
  ];
  const rows = [...rides]
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .map((r) => {
      const x = r.result;
      return [
        format(r.startedAt, 'dd.MM.yyyy'),
        format(r.startedAt, 'HH:mm'),
        PLATFORM[r.platform],
        textCell(vName.get(r.vehicleId) ?? ''),
        moneyCell(x.grossFareMinor),
        moneyCell(r.input.tipMinor),
        moneyCell(r.input.bonusMinor),
        moneyCell(x.grossIncomeMinor),
        decimal(r.snapshot.commissionPct, 1),
        moneyCell(x.commissionMinor),
        decimal(r.input.tripKm, 1),
        decimal(r.input.pickupKm, 1),
        decimal(x.totalKm, 1),
        decimal(x.totalMin, 0),
        moneyCell(x.energyCostMinor),
        moneyCell(x.wearCostMinor),
        moneyCell(x.totalCostMinor),
        moneyCell(x.profitMinor),
        decimal(x.profitPerKm),
        decimal(x.profitPerHour),
        decimal(x.yieldPct, 1),
        VERDICT[evaluateVerdict(x, thresholds).level],
        textCell(r.note),
      ].join(SEP);
    });
  return BOM + [header.map(textCell).join(SEP), ...rows].join('\r\n') + '\r\n';
}

export function expensesToCsv(expenses: readonly ExpenseEntity[], labels: Record<string, string>, currency: string): string {
  const header = ['Data', 'Categorie', `Sumă (${currency})`, 'Notă'];
  const rows = [...expenses]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => [format(e.date, 'dd.MM.yyyy'), textCell(labels[e.category] ?? e.category), moneyCell(e.amountMinor), textCell(e.note)].join(SEP));
  return BOM + [header.map(textCell).join(SEP), ...rows].join('\r\n') + '\r\n';
}
