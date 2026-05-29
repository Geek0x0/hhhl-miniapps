import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

test('rooms page localizes room controls and common error messages', async ({ page }) => {
  await installTelegramMock(page, undefined, 'zh-CN');
  await mockApi(page, { failJoinRoomId: 'missing-room' });
  await authorizeSession(page);

  await page.goto('/rooms');

  await expect(page.getByPlaceholder('输入房间 ID')).toBeVisible();
  await expect(page.locator('.room-source-badge', { hasText: '已加入' })).toBeVisible();
  await expect(page.locator('.room-source-badge', { hasText: 'joined' })).toHaveCount(0);
  await expect(page.locator('option[value="public"]')).toHaveText('公开');
  await expect(page.locator('option[value="invite"]')).toHaveText('邀请制');

  await page.getByPlaceholder('输入房间 ID').fill('missing-room');
  await page.getByRole('button', { name: '通过房间 ID 加入' }).click();
  await expect(page.getByRole('alert')).toContainText('房间不存在或当前不可见。');
});
