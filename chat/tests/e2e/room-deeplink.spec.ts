import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

test('startapp room target is preserved and opens after token restore', async ({ page }) => {
  await installTelegramMock(page, 'room_amlc1bekzi');
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/');

  await expect(page).toHaveURL(/\/rooms\/amlc1bekzi$/);
  await expect(page.locator('.message-bubble__text', { hasText: 'hello' }).first()).toBeVisible();
});
