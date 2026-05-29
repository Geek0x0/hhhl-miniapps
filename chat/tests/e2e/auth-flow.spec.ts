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

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(page.getByText('New Home')).toBeVisible();
});
