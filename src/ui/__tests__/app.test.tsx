// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabaseForTests } from '../../services/db';
import { App } from '../App';

beforeEach(async () => {
  await resetDatabaseForTests();
});
afterEach(() => cleanup());

async function completeOnboarding(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Începe' }));

  await user.type(screen.getByLabelText('Nume (cum îl recunoști)'), 'Logan');
  await user.selectOptions(screen.getByLabelText('Motorizare'), 'petrol');
  await user.type(screen.getByLabelText('Consum mediu'), '7');
  await user.type(screen.getByLabelText('Preț combustibil'), '7,50');
  await user.type(screen.getByLabelText('Mentenanță'), '0,10');
  await user.type(screen.getByLabelText('Depreciere'), '0,25');
  // previzualizarea: 0,525 energie + 0,350 uzură
  expect(screen.getByText('0,875 RON/km')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Continuă' }));

  await user.type(await screen.findByLabelText('Uber'), '25');
  await user.type(screen.getByLabelText('Bolt'), '25');
  const red = screen.getAllByLabelText('Roșu sub');
  const green = screen.getAllByLabelText('Verde de la');
  await user.type(red[0]!, '30');
  await user.type(green[0]!, '40');
  await user.type(red[1]!, '1');
  await user.type(green[1]!, '1,2');
  await user.click(screen.getByRole('button', { name: 'Gata, deschide aplicația' }));
  await screen.findByRole('heading', { name: 'Acasă' });
}

describe('aplicația, cap-coadă', () => {
  it('ghid de pornire → cursă nouă cu verdict live → acasă → istoric → ștergere cu anulare', async () => {
    const user = userEvent.setup();
    render(<App />);
    await completeOnboarding(user);

    expect(await screen.findByText('Nicio cursă în această perioadă')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cursă nouă' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cursă nouă' });
    const d = within(dialog);
    expect(d.getByText('Completează suma, km cu client și minutele cursei.')).toBeTruthy();

    await user.type(d.getByLabelText('Sumă cursă (înainte de comision)'), '35');
    await user.type(d.getByLabelText('Km cu client'), '10');
    await user.type(d.getByLabelText('Minute cursă'), '20');
    await user.type(d.getByLabelText('Km până la client'), '2');
    await user.type(d.getByLabelText('Minute până la client'), '5');

    // 35 − 8,75 comision − 6,30 combustibil − 4,20 uzură = 15,75 RON în 25 min → 37,80 RON/oră → galben
    expect(d.getByText('La limită')).toBeTruthy();
    expect(d.getByText('Profit 15,75')).toBeTruthy();

    await user.click(d.getByRole('button', { name: 'Salvează cursa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Cursă salvată')).toBeTruthy();
    // profitul zilei pe Acasă (cifra mare) și profitul mediu pe cursă
    await waitFor(() => expect(document.querySelector('.hero-num')?.textContent).toBe('15,75RON'));
    expect(screen.getAllByText('15,75')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Istoric/ }));
    const row = await screen.findByRole('button', { name: /Uber.*35,00 RON/ });
    await user.click(row);
    const edit = await screen.findByRole('dialog', { name: 'Editează cursa' });
    expect((within(edit).getByLabelText('Sumă cursă (înainte de comision)') as HTMLInputElement).value).toBe('35,00');

    await user.click(within(edit).getByRole('button', { name: 'Șterge' }));
    expect(await screen.findByText('Nicio cursă salvată')).toBeTruthy();
    expect((await db.rides.toArray())[0]?.deletedAt).toBeInstanceOf(Date);

    await user.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(await screen.findByRole('button', { name: /Uber.*35,00 RON/ })).toBeTruthy();
  });

  it('nu salvează o cursă incompletă și arată ce lipsește', async () => {
    const user = userEvent.setup();
    render(<App />);
    await completeOnboarding(user);
    await user.click(screen.getByRole('button', { name: 'Cursă nouă' }));
    const d = within(await screen.findByRole('dialog', { name: 'Cursă nouă' }));
    await user.type(d.getByLabelText('Sumă cursă (înainte de comision)'), '20');
    await user.click(d.getByRole('button', { name: 'Salvează cursa' }));
    expect(d.getByText('Introdu km cu client.')).toBeTruthy();
    expect(d.getByText('Introdu durata cursei.')).toBeTruthy();
    expect(await db.rides.count()).toBe(0);
  });

  it('ghidul de pornire nu acceptă praguri incoerente', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Începe' }));
    await user.type(screen.getByLabelText('Nume (cum îl recunoști)'), 'EV');
    await user.type(screen.getByLabelText('Consum real'), '17');
    await user.type(screen.getByLabelText('Preț acasă'), '1');
    await user.type(screen.getByLabelText('Preț stații publice'), '2,2');
    await user.type(screen.getByLabelText('Mentenanță'), '0,1');
    await user.type(screen.getByLabelText('Depreciere'), '0,3');
    await user.click(screen.getByRole('button', { name: 'Continuă' }));
    await user.type(await screen.findByLabelText('Uber'), '25');
    await user.type(screen.getByLabelText('Bolt'), '100');
    const red = screen.getAllByLabelText('Roșu sub');
    const green = screen.getAllByLabelText('Verde de la');
    await user.type(red[0]!, '50');
    await user.type(green[0]!, '40');
    await user.type(red[1]!, '1');
    await user.type(green[1]!, '1,2');
    await user.click(screen.getByRole('button', { name: 'Gata, deschide aplicația' }));
    expect(screen.getByText(/Comision %: maxim/)).toBeTruthy();
    expect(screen.getByText(/Pragul roșu pe oră/)).toBeTruthy();
    expect(await db.settings.count()).toBe(0);
  });
});
