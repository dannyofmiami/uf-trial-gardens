import { defineConfig, devices } from '@playwright/test';

const PORT = 3300;
// never send the local test server through a proxy -- including Playwright's own
// "is it up yet?" check. (Tests block third-party requests; see tests/e2e/fixtures.ts.)
process.env.NO_PROXY = ['127.0.0.1', 'localhost', process.env.NO_PROXY].filter(Boolean).join(',');
process.env.no_proxy = process.env.NO_PROXY;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // CI installs Playwright's Chromium; locally, use the installed Google Chrome
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // tests run against the build that's deployed: sample scores, served with Azure's headers
  webServer: {
    command: 'npm run build:mock && node tests/serve.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    // a throwaway password for the test server's admin API only
    env: { PORT: String(PORT), NEXT_PUBLIC_BASE_PATH: '', ADMIN_PASSWORD: 'test-admin-password-123' },
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
