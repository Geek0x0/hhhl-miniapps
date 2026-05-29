import { describe, expect, it } from 'vitest';
import { shouldBypassTelegramGate, shouldRenderMiniApp } from './environmentGate';

describe('environmentGate', () => {
  it('bypasses the Telegram-only prompt only in Vite development mode', () => {
    expect(shouldBypassTelegramGate('development')).toBe(true);
    expect(shouldBypassTelegramGate('test')).toBe(false);
    expect(shouldBypassTelegramGate('production')).toBe(false);
  });

  it('renders the Mini App inside Telegram or while using npm run dev', () => {
    expect(shouldRenderMiniApp(true, 'production')).toBe(true);
    expect(shouldRenderMiniApp(false, 'development')).toBe(true);
    expect(shouldRenderMiniApp(false, 'production')).toBe(false);
  });
});
