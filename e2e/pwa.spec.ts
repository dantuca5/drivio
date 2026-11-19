import { expect, test } from '@playwright/test';
import { addRide, onboard } from './helpers';

const PROD = 'http://127.0.0.1:5181';
test.use({ baseURL: PROD });

test.describe('instalare pe iPhone și funcționare offline (build de producție)', () => {
  test('manifest, icoane și etichete iOS', async ({ page, request }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await (await request.get(new URL(manifestHref!, PROD).href)).json();
    expect(manifest).toMatchObject({ short_name: 'Drivio', display: 'standalone', lang: 'ro', start_url: '/' });
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(new URL(icon.src, PROD).href)).status(), icon.src).toBe(200);
    }
    for (const sel of ['link[rel=apple-touch-icon]', 'link[rel=apple-touch-startup-image]']) {
      const hrefs = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
      expect(hrefs.length, sel).toBeGreaterThan(0);
      for (const h of hrefs) expect((await request.get(new URL(h, PROD).href)).status(), h).toBe(200);
    }
    await expect(page.locator('meta[name=apple-mobile-web-app-capable]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /viewport-fit=cover/);
  });

  test('după prima deschidere, aplicația merge fără internet (inclusiv cursă nouă și PDF)', async ({ page, context }) => {
    await onboard(page);
    // așteaptă ca lucrătorul offline să fie activ (a salvat toate fișierele), apoi o repornire îl pune la control
    const supported = await page.evaluate(() => 'serviceWorker' in navigator);
    test.skip(!supported, 'Acest WebKit nu are lucrători offline');
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sw = reg.active!;
      if (sw.state !== 'activated') await new Promise((r) => sw.addEventListener('statechange', () => sw.state === 'activated' && r(null)));
      return sw.state;
    });
    expect(state).toBe('activated');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Acasă' })).toBeVisible();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Acasă' })).toBeVisible();
    await addRide(page, { fare: '35', km: '10', min: '20', pickupKm: '2', pickupMin: '7' });
    await expect(page.locator('.hero-num')).toHaveText('18,68RON');

    await page.getByRole('button', { name: /Exportă perioada/ }).tap();
    const ex = page.getByRole('dialog', { name: 'Exportă' });
    await ex.getByRole('button', { name: 'Pregătește fișierul' }).tap();
    await expect(ex.getByText(/drivio-raport-.*\.pdf/)).toBeVisible({ timeout: 15_000 });
    await context.setOffline(false);
  });
});
