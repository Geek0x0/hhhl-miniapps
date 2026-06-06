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

test('same-text newer draft survives an older pending send success', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { delayCreateMessageMs: 500 });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByPlaceholder('Message').fill('repeated local draft');

  const sendResponsePromise = page.waitForResponse((response) => response.url().includes('/api/chat/messages/create-to-room'));
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByPlaceholder('Message').fill('repeated local draft');
  await sendResponsePromise;
  await page.reload();

  await expect(page.getByPlaceholder('Message')).toHaveValue('repeated local draft');
});

test('restored draft during pending send does not prevent success cleanup', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { delayCreateMessageMs: 1000 });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByPlaceholder('Message').fill('restored pending draft');

  const sendResponsePromise = page.waitForResponse((response) => response.url().includes('/api/chat/messages/create-to-room'));
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByPlaceholder('Message')).toHaveValue('');

  await page.evaluate(() => {
    window.history.pushState({}, '', '/rooms/room-b');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/rooms\/room-b$/);
  await expect(page.getByPlaceholder('Message')).toHaveValue('');

  await page.evaluate(() => {
    window.history.pushState({}, '', '/rooms/amlc1bekzi');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/rooms\/amlc1bekzi$/);
  await expect(page.getByPlaceholder('Message')).toHaveValue('restored pending draft');

  await sendResponsePromise;

  await expect(page.getByPlaceholder('Message')).toHaveValue('');
  await page.reload();
  await expect(page.getByPlaceholder('Message')).toHaveValue('');
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
  const fileMessageResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/chat/messages/create-to-room') && response.status() === 200);
  await page.getByRole('button', { name: 'Retry upload' }).click();
  await retryUploadPromise;
  const fileMessageRequest = await fileMessagePromise;
  await fileMessageResponsePromise;

  expect(uploadRequestCount).toBe(2);
  expect(fileMessageRequest.postDataJSON()).toMatchObject({ toRoomId: 'amlc1bekzi', fileId: 'uploaded-file-1' });
  await expect(page.getByText('upload failed once')).toHaveCount(0);
  await expect(page.locator('.message-bubble--own', { hasText: 'hello.txt' })).toBeVisible();
});

test('room management opens from the room header more menu', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  const moreButton = page.getByRole('button', { name: 'More room actions' });
  await moreButton.click();
  await expect(moreButton).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('menuitem', { name: 'Manage room' }).click();

  await expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.side-panel', { hasText: 'Manage room' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave room' })).toBeVisible();
});

test('room header more menu closes and supports keyboard navigation', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  const moreButton = page.getByRole('button', { name: 'More room actions' });
  const menu = page.getByRole('menu');

  await moreButton.click();
  await expect(moreButton).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toHaveCount(0);

  await moreButton.click();
  await page.getByRole('button', { name: 'Members' }).click();
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toHaveCount(0);

  await moreButton.click();
  await expect(moreButton).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  await expect(moreButton).toBeFocused();

  await moreButton.click();
  await page.locator('.message-timeline').click({ position: { x: 20, y: 20 } });
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false');

  await moreButton.press('ArrowUp');
  await expect(moreButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menuitem', { name: 'Manage room' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  await expect(moreButton).toBeFocused();

  await moreButton.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Favorites' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Search keys' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Favorites' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Manage room' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('menuitem', { name: 'Favorites' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Manage room' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.side-panel', { hasText: 'Manage room' })).toBeVisible();
});
