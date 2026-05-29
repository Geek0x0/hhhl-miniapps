import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

test('chat room supports message send, panels, and file preview', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');

  await expect(page.locator('.chat-header').getByText('New Home')).toBeVisible();
  await expect(page.locator('.message-bubble__meta strong', { hasText: 'Alice' }).first()).toBeVisible();
  await expect(page.locator('.message-bubble__text', { hasText: 'hello' }).first()).toBeVisible();
  await expect(page.locator('.message-bubble__meta strong', { hasText: 'Bob' })).toBeVisible();
  await expect(page.locator('.message-bubble__image')).toBeVisible();
  await expect(page.getByText('Replying to Alice')).toBeVisible();
  await page.getByPlaceholder('Message').fill('sent');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('sent')).toBeVisible();

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search messages').fill('hello');
  await page.getByRole('button', { name: 'Search' }).last().click();
  await expect(page.getByText('hello').first()).toBeVisible();

  await page.getByRole('button', { name: 'Members' }).click();
  await expect(page.getByText('@alice')).toBeVisible();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('Select file').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByText('hello.txt')).toBeVisible();
});
