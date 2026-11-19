import { expect, test } from '@playwright/test';

/**
 * Verifică aplicația publicată (nu rulează implicit). Pornire:
 *   LIVE_URL=https://dantuca5.github.io/drivio/ npx playwright test e2e/live.spec.ts
 */
const LIVE = process.env.LIVE_URL;
test.skip(!LIVE, 'setează LIVE_URL ca să verifici site-ul publicat');

test('site-ul publicat: HTTPS, manifest, icoane, pornire și offline', async ({ page, context, request }) => {
  await page.goto(LIVE!);
  await expect(page.getByRole('button', { name: 'Începe' })).toBeVisible();
  expect(page.url().startsWith('https://')).toBe(true);

  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifestUrl = new URL(href!, page.url()).href;
  const manifest = await (await request.get(manifestUrl)).json();
  expect(manifest.start_url).toBe('/drivio/');
  for (const i of manifest.icons) expect((await request.get(new URL(i.src, manifestUrl).href)).status(), i.src).toBe(200);
  const apple = await page.locator('link[rel=apple-touch-icon]').getAttribute('href');
  expect((await request.get(new URL(apple!, page.url()).href)).status()).toBe(200);

  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active!;
    if (sw.state !== 'activated') await new Promise((r) => sw.addEventListener('statechange', () => sw.state === 'activated' && r(null)));
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Începe' })).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/live-pornire.png' });
});
