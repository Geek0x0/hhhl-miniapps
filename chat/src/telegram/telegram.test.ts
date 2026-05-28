import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMockTelegram, uninstallMockTelegram } from '@/test/mockTelegram';
import {
  expandTelegram,
  getTelegramLaunchContext,
  hideBackButton,
  isTelegramEnvironment,
  openExternalLink,
  readyTelegram,
  showBackButton,
} from './telegram';

describe('telegram adapter', () => {
  afterEach(() => {
    uninstallMockTelegram();
    vi.restoreAllMocks();
  });

  it('detects absence of Telegram WebApp', () => {
    uninstallMockTelegram();

    expect(isTelegramEnvironment()).toBe(false);
  });

  it('reads launch context from Telegram WebApp', () => {
    installMockTelegram({
      initDataUnsafe: { start_param: 'room_amlc1bekzi' },
      platform: 'ios',
      themeParams: {
        bg_color: '#ffffff',
        text_color: '#111111',
      },
    });

    expect(isTelegramEnvironment()).toBe(true);
    expect(getTelegramLaunchContext()).toEqual({
      platform: 'ios',
      startParam: { type: 'room', roomId: 'amlc1bekzi' },
      themeParams: {
        bg_color: '#ffffff',
        text_color: '#111111',
      },
    });
  });

  it('uses Telegram openLink when available', () => {
    const telegram = installMockTelegram();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

    openExternalLink('https://dc.hhhl.cc');

    expect(telegram.openLink).toHaveBeenCalledWith('https://dc.hhhl.cc');
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('falls back to window.open outside Telegram', () => {
    uninstallMockTelegram();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

    openExternalLink('https://dc.hhhl.cc');

    expect(windowOpen).toHaveBeenCalledWith('https://dc.hhhl.cc', '_blank', 'noopener,noreferrer');
  });

  it('safely wraps ready, expand, and back button calls', () => {
    const telegram = installMockTelegram();

    readyTelegram();
    expandTelegram();
    showBackButton(() => undefined);
    hideBackButton();

    expect(telegram.BackButton).toBeDefined();
    expect(telegram.ready).toHaveBeenCalledOnce();
    expect(telegram.expand).toHaveBeenCalledOnce();
    expect(telegram.BackButton?.show).toHaveBeenCalledOnce();
    expect(telegram.BackButton?.onClick).toHaveBeenCalledOnce();
    expect(telegram.BackButton?.hide).toHaveBeenCalledOnce();
    expect(telegram.BackButton?.offClick).toHaveBeenCalledOnce();
  });
});
