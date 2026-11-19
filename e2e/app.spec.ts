import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { addRide, onboard } from './helpers';

test.describe('Drivio pe iPhone 13 Pro (WebKit)', () => {
  test('cursa de referință: verdict live, salvare, persistență după repornire', async ({ page }) => {
    await onboard(page);
    await page.getByRole('button', { name: 'Cursă nouă' }).tap();
    const d = page.getByRole('dialog', { name: 'Cursă nouă' });
    await d.getByRole('button', { name: 'Bolt', exact: true }).tap();
    await d.getByLabel('Sumă cursă (înainte de comision)').fill('35');
    await d.getByLabel('Km cu client').fill('10');
    await d.getByLabel('Minute cursă').fill('20');
    await d.getByLabel('Km până la client').fill('2');
    await d.getByLabel('Minute până la client').fill('7');
    await expect(d.locator('.verdict')).toHaveAttribute('data-level', 'go');
    await expect(d.locator('.verdict-big')).toContainText('41,51');
    await expect(d.getByText('Profit 18,68')).toBeVisible();
    await d.getByRole('button', { name: 'Salvează cursa' }).tap();
    await expect(page.getByText('Cursă salvată')).toBeVisible();
    await expect(page.locator('.hero-num')).toHaveText('18,68RON');

    await page.reload();
    await expect(page.locator('.hero-num')).toHaveText('18,68RON');
  });

  test('istoric: editare, ștergere și anulare; coș', async ({ page }) => {
    await onboard(page);
    await addRide(page, { fare: '35', km: '10', min: '20', pickupKm: '2', pickupMin: '7' });
    await page.getByRole('button', { name: /Istoric/ }).tap();
    await page.getByRole('button', { name: /Uber.*35,00 RON/ }).tap();
    const e = page.getByRole('dialog', { name: 'Editează cursa' });
    await e.getByLabel('Sumă cursă (înainte de comision)').fill('45');
    await e.getByRole('button', { name: 'Salvează modificările' }).tap();
    await expect(page.getByRole('button', { name: /Uber.*45,00 RON/ })).toBeVisible();

    await page.getByRole('button', { name: /Uber.*45,00 RON/ }).tap();
    await page.getByRole('dialog', { name: 'Editează cursa' }).getByRole('button', { name: 'Șterge' }).tap();
    await expect(page.getByText('Nicio cursă salvată')).toBeVisible();
    await page.getByRole('button', { name: 'Anulează' }).tap();
    await expect(page.getByRole('button', { name: /Uber.*45,00 RON/ })).toBeVisible();
  });

  test('export CSV și PDF, backup și restaurare într-un telefon „nou”', async ({ page, browser }) => {
    await onboard(page);
    await addRide(page, { fare: '35', km: '10', min: '20', pickupKm: '2', pickupMin: '7' });
    await addRide(page, { fare: '1.250', km: '600', min: '420', platform: 'Bolt' });

    // CSV
    await page.getByRole('button', { name: /Exportă perioada/ }).tap();
    const ex = page.getByRole('dialog', { name: 'Exportă' });
    await ex.getByRole('button', { name: 'Curse CSV' }).tap();
    await ex.getByRole('button', { name: 'Pregătește fișierul' }).tap();
    const [csvDl] = await Promise.all([page.waitForEvent('download'), ex.getByRole('button', { name: 'Salvează fișierul' }).tap()]);
    const csv = readFileSync((await csvDl.path())!, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(';1250,00;'); // „1.250” = 1.250 lei
    expect(csv).toContain(';18,68;');

    // PDF
    await ex.getByRole('button', { name: 'Raport PDF' }).tap();
    await ex.getByRole('button', { name: 'Pregătește fișierul' }).tap();
    const [pdfDl] = await Promise.all([page.waitForEvent('download'), ex.getByRole('button', { name: 'Salvează fișierul' }).tap()]);
    const pdf = readFileSync((await pdfDl.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(20_000);
    await ex.getByRole('button', { name: 'Închide' }).tap();

    // Backup
    await page.getByRole('button', { name: /Setări/ }).tap();
    await page.getByRole('button', { name: /^Backup/ }).tap();
    const b = page.getByRole('dialog', { name: 'Backup' });
    await b.getByRole('button', { name: 'Pregătește backup-ul' }).tap();
    const [bkDl] = await Promise.all([page.waitForEvent('download'), b.getByRole('button', { name: 'Salvează fișierul' }).tap()]);
    const backupPath = (await bkDl.path())!;

    // „Telefon nou”: context curat, restaurare
    const fresh = await browser.newContext({ ...test.info().project.use, baseURL: 'http://127.0.0.1:5180' });
    const p2 = await fresh.newPage();
    await onboard(p2);
    await p2.getByRole('button', { name: /Setări/ }).tap();
    await p2.getByRole('button', { name: /Restaurează din backup/ }).tap();
    const r = p2.getByRole('dialog', { name: 'Restaurează din backup' });
    await p2.locator('input[type=file]').setInputFiles(backupPath);
    await expect(r.getByText('Fișier verificat')).toBeVisible();
    await r.getByRole('button', { name: 'Restaurează' }).tap();
    await r.getByRole('button', { name: 'Confirmă restaurarea' }).tap();
    await expect(p2.getByText('Backup restaurat')).toBeVisible();
    await p2.getByRole('button', { name: /Istoric/ }).tap();
    await expect(p2.getByRole('button', { name: /Bolt.*1\.250,00 RON/ })).toBeVisible();
    await fresh.close();
  });

  test('aspect: nimic nu iese din ecran, zonele sigure și bara de tab-uri', async ({ page }) => {
    await onboard(page);
    await addRide(page, { fare: '35', km: '10', min: '20' });
    for (const tab of ['Acasă', 'Istoric', 'Unelte', 'Setări']) {
      await page.getByRole('button', { name: new RegExp(tab) }).last().tap();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `depășire orizontală pe ${tab}`).toBeLessThanOrEqual(0);
    }
    const bar = await page.locator('.tabbar').boundingBox();
    const vp = page.viewportSize()!;
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(vp.height);
    // țintele de atingere au cel puțin 44 pt
    const small = await page.$$eval('button, [role=button], input, select', (els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => ({ t: (e as HTMLElement).innerText || (e as HTMLInputElement).name || e.getAttribute('aria-label') || e.tagName, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.height < 36 || r.width < 36)
        .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small, `ținte prea mici: ${small.join(', ')}`).toEqual([]);
  });
});
