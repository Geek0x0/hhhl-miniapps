import { normalizeLocale, type Locale } from '@/i18n/locales';

export const CLOUD_SETTINGS_SCHEMA_VERSION = 1;
export const CLOUD_SETTINGS_APP = 'hhhl-chat';
export const SETTINGS_UPDATED_AT_KEY = 'hhhl-chat:settings-updated-at';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface SettingsPreferences {
  language: Locale;
  themeMode: ThemeMode;
  favoriteUserIds: string[];
}

export interface CloudSettingsDocument {
  schemaVersion: typeof CLOUD_SETTINGS_SCHEMA_VERSION;
  app: typeof CLOUD_SETTINGS_APP;
  updatedAt: string;
  preferences: SettingsPreferences;
  [key: string]: unknown;
}

export type ParseCloudSettingsResult =
  | { ok: true; document: CloudSettingsDocument }
  | { ok: false; code: 'INVALID_JSON' | 'INVALID_SHAPE' | 'UNSUPPORTED_SCHEMA' | 'INVALID_APP' | 'INVALID_UPDATED_AT' | 'INVALID_PREFERENCES'; message: string };

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function normalizeFavoriteUserIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item !== ''))];
}

export function isUtcIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function compareUpdatedAt(left: string, right: string): -1 | 0 | 1 {
  if (!isUtcIsoTimestamp(left) || !isUtcIsoTimestamp(right)) {
    throw new Error('Invalid updatedAt timestamp');
  }

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (leftTime === rightTime) {
    return 0;
  }

  return leftTime > rightTime ? 1 : -1;
}

function parsePreferences(value: unknown): SettingsPreferences | null {
  const raw = recordFrom(value);
  if (raw == null) {
    return null;
  }

  const language = normalizeLocale(typeof raw.language === 'string' ? raw.language : null);
  const themeMode = isThemeMode(raw.themeMode) ? raw.themeMode : null;
  const favoriteUserIds = normalizeFavoriteUserIds(raw.favoriteUserIds);

  if (language == null || themeMode == null || favoriteUserIds == null) {
    return null;
  }

  return {
    language,
    themeMode,
    favoriteUserIds,
  };
}

export function parseCloudSettingsJson(value: string): ParseCloudSettingsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, code: 'INVALID_JSON', message: 'Invalid settings JSON' };
  }

  const raw = recordFrom(parsed);
  if (raw == null) {
    return { ok: false, code: 'INVALID_SHAPE', message: 'Invalid settings document shape' };
  }

  if (raw.schemaVersion !== CLOUD_SETTINGS_SCHEMA_VERSION) {
    return { ok: false, code: 'UNSUPPORTED_SCHEMA', message: 'Unsupported settings schema version' };
  }

  if (raw.app !== CLOUD_SETTINGS_APP) {
    return { ok: false, code: 'INVALID_APP', message: 'Invalid settings app id' };
  }

  if (!isUtcIsoTimestamp(raw.updatedAt)) {
    return { ok: false, code: 'INVALID_UPDATED_AT', message: 'Invalid settings updatedAt timestamp' };
  }

  const preferences = parsePreferences(raw.preferences);
  if (preferences == null) {
    return { ok: false, code: 'INVALID_PREFERENCES', message: 'Invalid settings preferences' };
  }

  return {
    ok: true,
    document: {
      ...raw,
      schemaVersion: CLOUD_SETTINGS_SCHEMA_VERSION,
      app: CLOUD_SETTINGS_APP,
      updatedAt: raw.updatedAt,
      preferences,
    },
  };
}

export function createCloudSettingsDocument(
  preferences: SettingsPreferences,
  updatedAt: string,
  base?: CloudSettingsDocument | null,
): CloudSettingsDocument {
  if (!isUtcIsoTimestamp(updatedAt)) {
    throw new Error('Invalid updatedAt timestamp');
  }

  const preserved = base == null
    ? {}
    : Object.fromEntries(Object.entries(base).filter(([key]) => !['schemaVersion', 'app', 'updatedAt', 'preferences'].includes(key)));

  return {
    ...preserved,
    schemaVersion: CLOUD_SETTINGS_SCHEMA_VERSION,
    app: CLOUD_SETTINGS_APP,
    updatedAt,
    preferences: {
      language: preferences.language,
      themeMode: preferences.themeMode,
      favoriteUserIds: normalizeFavoriteUserIds(preferences.favoriteUserIds) ?? [],
    },
  };
}
