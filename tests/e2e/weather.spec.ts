import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';

const weather = JSON.parse(readFileSync('data/weather.json', 'utf8'));

test('the photo viewer shows that day\'s FAWN weather', async ({ page }) => {
  await page.goto('/trial-gardens/ageratum-monarch-magic/');
  const open = page.getByRole('button', { name: /View larger photo/ });
  const label = await open.getAttribute('aria-label');
  await open.click();

  // the hero shows the latest photo; find its date in the button's label, e.g. "May 6, 2026"
  const shown = new Date(label!.split(', ').slice(1).join(', ') + ' 12:00');
  const date = shown.toISOString().slice(0, 10);
  const day = weather.days[date];
  expect(day, `weather.json has ${date}`).toBeTruthy();

  const dialog = page.locator('dialog[open]');
  await expect(dialog).toContainText('Weather that day');
  await expect(dialog).toContainText(`${Math.round(day.highF)}°F`);
  await expect(dialog).toContainText(`${day.rainIn.toFixed(2)} in`);
  await expect(dialog).toContainText('Scores this round');
});
