import { render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { installMockTelegram, uninstallMockTelegram } from './test/mockTelegram';

describe('App', () => {
  afterEach(() => {
    uninstallMockTelegram();
    vi.restoreAllMocks();
  });

  it('renders the login gate inside Telegram', async () => {
    installMockTelegram();
    router.push('/');
    await router.isReady();

    render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    expect(await screen.findByText('Log in to dc.hhhl.cc')).toBeInTheDocument();
  });

  it('renders the Telegram-only prompt outside Telegram', () => {
    uninstallMockTelegram();

    render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    expect(screen.getByText('Open in Telegram')).toBeInTheDocument();
    expect(screen.queryByText('HHHL Chat Mini App')).not.toBeInTheDocument();
  });

  it('shows callback errors on the login guide', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(Response.json({ error: { code: 'FAILED', message: 'callback rejected' } }, { status: 403 }));
    installMockTelegram();
    router.push('/auth/callback?session=bad-session');
    await router.isReady();

    render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('callback rejected');
  });

  it('handles callback routes when session query appears multiple times', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/miauth/session-1/check')) {
        return Response.json({ token: 'dc-token' }, { status: 200 });
      }
      if (url.endsWith('/api/i')) {
        return Response.json({ id: 'user-1', username: 'alice', name: 'Alice' }, { status: 200 });
      }
      return Response.json({ data: [], nextPageToken: null }, { status: 200 });
    });
    installMockTelegram();
    router.push('/auth/callback?session=session-1&session=session-2');
    await router.isReady();

    render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    await waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/rooms');
    });
  });
});
