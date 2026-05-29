import type { Page } from '@playwright/test';

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

export async function installTelegramMock(page: Page, startParam?: string): Promise<void> {
  await page.addInitScript((param) => {
    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      value: {
        WebApp: {
          initData: '',
          initDataUnsafe: { start_param: param, user: { language_code: 'en' } },
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
  }, startParam);
}

export async function mockApi(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    if (route.request().url().startsWith('https://dc.hhhl.cc/files/')) {
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

    if (endpoint === 'chat/rooms/show' || endpoint === 'chat/rooms/join') {
      await route.fulfill({ headers, json: { id: 'amlc1bekzi', name: 'New Home' } });
      return;
    }

    if (endpoint === 'chat/rooms/members') {
      await route.fulfill({ headers, json: [
        { id: 'user-1', username: 'alice', name: 'Alice' },
        { id: 'user-2', username: 'bob', name: 'Bob' },
      ] });
      return;
    }

    if (endpoint === 'chat/messages/room-timeline') {
      if (body.sinceId === 'm3') {
        await route.fulfill({ headers, json: [{ id: 'm4', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:03.000Z', text: 'latest', fromUser: { id: 'user-3', username: 'carol', name: 'Carol' } }] });
        return;
      }

      await route.fulfill({ headers, json: [
        { id: 'm1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:00.000Z', text: 'hello', fromUser: { id: 'user-1', username: 'alice', name: 'Alice', avatarUrl: '/avatar/alice.png' } },
        { id: 'm2', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:01.000Z', content: 'image attached', fromUser: { id: 'user-2', username: 'bob', name: 'Bob' }, files: [{ id: 'file-1', name: 'photo.png', type: 'image/png', url: '/files/photo.png', thumbnailUrl: '/files/photo-thumb.png' }] },
        { id: 'm3', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:02.000Z', text: 'reply body', user: { id: 'user-1', username: 'alice', name: 'Alice' }, replyId: 'm1', reply: { id: 'm1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:00.000Z', text: 'hello', user: { id: 'user-1', username: 'alice', name: 'Alice' } } },
      ] });
      return;
    }

    if (endpoint === 'chat/messages/create-to-room') {
      await route.fulfill({ headers, json: { id: `created-${String(body.text ?? body.fileId ?? 'message')}`, roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:04.000Z', text: body.text ?? null, user: { id: 'user-1', username: 'alice', name: 'Alice' } } });
      return;
    }

    if (endpoint === 'chat/messages/search') {
      await route.fulfill({ headers, json: [{ id: 'm1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:00.000Z', text: 'hello', user: { id: 'user-1', username: 'alice', name: 'Alice' } }] });
      return;
    }

    await route.fulfill({ headers, json: {} });
  });
}

export async function authorizeSession(page: Page): Promise<void> {
  if (!page.url().startsWith('http://127.0.0.1:4173')) {
    await page.goto('/');
  }

  await page.evaluate(() => {
    localStorage.setItem('hhhl-chat:auth', JSON.stringify({ token: 'test-token', savedAt: new Date().toISOString() }));
  });
}
