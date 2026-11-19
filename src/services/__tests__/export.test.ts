import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { calculateRide, platformComparison, resolvePeriod, summarize } from '../../domain';
import { referenceRide, referenceSnapshot, referenceThresholds } from '../../domain/__tests__/fixtures';
import type { ExpenseEntity, RideEntity, VehicleEntity } from '../entities';
import { expensesToCsv, ridesToCsv, textCell } from '../exportCsv';
import { buildPdfReport } from '../exportPdf';

const now = new Date(2026, 10, 19, 22);
const ride = (patch: Partial<RideEntity> = {}): RideEntity => ({
  id: crypto.randomUUID(),
  startedAt: new Date(2026, 10, 19, 9, 5),
  platform: 'bolt',
  vehicleId: 'v1',
  source: 'manual',
  input: referenceRide,
  commissionOverridden: false,
  snapshot: referenceSnapshot,
  result: calculateRide(referenceRide, referenceSnapshot),
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...patch,
});
const vehicles = [{ id: 'v1', name: 'Tesla; albă' }] as VehicleEntity[];

describe('CSV', () => {
  it('format românesc: BOM, „;”, virgulă zecimală, valori corecte', () => {
    const csv = ridesToCsv([ride({ note: 'Aeroport, „Otopeni”' })], vehicles, referenceThresholds, 'RON');
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, row] = csv.slice(1).trim().split('\r\n');
    expect(header!.split(';')).toHaveLength(23);
    const cells = row!.split(';');
    expect(cells.slice(0, 3)).toEqual(['19.11.2026', '09:05', 'Bolt']);
    expect(csv).toContain('"Tesla; albă"');
    expect(cells).toContain('18,68'); // profit
    expect(cells).toContain('41,51'); // profit pe oră
    expect(cells).toContain('Merită');
    expect(row).toContain('Aeroport, „Otopeni”');
  });

  it('textul care arată ca o formulă nu se execută în Excel', () => {
    expect(textCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(textCell('+40 bonus')).toBe("'+40 bonus");
    expect(textCell('linie 1\nlinie 2')).toBe('"linie 1\nlinie 2"');
  });

  it('cheltuieli', () => {
    const e = { id: 'e', date: new Date(2026, 10, 19), category: 'service', amountMinor: 25050, createdAt: now, updatedAt: now, deletedAt: null } as ExpenseEntity;
    expect(expensesToCsv([e], { service: 'Service' }, 'RON')).toContain('19.11.2026;Service;250,50;');
  });
});

describe('PDF', () => {
  it('generează un PDF valid, cu fontul inclus (diacritice)', async () => {
    const require = createRequire(import.meta.url);
    const font = (p: string) => readFileSync(require.resolve(`@expo-google-fonts/barlow/${p}`)).toString('base64');
    const rides = [ride(), ride({ platform: 'uber', note: 'Ștefan cel Mare' })];
    const range = resolvePeriod({ kind: 'today' }, now);
    const blob = await buildPdfReport(
      {
        title: 'Raport Drivio',
        periodLabel: 'Astăzi, 19 noiembrie 2026',
        currency: 'RON',
        generatedAt: now,
        summary: summarize({ rides, expenses: [], fixedCosts: [], range, now, taxReservePct: 10 }),
        platforms: platformComparison(rides),
        rides,
        expenses: [],
        expenseLabels: {},
      },
      { regular: font('400Regular/Barlow_400Regular.ttf'), bold: font('600SemiBold/Barlow_600SemiBold.ttf') },
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toContain('/FontFile2'); // fontul TrueType e inclus în document
    expect(text).toContain('Barlow');
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
