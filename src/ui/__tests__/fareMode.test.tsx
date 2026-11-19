// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { referenceEv, referenceThresholds, referenceWear } from '../../domain/__tests__/fixtures';
import { db, resetDatabaseForTests } from '../../services/db';
import { createSettings, saveVehicle } from '../../services/repositories';
import { App } from '../App';

const NET = 'Sumă primită (după comision)';
const GROSS = 'Sumă cursă (înainte de comision)';

beforeEach(async () => {
  await resetDatabaseForTests();
  const v = await saveVehicle({ name: 'Tesla', ...referenceEv, ...referenceWear });
  await createSettings({ currency: 'RON', commissionPct: { uber: 25, bolt: 25 }, thresholds: referenceThresholds }, v.id);
});
afterEach(() => cleanup());

describe('suma din ofertă, pe platformă', () => {
  it('o cursă nouă pornește pe suma netă și salvează tariful brut calculat', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Cursă nouă' }));
    const d = within(await screen.findByRole('dialog', { name: 'Cursă nouă' }));
    await user.type(d.getByLabelText(NET), '26,25');
    await user.type(d.getByLabelText('Km cu client'), '10');
    await user.type(d.getByLabelText('Minute cursă'), '20');
    await user.click(d.getByRole('button', { name: 'Salvează cursa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [ride] = await db.rides.toArray();
    expect(ride?.input.fareMode).toBe('net');
    expect(ride?.result.grossFareMinor).toBe(3500); // 26,25 / (1 − 25%)
  });

  it('tipul sumei urmează platforma până îl alegi tu', async () => {
    await db.settings.update('app', { fareModeByPlatform: { uber: 'net', bolt: 'gross' } });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Cursă nouă' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cursă nouă' });
    const d = within(dialog);
    expect(d.getByLabelText(NET)).toBeTruthy();
    await user.click(within(d.getByRole('group', { name: 'Platformă' })).getByRole('button', { name: 'Bolt' }));
    expect(d.getByLabelText(GROSS)).toBeTruthy();

    // alegerea manuală rămâne și când schimbi platforma
    await user.click(d.getByRole('button', { name: /Mai mult/ }));
    await user.click(within(d.getByRole('group', { name: 'Tipul sumei' })).getByRole('button', { name: 'Sumă netă' }));
    await user.click(within(d.getByRole('group', { name: 'Platformă' })).getByRole('button', { name: 'Uber' }));
    await user.click(within(d.getByRole('group', { name: 'Platformă' })).getByRole('button', { name: 'Bolt' }));
    expect(d.getByLabelText(NET)).toBeTruthy();
  });

  it('setarea se schimbă din Comisioane și praguri', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Setări/ }));
    await user.click(await screen.findByRole('button', { name: /Comisioane și praguri/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Comisioane și praguri' }));
    const bolt = within(sheet.getByRole('group', { name: 'Suma din oferta Bolt' }));
    expect(bolt.getByRole('button', { name: 'Netă' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(bolt.getByRole('button', { name: 'Brută' }));
    await user.click(sheet.getByRole('button', { name: 'Salvează' }));
    await waitFor(async () => expect((await db.settings.get('app'))?.fareModeByPlatform).toEqual({ uber: 'net', bolt: 'gross' }));
  });
});
