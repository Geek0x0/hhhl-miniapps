import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

const viewports = [
  { width: 375, height: 812, name: 'mobile' },
  { width: 1024, height: 768, name: 'desktop' },
];

for (const viewport of viewports) {
  test(`rooms page renders polished shell at ${viewport.name}`, async ({ page }) => {
    await installTelegramMock(page);
    await mockApi(page);
    await authorizeSession(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto('/rooms');

    await expect(page.locator('.rooms-shell')).toBeVisible();
    await expect(page.locator('.rooms-header')).toBeVisible();
    await expect(page.locator('.room-panel').first()).toBeVisible();
  });
}

test('reduced motion preference still renders core UI', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms');

  await expect(page.locator('.rooms-shell')).toBeVisible();
  await expect(page.locator('.room-panel').first()).toBeVisible();
});
