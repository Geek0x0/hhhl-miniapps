export const SUPPORTED_LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'hhhl-chat:locale';

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (value == null || value.trim() === '') {
    return null;
  }

  const normalized = value.toLowerCase().replace('_', '-');

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  if (normalized === 'zh' || normalized.startsWith('zh-')) {
    return 'zh';
  }

  return null;
}

export function localeToHtmlLang(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}
