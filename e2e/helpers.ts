import { expect, type Page } from '@playwright/test';

/** Ghidul de pornire cu valorile exemplului de referință (doar pentru teste). */
export async function onboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Începe' }).tap();
  await page.getByLabel('Nume (cum îl recunoști)').fill('Tesla albă');
  await page.getByLabel('Consum real').fill('17');
  await page.getByLabel('Preț acasă').fill('1,00');
  await page.getByLabel('Preț stații publice').fill('2,20');
  await page.getByLabel('Procentul de energie încărcat acasă').fill('70');
  await page.getByLabel('Mentenanță').fill('0,10');
  await page.getByLabel('Depreciere').fill('0,25');
  await page.getByLabel('Alte costuri (opțional)').fill('0,05');
  await expect(page.getByText('0,631 RON/km')).toBeVisible();
  await page.getByRole('button', { name: 'Continuă' }).tap();

  await page.getByLabel('Uber').fill('25');
  await page.getByLabel('Bolt').fill('25');
  await page.getByLabel('Roșu sub').nth(0).fill('30');
  await page.getByLabel('Verde de la').nth(0).fill('40');
  await page.getByLabel('Roșu sub').nth(1).fill('1');
  await page.getByLabel('Verde de la').nth(1).fill('1,4');
  await page.getByRole('button', { name: 'Gata, deschide aplicația' }).tap();
  await expect(page.getByRole('heading', { name: 'Acasă' })).toBeVisible();
}

/** Introduce o cursă prin interfață. */
export async function addRide(page: Page, r: { fare: string; km: string; min: string; pickupKm?: string; pickupMin?: string; platform?: 'Uber' | 'Bolt' }) {
  await page.getByRole('button', { name: 'Cursă nouă' }).tap();
  const d = page.getByRole('dialog', { name: 'Cursă nouă' });
  if (r.platform) await d.getByRole('button', { name: r.platform, exact: true }).tap();
  await d.getByLabel('Sumă cursă (înainte de comision)').fill(r.fare);
  await d.getByLabel('Km cu client').fill(r.km);
  await d.getByLabel('Minute cursă').fill(r.min);
  if (r.pickupKm) await d.getByLabel('Km până la client').fill(r.pickupKm);
  if (r.pickupMin) await d.getByLabel('Minute până la client').fill(r.pickupMin);
  await d.getByRole('button', { name: 'Salvează cursa' }).tap();
  await expect(d).toBeHidden();
}
