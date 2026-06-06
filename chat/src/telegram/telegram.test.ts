import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMockTelegram, uninstallMockTelegram } from '@/test/mockTelegram';
import {
  expandTelegram,
  getTelegramLaunchContext,
  hasTelegramHashParams,
  hideBackButton,
  isTelegramEnvironment,
  openExternalLink,
  readyTelegram,
  showBackButton,
} from './telegram';

describe('telegram adapter', () => {
  const originalLocation = window.location;

  afterEach(() => {
    uninstallMockTelegram();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('detects absence of Telegram WebApp', () => {
    uninstallMockTelegram();

    expect(isTelegramEnvironment()).toBe(false);
  });

  it('detects Telegram environment via URL hash params when initData is empty', () => {
    installMockTelegram({ initData: '' });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, hash: '#tgWebAppVersion=8.0&tgWebAppPlatform=android' },
    });

    expect(isTelegramEnvironment()).toBe(true);
  });

  it('does not detect Telegram when WebApp is absent even with hash params', () => {
    uninstallMockTelegram();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, hash: '#tgWebAppVersion=8.0' },
    });

    expect(isTelegramEnvironment()).toBe(false);
  });

  describe('hasTelegramHashParams', () => {
    it('detects tgWebAppVersion in hash', () => {
      expect(hasTelegramHashParams('#tgWebAppVersion=8.0')).toBe(true);
    });

    it('detects tgWebAppPlatform in hash', () => {
      expect(hasTelegramHashParams('#tgWebAppPlatform=ios')).toBe(true);
    });

    it('detects tgWebAppData in hash', () => {
      expect(hasTelegramHashParams('#tgWebAppData=query_id%3Dabc')).toBe(true);
    });

    it('returns false for empty hash', () => {
      expect(hasTelegramHashParams('')).toBe(false);
    });

    it('returns false for unrelated hash', () => {
      expect(hasTelegramHashParams('#section1')).toBe(false);
    });
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
