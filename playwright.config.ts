import { defineConfig, devices } from '@playwright/test';

const PORT = 3300;
// on a network that needs a proxy, send outside requests (fonts, logo, map) through it,
// but never the local test server -- including Playwright's own "is it up yet?" check
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
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
    proxy: proxy ? { server: proxy, bypass: '127.0.0.1,localhost' } : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // tests run against the build that's deployed: sample scores, served with Azure's headers
  webServer: {
    command: 'npm run build:mock && node tests/serve.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    env: { PORT: String(PORT), NEXT_PUBLIC_BASE_PATH: '' },
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
