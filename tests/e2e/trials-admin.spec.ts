import { test, expect as baseExpect, type Page } from './fixtures';
import type { BrowserContext } from '@playwright/test';
import { isEmptyEdit, validateCultivarEdit } from '../../lib/cultivar-validate.mjs';

// Adding and removing rounds, and adding whole trials. Saved edits live in memory here
// (checked with the same rules as the admin API), not in the test server's edits file, so
// these run alongside the other tests without changing what they see.

const PASSWORD = 'test-admin-password-123'; // matches playwright.config.ts
// the public pages apply saved edits after they load, which can take a while on a busy machine
const expect = baseExpect.configure({ timeout: 15_000 });
const ID = 'osteospermum-akila-sunshine-yellow';
const NAME = 'Akila Sunshine Yellow';

async function memoryEdits(context: BrowserContext) {
  const edits: { cultivars: Record<string, any> } = { cultivars: {} };
  await context.route('**/content/cultivar-edits.json*', (r) => r.fulfill({ json: edits }));
  await context.route('**/api/admin/cultivars', (r) => r.fulfill({ json: edits }));
  await context.route('**/api/admin/cultivars/*', (r) => {
    const id = new URL(r.request().url()).pathname.split('/').pop()!;
    const result = validateCultivarEdit(r.request().postDataJSON());
    if (result.errors) return r.fulfill({ status: 400, json: { error: 'Please fix the highlighted fields.', fields: result.errors } });
    const saved = { ...result.edit, updatedAt: new Date().toISOString() };
    if (isEmptyEdit(result.edit)) delete edits.cultivars[id];
    else edits.cultivars[id] = saved;
    return r.fulfill({ json: saved });
  });
  return edits;
}

const signIn = async (page: Page) => {
  await page.goto('/admin/');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('tab', { name: 'Cultivars' })).toHaveAttribute('aria-selected', 'true');
};
const trialList = (page: Page) => page.getByRole('navigation', { name: 'Cultivars' });
const openAkila = async (page: Page) => {
  await page.getByLabel('Find a cultivar').fill('Akila');
  await trialList(page).getByRole('button', { name: new RegExp(NAME) }).click();
  await expect(page.getByLabel('Cultivar name')).toHaveValue(NAME);
};
const historyRow = (page: Page, date: string) => page.locator('tbody th', { hasText: date });

test.describe('evaluation rounds and trials in the admin', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'admin is a desktop task; run once'));

  test('add and remove rounds on a spreadsheet trial', async ({ page, context }) => {
    test.slow();
    const edits = await memoryEdits(context);
    page.on('dialog', (d) => d.accept());
    await signIn(page);
    await openAkila(page);

    await page.getByRole('button', { name: 'Remove the Jan 13, 2026 round' }).click();
    await expect(page.getByText('Removed from the spreadsheet’s rounds:')).toBeVisible();
    await page.getByLabel('Add a round').fill('2026-06-10');
    await page.getByRole('button', { name: 'Add round', exact: true }).click();
    const added = page.getByRole('article', { name: /Jun 10, 2026/ });
    await added.getByLabel('Heat Resistance').selectOption('3');
    await added.getByLabel('Foliage').selectOption('4');
    await expect(added.getByLabel('Average score 3.5 of 5')).toBeVisible();

    // the same date twice is refused
    await page.getByRole('button', { name: 'Add round', exact: true }).click();
    await expect(page.getByText('There\'s already a round on Jun 10, 2026.')).toBeVisible();

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    expect(edits.cultivars[ID].removedRounds).toEqual(['2026-01-13']);
    expect(edits.cultivars[ID].rounds['2026-06-10']).toMatchObject({ heatResistance: 3, foliage: 4, uniformity: null });

    const pub = await context.newPage();
    await pub.goto(`/trial-gardens/${ID}/`);
    await expect(historyRow(pub, 'Jun 10, 2026')).toBeVisible();
    await expect(historyRow(pub, 'Jan 13, 2026')).toHaveCount(0);
    await expect(pub.getByText(/across 5 evaluations · latest Jun 10, 2026/)).toBeVisible();

    // putting the round back restores the spreadsheet's scores
    await page.getByRole('button', { name: 'Put back' }).click();
    await expect(page.getByRole('article', { name: /Jan 13, 2026/ })).toBeVisible();
  });

  test('trial a cultivar again, refuse duplicates, then delete it', async ({ page, context }) => {
    test.slow();
    const edits = await memoryEdits(context);
    page.on('dialog', (d) => d.accept());
    await signIn(page);
    await openAkila(page);

    await page.getByRole('button', { name: 'Trial this cultivar again' }).click();
    await expect(page.getByText('New trial, not saved yet')).toBeVisible();
    await expect(page.getByLabel('Cultivar name')).toHaveValue(NAME);
    await expect(page.getByLabel('Trial year')).toHaveValue('2027');
    await expect(trialList(page).getByRole('button', { name: /Unsaved/ })).toBeVisible();

    // same cultivar, year, light and planting as the spreadsheet trial: refused
    await page.getByLabel('Trial year').fill('2026');
    await page.getByRole('button', { name: 'Save new trial' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Another trial already has this cultivar' })).toBeVisible();
    expect(edits.cultivars).toEqual({});

    await page.getByLabel('Trial year').fill('2027');
    await page.getByLabel('Add a round').fill('2027-01-12');
    await page.getByRole('button', { name: 'Add round', exact: true }).click();
    await page.getByRole('article', { name: /Jan 12, 2027/ }).getByLabel('Foliage').selectOption('4');
    await page.getByRole('button', { name: 'Save new trial' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    const [id] = Object.keys(edits.cultivars);
    expect(id).toMatch(/^t-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(edits.cultivars[id]).toMatchObject({ added: true, fields: { name: NAME, year: 2027 } });
    await expect(trialList(page).getByRole('button', { name: /Added/ })).toContainText('2027');

    // the public database lists it under 2027 and opens its page
    const pub = await context.newPage();
    await pub.goto('/trial-gardens/');
    await pub.getByLabel('Year').selectOption('2027');
    await expect(pub.getByRole('status')).toContainText('Showing 1 of');
    await pub.getByRole('link', { name: new RegExp(NAME) }).click();
    await expect(pub).toHaveURL(new RegExp(`/trial-gardens/view/\\?id=${id}`));
    await expect(pub.getByRole('heading', { level: 1 })).toHaveText(NAME);
    await expect(pub.getByText('Trial 2027', { exact: true })).toBeVisible();
    await expect(historyRow(pub, 'Jan 12, 2027')).toBeVisible();

    await page.getByRole('button', { name: 'Delete this trial' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Trial deleted.' })).toBeVisible();
    expect(edits.cultivars).toEqual({});
    await pub.reload();
    await expect(pub.getByRole('heading', { name: 'Trial not found' })).toBeVisible();
  });
});
