import { test, expect, type Page } from './fixtures';

const PASSWORD = 'test-admin-password-123'; // matches playwright.config.ts
const ID = 'osteospermum-akila-sunshine-yellow';
const NAME = 'Akila Sunshine Yellow';

const signIn = async (page: Page) => {
  await page.goto('/admin/');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('tab', { name: 'Cultivars' })).toHaveAttribute('aria-selected', 'true');
};
const openCultivar = async (page: Page, name: string) => {
  await page.getByLabel('Find a cultivar').fill(name.split(' ')[0]);
  await page.getByRole('navigation', { name: 'Cultivars' }).getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByLabel('Cultivar name')).toHaveValue(name);
};
const lastRound = (page: Page) => page.getByRole('article', { name: /Round 5/ });

// Changes the edits file the test server serves, so: one project, one at a time, and
// put the spreadsheet values back afterwards.
test.describe('cultivar editor', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'edits shared state; desktop only'));

  test.afterAll(async ({ request }, info) => {
    if (info.project.name !== 'desktop') return;
    const { token } = await (await request.post('/api/admin/login', { data: { password: PASSWORD } })).json();
    await request.put(`/api/admin/cultivars/${ID}`, { data: { fields: {}, rounds: {} }, headers: { Authorization: `Bearer ${token}` } });
  });

  test('edit details and a score, and see them on the public pages', async ({ page }) => {
    test.slow();
    await signIn(page);
    await openCultivar(page, NAME);

    await page.getByLabel('Cultivar name').fill('Akila Sunshine Gold');
    await expect(page.getByText('Spreadsheet: Akila Sunshine Yellow')).toBeVisible();
    await page.getByRole('group', { name: 'Light exposure' }).getByText('Full sun').click();
    const round = lastRound(page);
    await round.getByLabel('Foliage').selectOption('4.5');
    // (3.5 + 4 + 3.5 + 4.5) / 4
    await expect(round.getByLabel('Average score 3.9 of 5')).toBeVisible();
    await round.getByLabel('Notes').fill('Recovered well after the May rains.');

    await expect(page.getByText('You have unsaved changes.')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Cultivars' }).getByRole('button', { name: /Akila Sunshine Gold/ })).toContainText('Edited');

    await page.goto(`/trial-gardens/${ID}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Akila Sunshine Gold');
    await expect(page.getByText('Full sun', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Average score 3.9 of 5')).toBeVisible();

    await page.goto('/trial-gardens/');
    await page.getByLabel('Light exposure').selectOption('Full sun');
    await expect(page.getByRole('link', { name: /Akila Sunshine Gold/ })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Showing 1 of');
  });

  test('invalid values are refused with a message', async ({ page }) => {
    await signIn(page);
    await openCultivar(page, 'Akila Sunshine Gold');
    await page.getByLabel('Cultivar name').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('form', { name: /^Edit/ }).getByRole('alert')).toContainText('fix the highlighted fields');
    await expect(page.getByText('This can’t be empty.')).toBeVisible();
  });

  test('restore puts the spreadsheet values back', async ({ page }) => {
    await signIn(page);
    await openCultivar(page, 'Akila Sunshine Gold');
    await page.getByRole('button', { name: 'Restore spreadsheet values' }).click();
    await expect(page.getByLabel('Cultivar name')).toHaveValue(NAME);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Cultivars' }).getByRole('button', { name: new RegExp(NAME) })).not.toContainText('Edited');

    await page.goto(`/trial-gardens/${ID}/`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NAME);
  });
});
