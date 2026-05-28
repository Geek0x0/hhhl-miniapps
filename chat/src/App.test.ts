import { render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.vue';
import router from './router';
import { installMockTelegram, uninstallMockTelegram } from './test/mockTelegram';

describe('App', () => {
  afterEach(() => {
    uninstallMockTelegram();
  });

  it('renders the chat mini app shell', async () => {
    installMockTelegram();
    router.push('/');
    await router.isReady();

    render(App, {
      global: {
        plugins: [router],
      },
    });

    expect(screen.getByText('HHHL Chat Mini App')).toBeInTheDocument();
  });

  it('renders the Telegram-only prompt outside Telegram', () => {
    uninstallMockTelegram();

    render(App, {
      global: {
        plugins: [router],
      },
    });

    expect(screen.getByText('Open in Telegram')).toBeInTheDocument();
    expect(screen.queryByText('HHHL Chat Mini App')).not.toBeInTheDocument();
  });
});
