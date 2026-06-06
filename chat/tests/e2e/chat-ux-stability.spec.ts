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

test('room draft stays persisted while send is pending', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { delayCreateMessageMs: 1000 });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByPlaceholder('Message').fill('pending local draft');

  const sendRequestPromise = page.waitForRequest((request) => request.url().includes('/api/chat/messages/create-to-room'));
  await page.getByRole('button', { name: 'Send' }).click();
  await sendRequestPromise;
  await expect(page.getByPlaceholder('Message')).toHaveValue('');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hhhl-chat:drafts'))).toContain('pending local draft');

  await page.reload();

  await expect(page.getByPlaceholder('Message')).toHaveValue('pending local draft');
});

test('newer draft survives an older pending send success', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { delayCreateMessageMs: 500 });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByPlaceholder('Message').fill('older pending draft');

  const sendResponsePromise = page.waitForResponse((response) => response.url().includes('/api/chat/messages/create-to-room'));
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByPlaceholder('Message').fill('newer local draft');
  await sendResponsePromise;
  await page.reload();

  await expect(page.getByPlaceholder('Message')).toHaveValue('newer local draft');
});

test('failed pending send does not overwrite another room draft', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { delayCreateMessageMs: 500, failFirstCreateMessage: true });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByPlaceholder('Message').fill('room a pending draft');

  const sendRequestPromise = page.waitForRequest((request) => request.url().includes('/api/chat/messages/create-to-room'));
  const sendResponsePromise = page.waitForResponse((response) => response.url().includes('/api/chat/messages/create-to-room'));
  await page.getByRole('button', { name: 'Send' }).click();
  await sendRequestPromise;
  await page.evaluate(() => {
    window.history.pushState({}, '', '/rooms/room-b');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/rooms\/room-b$/);
  await expect(page.getByPlaceholder('Message')).toHaveValue('');
  await page.getByPlaceholder('Message').fill('room b local draft');
  await sendResponsePromise;

  await expect(page.getByPlaceholder('Message')).toHaveValue('room b local draft');
  await page.reload();
  await expect(page.getByPlaceholder('Message')).toHaveValue('room b local draft');
});

test('upload failures stay retryable in the composer', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { failFirstUpload: true });
  await authorizeSession(page);

  let uploadRequestCount = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/drive/files/create')) {
      uploadRequestCount += 1;
    }
  });

  await page.goto('/rooms/amlc1bekzi');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('Select file').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });

  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('upload failed once')).toBeVisible();
  expect(uploadRequestCount).toBe(1);

  const retryUploadPromise = page.waitForResponse((response) =>
    response.url().includes('/api/drive/files/create') && response.status() === 200);
  const fileMessagePromise = page.waitForRequest((request) =>
    request.url().includes('/api/chat/messages/create-to-room') && request.postData()?.includes('uploaded-file-1') === true);
  await page.getByRole('button', { name: 'Retry upload' }).click();
  await retryUploadPromise;
  const fileMessageRequest = await fileMessagePromise;

  expect(uploadRequestCount).toBe(2);
  expect(fileMessageRequest.postDataJSON()).toMatchObject({ toRoomId: 'amlc1bekzi', fileId: 'uploaded-file-1' });
  await expect(page.getByText('upload failed once')).toHaveCount(0);
});
