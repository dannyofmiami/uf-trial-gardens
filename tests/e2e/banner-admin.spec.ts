import { readFileSync } from 'node:fs';
import { test, expect, type Page } from './fixtures';

const repoBanner = JSON.parse(readFileSync('public/content/banner.json', 'utf8'));
const PASSWORD = 'test-admin-password-123'; // matches playwright.config.ts

// Serve a specific banner to the page, independent of the file on disk.
const withBanner = (page: Page, banner: unknown) =>
  page.route('**/content/banner.json', (r) => r.fulfill({ json: banner }));
const announcement = (page: Page) => page.getByRole('region', { name: 'Announcement' });

test.describe('home page banner', () => {
  test('shows the open-house banner from content/banner.json', async ({ page }) => {
    await withBanner(page, repoBanner);
    await page.goto('/');
    const region = announcement(page);
    await expect(region).toContainText(repoBanner.title);
    await expect(region.getByRole('link', { name: repoBanner.linkLabel })).toHaveAttribute('href', repoBanner.linkUrl);
  });

  test('hidden when switched off', async ({ page }) => {
    await withBanner(page, { ...repoBanner, enabled: false });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(announcement(page)).toHaveCount(0);
  });

  test('hidden after its show-until date and before its show-from date', async ({ page }) => {
    await withBanner(page, { ...repoBanner, showFrom: '', showUntil: '2000-01-01' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(announcement(page)).toHaveCount(0);

    await page.unroute('**/content/banner.json');
    await withBanner(page, { ...repoBanner, showFrom: '2999-01-01', showUntil: '' });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(announcement(page)).toHaveCount(0);
  });

  test('never renders an unsafe link, and shows text as text', async ({ page }) => {
    await withBanner(page, { ...repoBanner, title: '<img src=x onerror=alert(1)>', linkUrl: 'javascript:alert(1)' });
    await page.goto('/');
    const region = announcement(page);
    await expect(region).toContainText('<img src=x onerror=alert(1)>');
    await expect(region.locator('img')).toHaveCount(0);
    await expect(region.getByRole('link')).toHaveCount(0);
  });

  test('a missing banner file shows nothing and breaks nothing', async ({ page }) => {
    await page.route('**/content/banner.json', (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(announcement(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

// Changes the real banner file the test server serves, so: one project, one at a time,
// and put the original back afterwards.
test.describe('admin panel', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'edits shared state; desktop only'));

  test.afterAll(async ({ request }, info) => {
    if (info.project.name !== 'desktop') return;
    const { token } = await (await request.post('/api/admin/login', { data: { password: PASSWORD } })).json();
    const { updatedAt: _u, ...original } = repoBanner;
    await request.put('/api/admin/banner', { data: original, headers: { Authorization: `Bearer ${token}` } });
  });

  test('is hidden from search engines', async ({ page }) => {
    await page.goto('/admin/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('wrong password shows an error', async ({ page }) => {
    await page.goto('/admin/');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('main form').getByRole('alert')).toHaveText('Incorrect password.');
  });

  test('sign in, edit the banner, and see it live on the home page', async ({ page }) => {
    await page.goto('/admin/');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('Title')).toHaveValue(repoBanner.title);

    const title = `Open House moved to January 2 (${Date.now()})`;
    await page.getByLabel('Title').fill(title);
    await expect(page.getByText('Preview').locator('..')).toContainText(title);
    await page.getByRole('button', { name: 'Save banner' }).click();
    await expect(page.getByRole('status')).toContainText('Saved');

    await page.goto('/');
    await expect(announcement(page)).toContainText(title);
  });

  test('invalid link is rejected with a field message', async ({ page }) => {
    await page.goto('/admin/');
    if (await page.getByLabel('Password').count()) {
      await page.getByLabel('Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
    }
    await page.getByLabel('Button link').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save banner' }).click();
    await expect(page.locator('main form').getByRole('alert')).toContainText('fix the highlighted fields');
    await expect(page.getByText('Use a site path like /visit/')).toBeVisible();
  });

  test('sign out ends the session', async ({ page }) => {
    await page.goto('/admin/');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
