import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

test('chat room supports message send, panels, and file preview', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');

  await expect(page.locator('.chat-header').getByText('New Home')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage room' })).toHaveCount(0);
  await expect(page.locator('.message-bubble__meta strong', { hasText: 'Alice' }).first()).toBeVisible();
  await expect(page.locator('.message-bubble__text', { hasText: 'hello' }).first()).toBeVisible();
  const aliceBubble = page.locator('.message-bubble', { hasText: 'hello @alice' }).first();
  await expect(aliceBubble.locator('img.message-bubble__avatar')).toHaveJSProperty('src', 'https://dc.hhhl.cc/proxy/avatar.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Falice-avatar.png&avatar=1');
  await expect(aliceBubble.locator('img.message-bubble__avatar')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(aliceBubble.locator('img.message-bubble__avatar')).toHaveJSProperty('complete', true);
  await expect(page.locator('.message-mention', { hasText: '@alice' }).locator('.message-mention__avatar')).toBeVisible();
  await expect(page.locator('.message-mention', { hasText: '@alice' }).locator('img.message-mention__avatar')).toBeVisible();
  await expect(page.locator('.message-mention', { hasText: '@alice' }).locator('img.message-mention__avatar')).toHaveJSProperty('src', 'https://dc.hhhl.cc/proxy/avatar.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Falice-avatar.png&avatar=1');
  await expect(page.locator('.message-mention', { hasText: '@alice' }).locator('img.message-mention__avatar')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(page.locator('.message-mention', { hasText: '@alice' }).locator('img.message-mention__avatar')).toHaveJSProperty('complete', true);
  await expect(page.locator('.message-reactions', { hasText: '👍 2' })).toBeVisible();
  await expect(page.locator('.message-reactions', { hasText: '❤️ 1' })).toBeVisible();
  const mentionAvatarMetrics = await page.locator('.message-mention', { hasText: '@alice' }).locator('.message-mention__avatar').first().evaluate((avatar) => {
    const mention = avatar.closest('.message-mention');
    const label = avatar.nextElementSibling;
    const previousText = mention.previousElementSibling;
    if (!(mention instanceof HTMLElement) || !(label instanceof HTMLElement)) {
      throw new Error('Mention wrapper or label not found');
    }
    if (!(previousText instanceof HTMLElement)) {
      throw new Error('Reference text span not found');
    }

    const avatarRect = avatar.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const textRect = previousText.getBoundingClientRect();

    return {
      height: avatarRect.height,
      fontSize: Number.parseFloat(window.getComputedStyle(mention).fontSize),
      centerDelta: Math.abs((avatarRect.top + avatarRect.height / 2) - (labelRect.top + labelRect.height / 2)),
      lineCenterDelta: Math.abs((avatarRect.top + avatarRect.height / 2) - (textRect.top + textRect.height / 2)),
    };
  });
  expect(Math.abs(mentionAvatarMetrics.height - mentionAvatarMetrics.fontSize * 1.5)).toBeLessThan(0.5);
  expect(mentionAvatarMetrics.centerDelta).toBeLessThan(1);
  expect(mentionAvatarMetrics.lineCenterDelta).toBeLessThan(1);
  await expect(page.locator('.message-bubble__meta strong', { hasText: 'Bob' })).toBeVisible();
  await expect(page.locator('.message-bubble__image')).toBeVisible();
  await page.locator('.message-bubble__image').click();
  await expect(page.getByRole('dialog', { name: 'Image preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Replying to Alice')).toBeVisible();
  await expect(page.locator('.message-link-preview', { hasText: 'example.com' })).toBeVisible();
  await expect(page.locator('.message-link-preview', { hasText: '/docs' })).toBeVisible();
  await expect(page.locator('.message-bubble', { hasText: 'image attached' }).getByRole('button', { name: 'Delete message' })).toHaveCount(0);
  await expect(page.getByText('latest')).toBeVisible();
  await page.getByRole('button', { name: 'Emoji' }).click();
  await page.getByRole('button', { name: '😀' }).click();
  await expect(page.getByRole('button', { name: '🚀' })).toBeVisible();
  await expect(page.getByPlaceholder('Message')).toHaveValue('😀');
  await page.getByPlaceholder('Message').pressSequentially('sent');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('😀sent')).toBeVisible();
  await page.getByPlaceholder('Message').fill('enter sent');
  await page.getByPlaceholder('Message').press('Enter');
  await expect(page.getByText('enter sent')).toBeVisible();
  await page.getByPlaceholder('Message').fill('@');
  await expect(page.getByRole('listbox', { name: 'Mention suggestions' })).toBeVisible();
  await expect(page.locator('.mention-suggestions__item')).toHaveCount(6);
  await page.getByPlaceholder('Message').fill('@member4');
  await expect(page.locator('.mention-suggestions', { hasText: 'Member 4' })).toBeVisible();
  await page.getByRole('option', { name: 'Mention Member 4 @member4' }).click();
  await expect(page.getByPlaceholder('Message')).toHaveValue('@member4 ');
  await page.getByPlaceholder('Message').fill('@bo');
  await expect(page.locator('.mention-suggestions', { hasText: 'Bob' })).toBeVisible();
  await page.getByRole('option', { name: 'Mention Bob @bob' }).click();
  await expect(page.getByPlaceholder('Message')).toHaveValue('@bob ');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.message-bubble--own', { hasText: '@bob' }).locator('.message-mention__avatar')).toBeVisible();
  await page.getByPlaceholder('Message').fill('manual @eve');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.message-bubble--own', { hasText: '@eve' }).locator('.message-mention__avatar')).toBeVisible();

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search messages').fill('hello');
  await page.getByRole('button', { name: 'Search', exact: true }).last().click();
  await expect(page.locator('.search-result-row', { hasText: 'Alice' })).toBeVisible();
  await expect(page.locator('.search-result-row', { hasText: 'archived hello' })).toBeVisible();
  await page.locator('.message-timeline').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('[data-message-id="m9"]')).toHaveCount(0);
  await page.locator('.search-result-row', { hasText: 'archived hello' }).click();
  await expect(page.locator('.side-panel')).toHaveCount(0);
  await expect(page.locator('[data-message-id="m9"]')).toBeInViewport();

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByPlaceholder('Search messages')).toBeVisible();
  await page.locator('.message-timeline').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('.side-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Members' }).click();
  await expect(page.locator('.side-panel--members').getByText('@alice')).toBeVisible();
  await expect(page.locator('.side-panel--members').getByText('@dora')).toBeVisible();
  await page.getByPlaceholder('Search members').fill('alice');
  await expect(page.locator('.side-panel--members').getByText('@alice')).toBeVisible();
  await page.getByPlaceholder('Search members').fill('webpublic');
  await expect(page.locator('.side-panel--members').getByText('@web-public')).toBeVisible();
  await page.getByPlaceholder('Search members').fill(' @BOB ');
  await expect(page.locator('.side-panel--members').getByText('@bob')).toBeVisible();
  await expect(page.locator('.side-panel--members').getByText('@alice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle favorite for Bob' }).click();
  await page.getByRole('button', { name: 'Favorites' }).click();
  await expect(page.locator('.side-panel--favorites', { hasText: '@bob' })).toBeVisible();
  await expect(page.locator('.message-bubble', { hasText: 'Bob' }).locator('.favorite-marker').first()).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem('hhhl-chat:favorite-users', JSON.stringify(['user-32', 'user-99']));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Favorites' }).click();
  await expect(page.locator('.side-panel--favorites', { hasText: '@dora' })).toBeVisible();
  await expect(page.locator('.side-panel--favorites', { hasText: '@eve' })).toBeVisible();

  await page.getByRole('button', { name: 'Search keys' }).click();
  await expect(page.locator('.side-panel', { hasText: 'sk-test-secret' })).toBeVisible();
  await expect(page.locator('.side-panel', { hasText: 'sk-other-secret' })).toHaveCount(0);
  await page.locator('.search-result-row', { hasText: 'sk-test-secret' }).click();
  await expect(page.getByRole('status', { name: 'Copied to clipboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search messages').fill('hello');
  await page.getByRole('button', { name: 'Search', exact: true }).last().click();
  await expect(page.locator('.search-result-row', { hasText: 'archived hello' })).toBeVisible();
  await expect(page.locator('.side-panel', { hasText: 'sk-test-secret' })).toHaveCount(0);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('Select file').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByText('hello.txt')).toBeVisible();
});

test('search result panel stays open when jumping to a message fails', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { failSearchContext: true });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search messages').fill('hello');
  await page.getByRole('button', { name: 'Search', exact: true }).last().click();
  await page.locator('.search-result-row', { hasText: 'archived hello' }).click();

  await expect(page.locator('.side-panel', { hasText: 'archived hello' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(/message context unavailable/i);
});
