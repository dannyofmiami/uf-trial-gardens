import { test as base } from '@playwright/test';

// Tests check this site, not Google Fonts, the UF logo host or Google Maps. Third-party
// requests are blocked so a slow or offline network can't stall page loads; the pages
// still render with fallback fonts, and image alt text and the map's src are still checked.
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const local = new URL(baseURL!).host;
    await context.route((url) => url.host !== local, (route) => route.abort());
    await use(context);
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
