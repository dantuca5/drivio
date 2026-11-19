import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addRide, onboard } from './helpers';

/**
 * Capturi de ecran ale fiecărui ecran (temă închisă și deschisă) pentru verificare vizuală
 * și o scanare de accesibilitate axe pe fiecare. Capturile ajung în e2e/screenshots/.
 */

async function seed(page: Page) {
  await onboard(page);
  await addRide(page, { fare: '35', km: '10', min: '20', pickupKm: '2', pickupMin: '7', platform: 'Bolt' });
  await addRide(page, { fare: '22,40', km: '6', min: '18', pickupKm: '3', pickupMin: '9', platform: 'Uber' });
  await addRide(page, { fare: '61,50', km: '24', min: '32', pickupKm: '1', pickupMin: '3', platform: 'Uber' });
  // câteva zile anterioare, pentru grafic
  await page.evaluate(async () => {
    const repo = await import('/src/services/repositories.ts');
    const { db } = await import('/src/services/db.ts');
    const s = await db.settings.get('app');
    const now = new Date();
    for (let d = 1; d < 7; d++) {
      for (let k = 0; k < 4; k++) {
        await repo.saveRide({
          startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, 8 + k * 3),
          platform: k % 2 ? 'uber' : 'bolt',
          vehicleId: s!.activeVehicleId!,
          input: { fareMinor: 1800 + ((d * 7 + k * 13) % 9) * 450, fareMode: 'gross', tripKm: 6 + k * 2, tripMin: 15 + k * 4, pickupKm: 2, pickupMin: 5, waitMin: 0, tipMinor: 0, bonusMinor: 0 },
        });
      }
    }
    await repo.updateSettings({ goals: { dailyMinor: 30000, monthlyMinor: 600000 }, taxReservePct: 10 });
  });
}

async function scan(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const issues = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`);
  expect(issues, `${name}: ${issues.join(' | ')}`).toEqual([]);
}

for (const scheme of ['dark', 'light'] as const) {
  test(`ecrane – tema ${scheme === 'dark' ? 'întunecată' : 'luminoasă'}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await seed(page);
    const shot = async (n: string, fullPage = false) => page.screenshot({ path: `e2e/screenshots/${scheme}-${n}.png`, fullPage });

    await page.getByRole('button', { name: /^Acasă/ }).tap();
    await page.reload();
    await expect(page.locator('.hero-num')).toBeVisible();
    await shot('1-acasa-azi');
    await scan(page, 'Acasă');
    await page.getByRole('button', { name: '7 zile' }).tap();
    await expect(page.locator('.chart-bar').first()).toBeVisible();
    await shot('2-acasa-7-zile', true);

    await page.getByRole('button', { name: 'Cursă nouă' }).tap();
    const d = page.getByRole('dialog', { name: 'Cursă nouă' });
    await d.getByLabel('Sumă cursă (înainte de comision)').fill('28');
    await d.getByLabel('Km cu client').fill('9');
    await d.getByLabel('Minute cursă').fill('24');
    await d.getByLabel('Km până la client').fill('3');
    await d.getByLabel('Minute până la client').fill('6');
    await page.locator('input:focus').blur();
    await shot('3-cursa-noua');
    await scan(page, 'Cursă nouă');
    await d.getByRole('button', { name: 'Închide' }).tap();

    await page.getByRole('button', { name: /Istoric/ }).tap();
    await shot('4-istoric');
    await scan(page, 'Istoric');

    await page.getByRole('button', { name: /Unelte/ }).tap();
    await page.getByRole('button', { name: /Compară două curse/ }).tap();
    const cmp = page.getByRole('dialog', { name: 'Compară două curse' });
    const sums = cmp.getByLabel('Sumă');
    await sums.nth(0).fill('35');
    await sums.nth(1).fill('48');
    await cmp.getByLabel('Km cu client').nth(0).fill('10');
    await cmp.getByLabel('Km cu client').nth(1).fill('19');
    await cmp.getByLabel('Minute cursă').nth(0).fill('20');
    await cmp.getByLabel('Minute cursă').nth(1).fill('35');
    await shot('5-compara', true);
    await scan(page, 'Compară');
    await cmp.getByRole('button', { name: 'Închide' }).tap();

    await page.getByRole('button', { name: /Setări/ }).tap();
    await shot('6-setari', true);
    await scan(page, 'Setări');
  });
}
