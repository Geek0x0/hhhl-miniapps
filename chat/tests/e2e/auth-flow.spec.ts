import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

test('Telegram auth guide opens MiAuth and authorized sessions load rooms', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Log in to dc.hhhl.cc' })).toBeVisible();

  await authorizeSession(page);
  await page.goto('/rooms');
  await page.reload();

  await expect(page.getByText('New Home')).toBeVisible();
});
