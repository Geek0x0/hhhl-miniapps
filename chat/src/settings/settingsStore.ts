import { defineStore } from 'pinia';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { redactSensitiveText } from '@/shared/errors';
import type { LocalStorageAdapter } from '@/shared/storage';
import { createLocalStorageAdapter } from '@/shared/storage';
import { i18n } from '@/i18n';
import { normalizeLocale, type Locale } from '@/i18n/locales';
import type { AuthDependencies, useAuthStore } from '@/auth/authStore';

export const SETTINGS_LANGUAGE_KEY = 'hhhl-chat:locale';
export const SETTINGS_THEME_MODE_KEY = 'hhhl-chat:theme-mode';
export const SETTINGS_FAVORITE_USERS_KEY = 'hhhl-chat:favorite-users';
const DRAFTS_KEY = 'hhhl-chat:drafts';
const RECENT_ROOM_KEY = 'hhhl-chat:recent-room';

type AuthStore = ReturnType<typeof useAuthStore>;
export type ThemeMode = 'system' | 'light' | 'dark';

export interface DiagnosticsInput {
  instanceUrl?: string;
  realtimeStatus?: string;
  storageStatus?: string;
  raw?: string;
}

export interface RouterLike {
  replace: (path: string) => unknown;
}

export interface SettingsState {
  language: Locale;
  themeMode: ThemeMode;
  favoriteUserIds: string[];
  debugOpen: boolean;
  diagnostics: string;
  lastAction: 'settings.clearLocalDataDone' | null;
}

const lightTheme = {
  bg: '#e8edf3',
  text: '#14202b',
  hint: '#6d7a86',
  button: '#2aabee',
  buttonText: '#ffffff',
  panel: '#ffffff',
} satisfies Record<string, string>;

const darkTheme = {
  bg: '#0f1820',
  text: '#eef5fb',
  hint: '#8fa1af',
  button: '#2aabee',
  buttonText: '#ffffff',
  panel: '#17212b',
} satisfies Record<string, string>;

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function normalizeFavoriteUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()))];
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

export function applyThemeMode(mode: ThemeMode): void {
  const resolvedTheme = mode === 'dark' || (mode === 'system' && prefersDark()) ? darkTheme : lightTheme;
  const root = document.documentElement;

  root.dataset.themeMode = mode;
  root.dataset.theme = resolvedTheme === darkTheme ? 'dark' : 'light';
  root.style.setProperty('--tg-bg', resolvedTheme.bg);
  root.style.setProperty('--tg-text', resolvedTheme.text);
  root.style.setProperty('--tg-hint', resolvedTheme.hint);
  root.style.setProperty('--tg-button', resolvedTheme.button);
  root.style.setProperty('--tg-button-text', resolvedTheme.buttonText);
  root.style.setProperty('--tg-panel', resolvedTheme.panel);
}

function storageStatus(storage: LocalStorageAdapter): string {
  try {
    storage.setJson('hhhl-chat:storage-test', true);
    storage.remove('hhhl-chat:storage-test');
    return 'available';
  } catch {
    return 'memory-only';
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    language: 'en',
    themeMode: 'system',
    favoriteUserIds: [],
    debugOpen: false,
    diagnostics: '',
    lastAction: null,
  }),
  actions: {
    init(storage: LocalStorageAdapter = createLocalStorageAdapter()) {
      const storedLanguage = normalizeLocale(storage.getJson<string | null>(SETTINGS_LANGUAGE_KEY, null));
      this.language = storedLanguage ?? i18n.locale.value;
      this.themeMode = normalizeThemeMode(storage.getJson<ThemeMode>(SETTINGS_THEME_MODE_KEY, 'system'));
      this.favoriteUserIds = normalizeFavoriteUserIds(storage.getJson<string[]>(SETTINGS_FAVORITE_USERS_KEY, []));
      this.debugOpen = false;
      applyThemeMode(this.themeMode);
    },

    setLanguage(locale: Locale, storage: LocalStorageAdapter = createLocalStorageAdapter()) {
      this.language = locale;
      i18n.setLocale(locale);
      storage.setJson(SETTINGS_LANGUAGE_KEY, locale);
    },

    setThemeMode(mode: ThemeMode, storage: LocalStorageAdapter = createLocalStorageAdapter()) {
      this.themeMode = mode;
      storage.setJson(SETTINGS_THEME_MODE_KEY, mode);
      applyThemeMode(mode);
    },

    isFavoriteUser(userId: string | null | undefined): boolean {
      return userId != null && this.favoriteUserIds.includes(userId);
    },

    toggleFavoriteUser(userId: string, storage: LocalStorageAdapter = createLocalStorageAdapter()) {
      const normalizedId = userId.trim();
      if (normalizedId === '') {
        return;
      }

      this.favoriteUserIds = this.favoriteUserIds.includes(normalizedId)
        ? this.favoriteUserIds.filter((id) => id !== normalizedId)
        : [...this.favoriteUserIds, normalizedId];
      storage.setJson(SETTINGS_FAVORITE_USERS_KEY, this.favoriteUserIds);
    },

    toggleDebug() {
      this.debugOpen = !this.debugOpen;
    },

    collectDiagnostics(input: DiagnosticsInput = {}) {
      this.diagnostics = redactSensitiveText([
        `instance=${input.instanceUrl ?? DC_HHHL_ORIGIN}`,
        `realtime=${input.realtimeStatus ?? 'unknown'}`,
        `storage=${input.storageStatus ?? storageStatus(createLocalStorageAdapter())}`,
        input.raw ?? '',
      ].join('\n'));
    },

    clearLocalData(storage: LocalStorageAdapter = createLocalStorageAdapter()) {
      storage.remove(DRAFTS_KEY);
      storage.remove(RECENT_ROOM_KEY);
      storage.remove(SETTINGS_FAVORITE_USERS_KEY);
      this.favoriteUserIds = [];
      this.lastAction = 'settings.clearLocalDataDone';
    },

    logout(auth: AuthStore, dependencies: Pick<AuthDependencies, 'storage'>, router: RouterLike) {
      auth.logout(dependencies);
      router.replace('/');
    },
  },
});
