import { expect, test } from '@playwright/test';

test('browser without Telegram mock shows Telegram-only prompt', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Open in Telegram' })).toBeVisible();
  await expect(page.getByText('Log in to dc.hhhl.cc')).toHaveCount(0);
});
