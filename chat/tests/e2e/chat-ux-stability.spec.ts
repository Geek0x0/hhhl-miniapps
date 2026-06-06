import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

test('room drafts survive reload and clear after successful send', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByPlaceholder('Message').fill('saved local draft');
  await page.reload();

  await expect(page.getByPlaceholder('Message')).toHaveValue('saved local draft');

  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('saved local draft')).toBeVisible();
  await page.reload();

  await expect(page.getByPlaceholder('Message')).toHaveValue('');
});

test('upload failures stay retryable in the composer', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { failFirstUpload: true });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('Select file').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });

  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('upload failed once')).toBeVisible();
  await page.getByRole('button', { name: 'Retry upload' }).click();
  await expect(page.getByText('upload failed once')).toHaveCount(0);
});
