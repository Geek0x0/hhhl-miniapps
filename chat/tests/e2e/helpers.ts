import type { Page } from '@playwright/test';

export const MOCK_KEY_TEXT = 'sk-AbCdEfGhIjKlMnOpQrStUvWxYz012345';

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

function requestBody(routeRequest: { postDataJSON: () => unknown }): Record<string, unknown> {
  try {
    const body = routeRequest.postDataJSON();
    return body != null && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function installTelegramMock(page: Page, startParam?: string, languageCode = 'en'): Promise<void> {
  await page.addInitScript(({ param, language }) => {
    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      value: {
        WebApp: {
          initData: 'mock_init_data',
          initDataUnsafe: { start_param: param, user: { language_code: language } },
          platform: 'tdesktop',
          themeParams: {},
          ready: () => undefined,
          expand: () => undefined,
          openLink: (url: string) => { window.location.href = url; },
          BackButton: { show: () => undefined, hide: () => undefined, onClick: () => undefined, offClick: () => undefined },
          MainButton: { setText: () => undefined, show: () => undefined, hide: () => undefined, onClick: () => undefined, offClick: () => undefined },
        },
      },
    });
  }, { param: startParam, language: languageCode });
}

export interface MockApiOptions {
  failJoinRoomId?: string;
  failSearchContext?: boolean;
  failFirstUpload?: boolean;
  failFirstCreateMessage?: boolean;
  delayCreateMessageMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function mockApi(page: Page, options: MockApiOptions = {}): Promise<void> {
  let uploadAttempts = 0;
  let createMessageAttempts = 0;

  await page.route('**/*', async (route) => {
    if (route.request().url().startsWith('https://telegram.org/js/telegram-web-app.js')) {
      await route.fulfill({ contentType: 'application/javascript', body: '' });
      return;
    }

    if (route.request().url().startsWith('https://dc.hhhl.cc/files/')) {
      await route.fulfill({ contentType: 'image/png', body: transparentPng });
      return;
    }

    if (route.request().url().startsWith('https://dc.hhhl.cc/proxy/avatar.webp')) {
      await route.fulfill({ contentType: 'image/png', body: transparentPng });
      return;
    }

    if (!route.request().url().startsWith('https://dc.hhhl.cc/api/')) {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/', '');
    const body = route.request().method() === 'POST' ? requestBody(route.request()) : {};
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };

    if (endpoint === 'drive/files/create') {
      uploadAttempts += 1;
      if (options.failFirstUpload === true && uploadAttempts === 1) {
        await route.fulfill({ status: 500, headers, json: { error: { code: 'UPLOAD_FAILED', message: 'upload failed once' } } });
        return;
      }

      await route.fulfill({ headers, json: { id: 'uploaded-file-1', name: 'hello.txt', type: 'text/plain', url: '/files/hello.txt' } });
      return;
    }

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (endpoint === 'i') {
      await route.fulfill({ headers, json: { id: 'user-1', username: 'alice', name: 'Alice' } });
      return;
    }

    if (endpoint === 'chat/rooms/joining') {
      await route.fulfill({ headers, json: [{ id: 'amlc1bekzi', name: 'New Home' }] });
      return;
    }

    if (endpoint === 'chat/rooms/owned' || endpoint === 'chat/rooms/invitations/inbox') {
      await route.fulfill({ headers, json: [] });
      return;
    }

    if (endpoint === 'chat/rooms/join' && body.roomId === options.failJoinRoomId) {
      await route.fulfill({ status: 404, headers, json: { error: { code: 'NO_SUCH_ROOM', message: 'room not found' } } });
      return;
    }

    if (endpoint === 'chat/rooms/show' || endpoint === 'chat/rooms/join') {
      await route.fulfill({ headers, json: { id: 'amlc1bekzi', name: 'New Home' } });
      return;
    }

    if (endpoint === 'chat/rooms/members') {
      if (body.untilId === 'user-31') {
        await route.fulfill({ headers, json: [
          { id: 'user-32', username: 'dora', name: 'Dora' },
          { id: 'user-33', username: 'web-public', name: 'Web Public' },
        ] });
        return;
      }

      await route.fulfill({ headers, json: [
        { id: 'user-2', username: 'bob', name: 'Bob' },
        ...Array.from({ length: 29 }, (_value, index) => ({ id: `user-${index + 3}`, username: `member${index + 3}`, name: `Member ${index + 3}` })),
      ] });
      return;
    }

    if (endpoint === 'users/show') {
      if (body.username === 'eve') {
        await route.fulfill({ headers, json: { id: 'user-99', username: 'eve', name: 'Eve', avatarUrl: '/avatar/eve.png' } });
        return;
      }

      const requestedIds = Array.isArray(body.userIds) ? body.userIds : [body.userId];
      const users = requestedIds.flatMap((userId) => {
        if (userId === 'user-32') {
          return [{ id: 'user-32', username: 'dora', name: 'Dora' }];
        }
        if (userId === 'user-99') {
          return [{ id: 'user-99', username: 'eve', name: 'Eve', avatarUrl: '/avatar/eve.png' }];
        }
        return [];
      });
      await route.fulfill({ headers, json: Array.isArray(body.userIds) ? users : users[0] ?? null });
      return;
    }

    if (endpoint === 'chat/messages/room-timeline') {
      if (body.sinceId === 'm3') {
        await route.fulfill({ headers, json: [{ id: 'm4', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:03.000Z', text: 'latest', fromUser: { id: 'user-3', username: 'carol', name: 'Carol' } }] });
        return;
      }

      await route.fulfill({ headers, json: [
        { id: 'm1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:00.000Z', text: 'hello @alice', fromUser: { id: 'user-1', username: 'alice', name: 'Alice', image: 'https://dc.hhhl.cc/proxy/avatar.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Falice-avatar.png&avatar=1' }, reactions: { '👍': 2, '❤️': { count: 1, reacted: true } } },
        { id: 'm2', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:01.000Z', content: 'image attached', fromUser: { id: 'user-2', username: 'bob', name: 'Bob' }, files: [{ id: 'file-1', name: 'photo.png', type: 'image/png', url: '/files/photo.png', thumbnailUrl: '/files/photo-thumb.png' }] },
        { id: 'm3', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:02.000Z', text: 'reply body https://example.com/docs', user: { id: 'user-1', username: 'alice', name: 'Alice' }, replyId: 'm1', reply: { id: 'm1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:00.000Z', text: 'hello', user: { id: 'user-1', username: 'alice', name: 'Alice' } } },
      ] });
      return;
    }

    if (endpoint === 'chat/messages/create-to-room') {
      createMessageAttempts += 1;
      if (options.delayCreateMessageMs != null) {
        await delay(options.delayCreateMessageMs);
      }
      if (options.failFirstCreateMessage === true && createMessageAttempts === 1) {
        await route.fulfill({ status: 500, headers, json: { error: { code: 'SEND_FAILED', message: 'send failed once' } } });
        return;
      }

      await route.fulfill({ headers, json: { id: `created-${String(body.text ?? body.fileId ?? 'message')}`, roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:04.000Z', text: body.text ?? null, user: { id: 'user-1', username: 'alice', name: 'Alice' } } });
      return;
    }

    if (endpoint === 'chat/messages/context' && body.messageId === 'm9') {
      if (options.failSearchContext === true) {
        await route.fulfill({ status: 404, headers, json: { error: { code: 'MESSAGE_NOT_FOUND', message: 'message context unavailable' } } });
        return;
      }

      await route.fulfill({ headers, json: [
        { id: 'm8', roomId: 'amlc1bekzi', createdAt: '2025-12-31T23:59:58.000Z', text: 'context before', user: { id: 'user-2', username: 'bob', name: 'Bob' } },
        { id: 'm9', roomId: 'amlc1bekzi', createdAt: '2025-12-31T23:59:59.000Z', text: 'archived hello', user: { id: 'user-1', username: 'alice', name: 'Alice' } },
      ] });
      return;
    }

    if (endpoint === 'chat/messages/search') {
      if (body.query === 'sk-' && body.userId === 'amk1v51gkh1u0001') {
        await route.fulfill({ headers, json: [] });
        return;
      }

      if (body.query === 'sk-' && body.userId == null) {
        await route.fulfill({ headers, json: [
          { id: 'key-1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:05.000Z', text: MOCK_KEY_TEXT, user: { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' } },
          { id: 'key-2', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:06.000Z', text: 'sk-0123456789abcdefghijklmnopqrstuv', user: { id: 'user-2', username: 'bob', name: 'Bob' } },
          { id: 'key-3', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:07.000Z', text: `${MOCK_KEY_TEXT} extra`, user: { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' } },
          { id: 'key-4', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:08.000Z', text: `prefix ${MOCK_KEY_TEXT}`, user: { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' } },
          { id: 'key-5', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:09.000Z', text: 'sk-test-secret', user: { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' } },
          { id: 'key-6', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:10.000Z', text: MOCK_KEY_TEXT },
        ] });
        return;
      }

      if (body.query === 'sk-') {
        await route.fulfill({ status: 400, headers, json: { error: { code: 'BAD_KEY_SEARCH', message: 'key search requires ls user' } } });
        return;
      }

      await route.fulfill({ headers, json: [{ id: 'm9', roomId: 'amlc1bekzi', createdAt: '2025-12-31T23:59:59.000Z', text: 'archived hello', user: { id: 'user-1', username: 'alice', name: 'Alice' } }] });
      return;
    }

    await route.fulfill({ headers, json: {} });
  });
}

export async function authorizeSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('hhhl-chat:auth', JSON.stringify({ token: 'test-token', savedAt: new Date().toISOString() }));
  });

  if (page.url().startsWith('http://127.0.0.1:4173')) {
    await page.evaluate(() => {
      localStorage.setItem('hhhl-chat:auth', JSON.stringify({ token: 'test-token', savedAt: new Date().toISOString() }));
    });
  }
}
