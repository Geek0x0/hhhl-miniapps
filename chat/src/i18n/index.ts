import { computed, readonly, ref } from 'vue';
import type { LocalStorageAdapter } from '@/shared/storage';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { TelegramLaunchContext } from '@/telegram/telegram';
import { getTelegramLaunchContext } from '@/telegram/telegram';
import en from './messages.en';
import zh from './messages.zh';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, localeToHtmlLang, normalizeLocale, type Locale } from './locales';

type MessageKey = keyof typeof en;
type MessageParams = Record<string, string | number>;

const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  zh,
};

export interface I18nStateOptions {
  storage?: LocalStorageAdapter;
  telegram?: TelegramLaunchContext;
  browserLanguages?: readonly string[];
}

function readStoredLocale(storage: LocalStorageAdapter): Locale | null {
  return normalizeLocale(storage.getJson<string | null>(LOCALE_STORAGE_KEY, null));
}

function detectLocale(options: Required<Pick<I18nStateOptions, 'storage'>> & Omit<I18nStateOptions, 'storage'>): Locale {
  const stored = readStoredLocale(options.storage);
  if (stored != null) {
    return stored;
  }

  const telegramLocale = normalizeLocale(options.telegram?.userLanguageCode);
  if (telegramLocale != null) {
    return telegramLocale;
  }

  for (const language of options.browserLanguages ?? []) {
    const browserLocale = normalizeLocale(language);
    if (browserLocale != null) {
      return browserLocale;
    }
  }

  return DEFAULT_LOCALE;
}

function interpolate(message: string, params: MessageParams = {}): string {
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = params[key];
    return value == null ? match : String(value);
  });
}

export function createI18nState(options: I18nStateOptions = {}) {
  const storage = options.storage ?? createLocalStorageAdapter();
  const browserLanguages = options.browserLanguages ?? [...navigator.languages];
  const locale = ref<Locale>(detectLocale({ ...options, storage, browserLanguages }));

  function setLocale(nextLocale: Locale): void {
    locale.value = nextLocale;
    storage.setJson(LOCALE_STORAGE_KEY, nextLocale);
    document.documentElement.lang = localeToHtmlLang(nextLocale);
  }

  function t(key: MessageKey, params?: MessageParams): string {
    const message = dictionaries[locale.value][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
    return interpolate(message, params);
  }

  document.documentElement.lang = localeToHtmlLang(locale.value);

  return {
    locale: readonly(locale),
    htmlLang: computed(() => localeToHtmlLang(locale.value)),
    setLocale,
    t,
  };
}

const fallbackTheme = {
  bg_color: '#f6f8f3',
  text_color: '#172018',
  hint_color: '#6b7564',
  button_color: '#86b300',
  button_text_color: '#ffffff',
  secondary_bg_color: '#ffffff',
} satisfies Record<string, string>;

type TelegramThemeKey = keyof typeof fallbackTheme;

const themeVariableMap: Record<TelegramThemeKey, string> = {
  bg_color: '--tg-bg',
  text_color: '--tg-text',
  hint_color: '--tg-hint',
  button_color: '--tg-button',
  button_text_color: '--tg-button-text',
  secondary_bg_color: '--tg-panel',
};

export function applyTelegramTheme(themeParams: Record<string, string | undefined>): void {
  const style = document.documentElement.style;

  for (const [telegramKey, cssVariable] of Object.entries(themeVariableMap) as Array<[TelegramThemeKey, string]>) {
    style.setProperty(cssVariable, themeParams[telegramKey] ?? fallbackTheme[telegramKey]);
  }
}

export const i18n = createI18nState({ telegram: getTelegramLaunchContext() });
export type { Locale, MessageKey };
