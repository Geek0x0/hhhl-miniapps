import { render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { nextTick } from 'vue';
import App from './App.vue';
import router from './router';
import { installMockTelegram, uninstallMockTelegram } from './test/mockTelegram';

describe('App', () => {
  afterEach(() => {
    uninstallMockTelegram();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the login gate inside Telegram', async () => {
    installMockTelegram();
    router.push('/');
    await router.isReady();

    const { container } = render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    const title = await screen.findByRole('heading', { name: 'Log in to dc.hhhl.cc' });
    const logo = screen.getByRole('img', { name: 'HHHL Logo' });

    expect(title).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', 'https://dc.hhhl.cc/client-assets/icon.png');
    expect(logo).toHaveAttribute('width', '45');
    expect(logo).toHaveAttribute('height', '45');
    expect(title.parentElement).toContainElement(logo);
    expect(container.querySelector('.app-panel .app-eyebrow')).not.toBeInTheDocument();
    expect(screen.getByText('Use hhhl to authorize this Mini App for chat, rooms, invitations, and uploads.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authorize with hhhl' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dc.hhhl.cc' })).not.toBeInTheDocument();
    expect(screen.queryByText(/MiAuth/)).not.toBeInTheDocument();
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

  it('keeps rendering the Mini App after an iOS Telegram restore temporarily loses the bridge object', async () => {
    installMockTelegram({ platform: 'ios' });
    router.push('/');
    await router.isReady();

    const firstRender = render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    expect(await screen.findByRole('heading', { name: 'Log in to dc.hhhl.cc' })).toBeInTheDocument();

    firstRender.unmount();
    uninstallMockTelegram();

    render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    expect(await screen.findByRole('heading', { name: 'Log in to dc.hhhl.cc' })).toBeInTheDocument();
    expect(screen.queryByText('Open in Telegram')).not.toBeInTheDocument();
  });

  it('recovers when iOS Telegram injects the bridge shortly after restore startup', async () => {
    vi.useFakeTimers();
    uninstallMockTelegram();
    router.push('/');
    await router.isReady();

    render(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });

    expect(screen.getByText('Open in Telegram')).toBeInTheDocument();

    installMockTelegram({ platform: 'ios' });
    await vi.advanceTimersByTimeAsync(1_000);
    await nextTick();

    expect(screen.getByRole('heading', { name: 'Log in to dc.hhhl.cc' })).toBeInTheDocument();
    expect(screen.queryByText('Open in Telegram')).not.toBeInTheDocument();
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
