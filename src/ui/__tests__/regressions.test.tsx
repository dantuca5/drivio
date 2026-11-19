// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { referenceEv, referenceThresholds, referenceWear } from '../../domain/__tests__/fixtures';
import { db, resetDatabaseForTests } from '../../services/db';
import { createSettings, saveVehicle } from '../../services/repositories';
import { App } from '../App';

beforeEach(async () => {
  await resetDatabaseForTests();
  const v = await saveVehicle({ name: 'Tesla', ...referenceEv, ...referenceWear });
  await createSettings({ currency: 'RON', commissionPct: { uber: 25, bolt: 25 }, thresholds: referenceThresholds, fareModeByPlatform: { uber: 'gross', bolt: 'gross' } }, v.id);
});
afterEach(() => cleanup());

describe('regresii Etapa 6', () => {
  it('Enter apăsat de două ori repede salvează o singură cursă', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Cursă nouă' }));
    const d = within(await screen.findByRole('dialog', { name: 'Cursă nouă' }));
    // focusul rămâne pe sumă (foaia nu-l fură)
    expect(document.activeElement).toBe(d.getByLabelText('Sumă cursă (înainte de comision)'));
    await user.keyboard('35');
    await user.type(d.getByLabelText('Km cu client'), '10');
    await user.type(d.getByLabelText('Minute cursă'), '20{Enter}{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await db.rides.count()).toBe(1);
  });

  it('Escape închide doar foaia de deasupra', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Setări/ }));
    await user.click(await screen.findByRole('button', { name: /Costuri fixe lunare/ }));
    await user.click(await screen.findByRole('button', { name: 'Adaugă cost fix' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Costuri fixe lunare' })).toBeTruthy();
  });

  it('cheltuiala „1.500” înseamnă 1.500 lei, iar „12,345” e respinsă', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Istoric/ }));
    await user.click(await screen.findByRole('button', { name: 'Cheltuieli' }));
    await user.click(screen.getByRole('button', { name: 'Adaugă cheltuială' }));
    const e = within(await screen.findByRole('dialog', { name: 'Cheltuială nouă' }));
    await user.type(e.getByLabelText('Sumă'), '12,345');
    await user.click(e.getByRole('button', { name: 'Salvează' }));
    expect(e.getByText('Suma poate avea cel mult 2 zecimale.')).toBeTruthy();
    await user.clear(e.getByLabelText('Sumă'));
    await user.type(e.getByLabelText('Sumă'), '1.500');
    await user.click(e.getByRole('button', { name: 'Salvează' }));
    await waitFor(async () => expect((await db.expenses.toArray())[0]?.amountMinor).toBe(150000));
  });

  it('o cursă cu data în viitor nu se salvează', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Cursă nouă' }));
    const d = within(await screen.findByRole('dialog', { name: 'Cursă nouă' }));
    await user.type(d.getByLabelText('Sumă cursă (înainte de comision)'), '35');
    await user.type(d.getByLabelText('Km cu client'), '10');
    await user.type(d.getByLabelText('Minute cursă'), '20');
    await user.click(d.getByRole('button', { name: /Mai mult/ }));
    const date = d.getByLabelText('Data și ora') as HTMLInputElement;
    const next = new Date(Date.now() + 3 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    // datetime-local nu poate fi tastat în jsdom; setăm valoarea direct
    await user.clear(date);
    await user.type(date, `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T10:00`);
    await user.click(d.getByRole('button', { name: 'Salvează cursa' }));
    expect(await d.findByText(/în viitor/)).toBeTruthy();
    expect(await db.rides.count()).toBe(0);
  });
});
