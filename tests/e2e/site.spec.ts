import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import type { TrialData } from '../../lib/data';

// The suite runs against `npm run build:mock`, so expectations come from the sample data.
const data = JSON.parse(readFileSync('data/trials.mock.json', 'utf8')) as TrialData;

const PLANT = 'ageratum-monarch-magic';
const plant = data.cultivars.find((c) => c.id === PLANT)!;
const rounds = data.evaluations.filter((e) => e.cultivarId === PLANT);
const hasPhoto = (id: string, date: string) =>
  !!data.cultivars.find((c) => c.id === id)?.images.some((i) => i.date === date && i.mirrored);
const noPhotoRound = data.evaluations.find((e) => !hasPhoto(e.cultivarId, e.date))!;
const fmt = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Records Content-Security-Policy violations, so headers that block the site fail the test.
function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  return violations;
}
const dialogOpen = (page: Page) => page.evaluate(() => !!document.querySelector('dialog')?.open);
const waitClosed = (page: Page) => page.waitForFunction(() => !document.querySelector('dialog')?.open);

test.describe('security headers', () => {
  for (const path of ['/', '/trial-gardens/', `/trial-gardens/${PLANT}/`, '/partners/', '/visit/', '/about/']) {
    test(`${path} loads with no blocked scripts`, async ({ page }) => {
      const violations = watchCsp(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      expect(res?.headers()['content-security-policy']).toBeTruthy();
      await page.waitForLoadState('load');
      expect(violations).toEqual([]);
    });
  }

  test('unknown pages return the 404 page', async ({ page }) => {
    const res = await page.goto('/no-such-page/');
    expect(res?.status()).toBe(404);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('trial gardens database', () => {
  test('lists every cultivar and search filters them', async ({ page }) => {
    await page.goto('/trial-gardens/');
    const cards = page.locator(`main a[href*="/trial-gardens/"]`);
    await expect(cards).toHaveCount(data.cultivars.length);
    await page.getByPlaceholder('Cultivar, genus, or supplier').fill('lantana');
    const lantanas = data.cultivars.filter((c) =>
      [c.name, c.genus, c.supplier].some((v) => v?.toLowerCase().includes('lantana'))).length;
    await expect(cards).toHaveCount(lantanas);
    expect(lantanas).toBeGreaterThan(0);
  });
});

test.describe('cultivar page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/trial-gardens/${PLANT}/`);
  });

  test('main photo opens full screen and closes with the X', async ({ page }) => {
    const hero = page.getByRole('button', { name: /View larger photo/ });
    await hero.click();
    await expect.poll(() => dialogOpen(page)).toBe(true);
    const src = await page.locator('dialog img').getAttribute('src');
    expect(src).not.toContain('-thumb');
    await page.getByRole('button', { name: 'Close photo' }).click();
    await waitClosed(page);
    await expect(hero).toBeFocused();
  });

  test('Escape and clicking outside the photo close the viewer', async ({ page }) => {
    const hero = page.getByRole('button', { name: /View larger photo/ });
    await hero.click();
    await expect.poll(() => dialogOpen(page)).toBe(true);
    await page.keyboard.press('Escape');
    await waitClosed(page);

    await hero.click();
    await expect.poll(() => dialogOpen(page)).toBe(true);
    const vp = page.viewportSize()!;
    await page.mouse.click(4, vp.height - 4);
    await waitClosed(page);
  });

  for (const e of rounds) {
    test(`history row ${e.date} opens that round's photo and scores`, async ({ page }) => {
      const row = page.getByRole('button', { name: `View the photo from the ${fmt(e.date)} round full screen` });
      await row.click();
      await expect.poll(() => dialogOpen(page)).toBe(true);
      const dialog = page.locator('dialog');
      expect(await dialog.locator('img').getAttribute('src')).toContain(`--${e.date}.`);
      await expect(dialog).toContainText(fmt(e.date));
      if (e.avg === null) {
        await expect(dialog).toContainText('Not yet scored this round');
      } else {
        const score = (code: string) => dialog.locator('dl > div').filter({ hasText: code }).locator('dd');
        await expect(score('AVG')).toHaveText(e.avg.toFixed(1));
        await expect(score('RES')).toHaveText(e.heatResistance!.toFixed(1));
        await expect(score('UNF')).toHaveText(e.uniformity!.toFixed(1));
        await expect(score('FLW')).toHaveText(e.flowerPower!.toFixed(1));
        await expect(score('FOL')).toHaveText(e.foliage!.toFixed(1));
      }
      await page.keyboard.press('Escape');
      await waitClosed(page);
      await expect(row).toBeFocused();
      await expect(row).toHaveAttribute('aria-pressed', 'true');
    });
  }

  test('Enter on a history row opens it', async ({ page }) => {
    const row = page.getByRole('button', { name: `View the photo from the ${fmt(rounds[1].date)} round full screen` });
    await row.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => dialogOpen(page)).toBe(true);
  });

  test('sponsor credit links out safely', async ({ page }) => {
    for (const s of data.meta.sponsors) {
      const link = page.getByRole('link', { name: s.name });
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('page shows the plant from the data', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(plant.name);
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  });
});

test('a round without a photo is selected but opens no viewer', async ({ page }) => {
  await page.goto(`/trial-gardens/${noPhotoRound.cultivarId}/`);
  const row = page.getByRole('button', { name: `Select the ${fmt(noPhotoRound.date)} round (no photo on file)` });
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  expect(await dialogOpen(page)).toBe(false);
});

test.describe('visit page', () => {
  test('contact form is disabled and cannot put details in the URL', async ({ page }) => {
    await page.goto('/visit/');
    await expect(page.getByText("Online messages aren't available yet")).toBeVisible();
    const fields = page.locator('main form').locator('input, textarea, button');
    for (const f of await fields.all()) await expect(f).toBeDisabled();
    await page.locator('main form button[type=submit]').click({ force: true });
    expect(new URL(page.url()).search).toBe('');
  });

  test('map is embedded from Google Maps', async ({ page }) => {
    await page.goto('/visit/');
    await expect(page.locator('iframe[src^="https://www.google.com/maps"]')).toHaveCount(1);
  });
});
