// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { referenceEv, referenceRide, referenceThresholds, referenceWear } from '../../domain/__tests__/fixtures';
import { createBackupJson } from '../../services/backup';
import { db, resetDatabaseForTests } from '../../services/db';
import { createSettings, saveRide, saveVehicle } from '../../services/repositories';
import { App } from '../App';

beforeEach(async () => {
  await resetDatabaseForTests();
  const v = await saveVehicle({ name: 'Tesla', ...referenceEv, ...referenceWear });
  await createSettings({ currency: 'RON', commissionPct: { uber: 25, bolt: 25 }, thresholds: referenceThresholds }, v.id);
  const today = new Date();
  await saveRide({ startedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 30), platform: 'bolt', vehicleId: v.id, input: referenceRide, note: 'Aeroport Otopeni' });
  await saveRide({ startedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 10), platform: 'uber', vehicleId: v.id, input: { ...referenceRide, fareMinor: 1500, pickupKm: 4 } });
  // jsdom nu are URL.createObjectURL (folosit la descărcare)
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

const hero = () => document.querySelector('.hero-num')?.textContent;

describe('Etapa 5 în interfață', () => {
  it('obiectiv zilnic, cheltuială și efectul lor pe Acasă', async () => {
    const user = userEvent.setup();
    render(<App />);
    // 18,68 + (15 − 3,75 − 3,24 − 5,60 = 2,41) = 21,09
    await waitFor(() => expect(hero()).toBe('21,09RON'));

    await user.click(screen.getByRole('button', { name: /Setări/ }));
    await user.click(await screen.findByRole('button', { name: /Obiective și rezervă/ }));
    const goals = within(await screen.findByRole('dialog', { name: 'Obiective și rezervă' }));
    await user.type(goals.getByLabelText('Obiectiv zilnic'), '100');
    await user.type(goals.getByLabelText('Procent din profit pus deoparte'), '10');
    await user.click(goals.getByRole('button', { name: 'Salvează' }));

    await user.click(screen.getByRole('button', { name: /Istoric/ }));
    await user.click(await screen.findByRole('button', { name: 'Cheltuieli' }));
    await user.click(screen.getByRole('button', { name: 'Adaugă cheltuială' }));
    const exp = within(await screen.findByRole('dialog', { name: 'Cheltuială nouă' }));
    await user.selectOptions(exp.getByLabelText('Categorie'), 'carwash');
    await user.type(exp.getByLabelText('Sumă'), '10');
    await user.click(exp.getByRole('button', { name: 'Salvează' }));
    expect(await screen.findByText('Spălătorie')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Acasă/ }));
    await waitFor(() => expect(hero()).toBe('11,09RON'));
    expect(screen.getByText(/11% din obiectiv/)).toBeTruthy();
    expect(screen.getByText('1,11 RON')).toBeTruthy(); // rezerva de 10%
  });

  it('istoric: căutare, filtru verdict, cele mai slabe', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Istoric/ }));
    await screen.findByText(/2 curse/);
    await user.type(screen.getByPlaceholderText(/Caută/), 'otopeni');
    expect(await screen.findByText(/1 cursă/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bolt.*35,00 RON/ })).toBeTruthy();
    await user.clear(screen.getByPlaceholderText(/Caută/));
    await user.click(screen.getByRole('button', { name: /Nu merită/, pressed: false }));
    expect(await screen.findByRole('button', { name: /Uber.*15,00 RON/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Bolt.*35,00 RON/ })).toBeNull();
  });

  it('backup: pregătire și descărcare; restaurare: previzualizare și înlocuire', async () => {
    const user = userEvent.setup();
    const { json } = await createBackupJson();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Setări/ }));
    await user.click(await screen.findByRole('button', { name: /^Backup/ }));
    const b = within(await screen.findByRole('dialog', { name: 'Backup' }));
    await user.click(b.getByRole('button', { name: 'Pregătește backup-ul' }));
    expect(await b.findByText(/2 curse, 0 cheltuieli, 1 vehicule/)).toBeTruthy();
    await user.click(b.getByRole('button', { name: 'Salvează fișierul' }));
    await waitFor(async () => expect((await db.settings.get('app'))?.lastBackupAt).toBeInstanceOf(Date));
    await user.click(b.getByRole('button', { name: 'Închide' }));

    // șterge o cursă, apoi restaurează backup-ul anterior
    await db.rides.clear();
    await user.click(screen.getByRole('button', { name: /Restaurează din backup/ }));
    const r = within(await screen.findByRole('dialog', { name: 'Restaurează din backup' }));
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, new File([json], 'drivio-backup.json', { type: 'application/json' }));
    expect(await r.findByText('Fișier verificat')).toBeTruthy();
    await user.click(r.getByRole('button', { name: 'Restaurează' }));
    await user.click(r.getByRole('button', { name: 'Confirmă restaurarea' }));
    await waitFor(async () => expect(await db.rides.count()).toBe(2));
    expect(await screen.findByText('Backup restaurat')).toBeTruthy();
  });

  it('restaurarea respinge un fișier deteriorat', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Setări/ }));
    await user.click(await screen.findByRole('button', { name: /Restaurează din backup/ }));
    const r = within(await screen.findByRole('dialog', { name: 'Restaurează din backup' }));
    await user.upload(document.querySelector('input[type=file]') as HTMLInputElement, new File(['{"app":"altceva"}'], 'x.json', { type: 'application/json' }));
    expect(await r.findByText(/nu este un backup Drivio/)).toBeTruthy();
    expect(await db.rides.count()).toBe(2);
  });
});
