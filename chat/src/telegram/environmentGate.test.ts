import { describe, expect, it } from 'vitest';
import { isAuthCallbackRoute, shouldBypassTelegramGate, shouldRenderMiniApp } from './environmentGate';

describe('environmentGate', () => {
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
});
