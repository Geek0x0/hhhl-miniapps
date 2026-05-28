import type { Page } from '@playwright/test';

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
    if (!route.request().url().startsWith('https://dc.hhhl.cc/api/')) {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/', '');
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
      await route.fulfill({ headers, json: [{ id: 'user-1', username: 'alice', name: 'Alice' }] });
      return;
    }

    if (endpoint === 'chat/messages/room-timeline') {
      await route.fulfill({ headers, json: [{ id: 'm1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:00.000Z', text: 'hello' }] });
      return;
    }

    if (endpoint === 'chat/messages/create-to-room') {
      await route.fulfill({ headers, json: { id: 'm2', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:01.000Z', text: 'sent' } });
      return;
    }

    if (endpoint === 'chat/messages/search') {
      await route.fulfill({ headers, json: [{ id: 'm1', roomId: 'amlc1bekzi', createdAt: '2026-01-01T00:00:00.000Z', text: 'hello' }] });
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
