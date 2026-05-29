import { render, screen } from '@testing-library/vue';
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
});
