import { afterEach, describe, expect, it } from 'vitest';
import type { TelegramLaunchContext } from '@/telegram/telegram';
import { createLocalStorageAdapter } from '@/shared/storage';
import { applyTelegramTheme, createI18nState } from './index';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function launchContext(languageCode: string | undefined): TelegramLaunchContext {
  return {
    platform: 'tdesktop',
    startParam: { type: 'none' },
    themeParams: {},
    userLanguageCode: languageCode,
  };
}

describe('i18n state', () => {
  it('uses stored locale preference before Telegram and browser languages', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());

    storage.setJson('hhhl-chat:locale', 'en');
    const i18n = createI18nState({
      storage,
      telegram: launchContext('zh-hans'),
      browserLanguages: ['zh-CN'],
    });

    expect(i18n.locale.value).toBe('en');
    expect(i18n.t('common.openInTelegram')).toBe('Open in Telegram');
  });

  it('prefers Telegram language over browser language when no stored preference exists', () => {
    const i18n = createI18nState({
      storage: createLocalStorageAdapter(new MemoryStorage()),
      telegram: launchContext('zh-CN'),
      browserLanguages: ['en-US'],
    });

    expect(i18n.locale.value).toBe('zh');
    expect(i18n.t('home.title')).toBe('HHHL 聊天小程序');
  });

  it('falls back to browser language and supports runtime locale changes', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const i18n = createI18nState({
      storage,
      telegram: launchContext(undefined),
      browserLanguages: ['zh-Hant-HK'],
    });

    expect(i18n.locale.value).toBe('zh');

    i18n.setLocale('en');

    expect(i18n.locale.value).toBe('en');
    expect(storage.getJson('hhhl-chat:locale', null)).toBe('en');
  });

  it('uses English for unsupported languages and replaces params', () => {
    const i18n = createI18nState({
      storage: createLocalStorageAdapter(new MemoryStorage()),
      telegram: launchContext('ja'),
      browserLanguages: ['fr-CA'],
    });

    expect(i18n.locale.value).toBe('en');
    expect(i18n.t('rooms.deepLinkTarget', { roomId: 'room-1' })).toBe('Opening room room-1');
  });
});

describe('applyTelegramTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('writes Telegram theme params to app CSS variables', () => {
    applyTelegramTheme({
      bg_color: '#111111',
      text_color: '#eeeeee',
      hint_color: '#999999',
      button_color: '#33aa55',
      button_text_color: '#ffffff',
      secondary_bg_color: '#222222',
    });

    const style = document.documentElement.style;

    expect(style.getPropertyValue('--tg-bg')).toBe('#111111');
    expect(style.getPropertyValue('--tg-text')).toBe('#eeeeee');
    expect(style.getPropertyValue('--tg-hint')).toBe('#999999');
    expect(style.getPropertyValue('--tg-button')).toBe('#33aa55');
    expect(style.getPropertyValue('--tg-button-text')).toBe('#ffffff');
    expect(style.getPropertyValue('--tg-panel')).toBe('#222222');
  });

  it('uses instance-inspired fallbacks when Telegram params are absent', () => {
    applyTelegramTheme({});

    const style = document.documentElement.style;

    expect(style.getPropertyValue('--tg-bg')).toBe('#e8edf3');
    expect(style.getPropertyValue('--tg-text')).toBe('#14202b');
    expect(style.getPropertyValue('--tg-hint')).toBe('#6d7a86');
    expect(style.getPropertyValue('--tg-button')).toBe('#2aabee');
    expect(style.getPropertyValue('--tg-button-text')).toBe('#ffffff');
    expect(style.getPropertyValue('--tg-panel')).toBe('#ffffff');
  });
});
