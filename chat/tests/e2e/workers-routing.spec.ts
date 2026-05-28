import { expect, test } from '@playwright/test';

for (const route of ['/rooms/amlc1bekzi', '/auth/callback', '/settings']) {
  test(`${route} serves the app shell`, async ({ page }) => {
    await page.goto(route);

    await expect(page.locator('#app')).toBeVisible();
  });
}
