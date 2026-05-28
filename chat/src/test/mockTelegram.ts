import { vi } from 'vitest';
import type { TelegramWebApp } from '@/telegram/telegram';

type MockTelegramOptions = Partial<TelegramWebApp>;

export function installMockTelegram(options: MockTelegramOptions = {}): TelegramWebApp {
  const webApp: TelegramWebApp = {
    initData: options.initData ?? '',
    initDataUnsafe: options.initDataUnsafe ?? {},
    platform: options.platform ?? 'tdesktop',
    themeParams: options.themeParams ?? {},
    ready: vi.fn(),
    expand: vi.fn(),
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
    MainButton: {
      setText: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
  };

  Object.defineProperty(window, 'Telegram', {
    configurable: true,
    value: { WebApp: webApp },
  });

  return webApp;
}

export function uninstallMockTelegram(): void {
  Object.defineProperty(window, 'Telegram', {
    configurable: true,
    value: undefined,
  });
}
