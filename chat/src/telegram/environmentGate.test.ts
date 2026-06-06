import { afterEach, describe, expect, it } from 'vitest';
import {
  TELEGRAM_ENVIRONMENT_SEEN_KEY,
  TELEGRAM_ENVIRONMENT_SEEN_TTL_MS,
  hasRecentTelegramEnvironment,
  isAuthCallbackRoute,
  resolveTelegramGateEnvironment,
  shouldBypassTelegramGate,
  shouldRenderMiniApp,
} from './environmentGate';

describe('environmentGate', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('bypasses the Telegram-only prompt only in Vite development mode', () => {
    expect(shouldBypassTelegramGate('development')).toBe(true);
    expect(shouldBypassTelegramGate('test')).toBe(false);
    expect(shouldBypassTelegramGate('production')).toBe(false);
  });

  it('detects auth callback route', () => {
    expect(isAuthCallbackRoute('/auth/callback')).toBe(true);
    expect(isAuthCallbackRoute('/rooms')).toBe(false);
    expect(isAuthCallbackRoute('/')).toBe(false);
  });

  it('renders the Mini App inside Telegram or while using npm run dev', () => {
    expect(shouldRenderMiniApp(true, 'production', '/')).toBe(true);
    expect(shouldRenderMiniApp(false, 'development', '/')).toBe(true);
    expect(shouldRenderMiniApp(false, 'production', '/')).toBe(false);
  });

  it('renders the Mini App on auth callback route even outside Telegram', () => {
    expect(shouldRenderMiniApp(false, 'production', '/auth/callback')).toBe(true);
  });

  it('remembers a recent Telegram environment when the live bridge temporarily disappears', () => {
    expect(resolveTelegramGateEnvironment(true, { now: () => 1_000 })).toBe(true);
    expect(window.sessionStorage.getItem(TELEGRAM_ENVIRONMENT_SEEN_KEY)).toBe('1000');
    expect(window.localStorage.getItem(TELEGRAM_ENVIRONMENT_SEEN_KEY)).toBe('1000');

    expect(resolveTelegramGateEnvironment(false, { now: () => 1_000 + TELEGRAM_ENVIRONMENT_SEEN_TTL_MS })).toBe(true);
    expect(resolveTelegramGateEnvironment(false, { now: () => 1_001 + TELEGRAM_ENVIRONMENT_SEEN_TTL_MS })).toBe(false);
  });

  it('ignores unusable storage while resolving the Telegram gate', () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage;

    expect(resolveTelegramGateEnvironment(true, { storages: [blockedStorage] })).toBe(true);
    expect(hasRecentTelegramEnvironment({ storages: [blockedStorage] })).toBe(false);
  });
});
