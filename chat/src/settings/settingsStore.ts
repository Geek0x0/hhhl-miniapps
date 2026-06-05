import { defineStore } from 'pinia';
import { ApiClient } from '@/api/apiClient';
import { API_BASE_URL, DC_HHHL_ORIGIN } from '@/shared/config';
import { redactSensitiveText } from '@/shared/errors';
import type { LocalStorageAdapter } from '@/shared/storage';
import { createLocalStorageAdapter } from '@/shared/storage';
import { i18n } from '@/i18n';
import { normalizeLocale, type Locale } from '@/i18n/locales';
import type { AuthDependencies, useAuthStore } from '@/auth/authStore';
import {
  createCloudSettingsDocument,
  isThemeMode,
  normalizeFavoriteUserIds,
  SETTINGS_UPDATED_AT_KEY,
  type CloudSettingsDocument,
  type SettingsPreferences,
  type ThemeMode,
} from './settingsConfig';
import { createSettingsDriveApi } from './settingsDriveApi';
import {
  createSettingsSyncService,
  type SettingsSyncResult,
  type SettingsSyncService,
} from './settingsSync';

export const SETTINGS_LANGUAGE_KEY = 'hhhl-chat:locale';
export const SETTINGS_THEME_MODE_KEY = 'hhhl-chat:theme-mode';
export const SETTINGS_FAVORITE_USERS_KEY = 'hhhl-chat:favorite-users';
const DRAFTS_KEY = 'hhhl-chat:drafts';
const RECENT_ROOM_KEY = 'hhhl-chat:recent-room';

type AuthStore = ReturnType<typeof useAuthStore>;
export type { ThemeMode } from './settingsConfig';
export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'failed';

export interface SettingsStoreDependencies {
  storage: LocalStorageAdapter;
  sync?: SettingsSyncService;
  now: () => Date;
  debounceMs: number;
}

type SettingsStoreInput = LocalStorageAdapter | Partial<SettingsStoreDependencies>;

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
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  localUpdatedAt: string | null;
  baseCloudDocument: CloudSettingsDocument | null;
  autoSaveTimer: number | null;
  autoSaveInFlight: boolean;
  autoSaveQueued: boolean;
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
  return isThemeMode(value) ? value : 'system';
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

function isStorageAdapter(value: unknown): value is LocalStorageAdapter {
  return value != null
    && typeof value === 'object'
    && typeof (value as LocalStorageAdapter).getJson === 'function'
    && typeof (value as LocalStorageAdapter).setJson === 'function'
    && typeof (value as LocalStorageAdapter).remove === 'function';
}

function createDefaultDependencies(): SettingsStoreDependencies {
  const storage = createLocalStorageAdapter();
  const api = new ApiClient({
    baseUrl: API_BASE_URL,
    tokenProvider: () => storage.getToken(),
  });
  const drive = createSettingsDriveApi({
    callEndpoint: api.callEndpoint.bind(api),
    uploadFile: api.uploadFile.bind(api),
    tokenProvider: api.tokenProvider,
  });

  return {
    storage,
    sync: createSettingsSyncService({ drive }),
    now: () => new Date(),
    debounceMs: 500,
  };
}

function resolveDependencies(input?: SettingsStoreInput): SettingsStoreDependencies {
  if (input == null) {
    return createDefaultDependencies();
  }

  if (isStorageAdapter(input)) {
    return {
      storage: input,
      now: () => new Date(),
      debounceMs: 500,
    };
  }

  return {
    storage: input.storage ?? createLocalStorageAdapter(),
    sync: input.sync,
    now: input.now ?? (() => new Date()),
    debounceMs: input.debounceMs ?? 500,
  };
}

function isoNow(dependencies: SettingsStoreDependencies): string {
  return dependencies.now().toISOString();
}

function errorMessage(error: unknown): string {
  return redactSensitiveText(error instanceof Error ? error.message : String(error));
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    language: 'en',
    themeMode: 'system',
    favoriteUserIds: [],
    debugOpen: false,
    diagnostics: '',
    lastAction: null,
    syncStatus: 'idle',
    syncError: null,
    lastSyncedAt: null,
    localUpdatedAt: null,
    baseCloudDocument: null,
    autoSaveTimer: null,
    autoSaveInFlight: false,
    autoSaveQueued: false,
  }),
  actions: {
    preferencesSnapshot(): SettingsPreferences {
      return {
        language: this.language,
        themeMode: this.themeMode,
        favoriteUserIds: this.favoriteUserIds,
      };
    },

    localSnapshot() {
      return {
        preferences: this.preferencesSnapshot(),
        updatedAt: this.localUpdatedAt ?? new Date().toISOString(),
        baseDocument: this.baseCloudDocument ?? undefined,
      };
    },

    persistPreferences(storage: LocalStorageAdapter) {
      storage.setJson(SETTINGS_LANGUAGE_KEY, this.language);
      storage.setJson(SETTINGS_THEME_MODE_KEY, this.themeMode);
      storage.setJson(SETTINGS_FAVORITE_USERS_KEY, this.favoriteUserIds);
      if (this.localUpdatedAt != null) {
        storage.setJson(SETTINGS_UPDATED_AT_KEY, this.localUpdatedAt);
      }
    },

    touchLocal(dependencies: SettingsStoreDependencies) {
      this.localUpdatedAt = isoNow(dependencies);
      this.persistPreferences(dependencies.storage);
    },

    init(input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      const { storage } = dependencies;
      const storedLanguage = normalizeLocale(storage.getJson<string | null>(SETTINGS_LANGUAGE_KEY, null));
      this.language = storedLanguage ?? i18n.locale.value;
      this.themeMode = normalizeThemeMode(storage.getJson<ThemeMode>(SETTINGS_THEME_MODE_KEY, 'system'));
      this.favoriteUserIds = normalizeFavoriteUserIds(storage.getJson<string[]>(SETTINGS_FAVORITE_USERS_KEY, [])) ?? [];
      this.localUpdatedAt = storage.getJson<string | null>(SETTINGS_UPDATED_AT_KEY, null);
      if (this.localUpdatedAt == null) {
        this.localUpdatedAt = isoNow(dependencies);
        storage.setJson(SETTINGS_UPDATED_AT_KEY, this.localUpdatedAt);
      }
      this.debugOpen = false;
      this.syncError = null;
      applyThemeMode(this.themeMode);
    },

    setLanguage(locale: Locale, input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      this.language = locale;
      i18n.setLocale(locale);
      this.touchLocal(dependencies);
      this.queueAutoSave(dependencies);
    },

    setThemeMode(mode: ThemeMode, input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      this.themeMode = mode;
      applyThemeMode(mode);
      this.touchLocal(dependencies);
      this.queueAutoSave(dependencies);
    },

    isFavoriteUser(userId: string | null | undefined): boolean {
      return userId != null && this.favoriteUserIds.includes(userId);
    },

    toggleFavoriteUser(userId: string, input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      const normalizedId = userId.trim();
      if (normalizedId === '') {
        return;
      }

      this.favoriteUserIds = this.favoriteUserIds.includes(normalizedId)
        ? this.favoriteUserIds.filter((id) => id !== normalizedId)
        : [...this.favoriteUserIds, normalizedId];
      this.touchLocal(dependencies);
      this.queueAutoSave(dependencies);
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

    applyCloudDocument(document: CloudSettingsDocument, storage: LocalStorageAdapter) {
      this.language = document.preferences.language;
      this.themeMode = document.preferences.themeMode;
      this.favoriteUserIds = document.preferences.favoriteUserIds;
      this.localUpdatedAt = document.updatedAt;
      this.baseCloudDocument = document;
      i18n.setLocale(this.language);
      applyThemeMode(this.themeMode);
      this.persistPreferences(storage);
    },

    applySyncResult(result: SettingsSyncResult, storage: LocalStorageAdapter) {
      if (result.status === 'loaded-cloud') {
        this.applyCloudDocument(result.document, storage);
      } else {
        this.baseCloudDocument = createCloudSettingsDocument(
          result.document.preferences,
          result.document.updatedAt,
          result.document,
        );
      }

      this.syncStatus = 'synced';
      this.syncError = null;
      this.lastSyncedAt = result.syncedAt;
    },

    async syncAfterLogin(input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      if (dependencies.sync == null) {
        return;
      }

      if (this.localUpdatedAt == null) {
        this.init(dependencies);
      }

      this.syncStatus = 'loading';
      this.syncError = null;

      try {
        const result = await dependencies.sync.syncAfterLogin(this.localSnapshot());
        this.applySyncResult(result, dependencies.storage);
      } catch (error) {
        this.syncStatus = 'failed';
        this.syncError = errorMessage(error);
      }
    },

    async saveToCloud(input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      if (dependencies.sync == null) {
        return;
      }

      if (this.localUpdatedAt == null) {
        this.init(dependencies);
      }

      this.syncStatus = 'saving';
      this.syncError = null;

      try {
        const result = await dependencies.sync.save(this.localSnapshot());
        this.applySyncResult(result, dependencies.storage);
      } catch (error) {
        this.syncStatus = 'failed';
        this.syncError = errorMessage(error);
      }
    },

    queueAutoSave(input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      if (dependencies.sync == null) {
        return;
      }

      if (this.autoSaveTimer != null) {
        window.clearTimeout(this.autoSaveTimer);
      }

      this.autoSaveTimer = window.setTimeout(() => {
        this.autoSaveTimer = null;
        void this.runQueuedAutoSave(dependencies);
      }, dependencies.debounceMs);
    },

    async runQueuedAutoSave(dependencies: SettingsStoreDependencies) {
      if (dependencies.sync == null) {
        return;
      }

      if (this.autoSaveInFlight) {
        this.autoSaveQueued = true;
        return;
      }

      this.autoSaveInFlight = true;
      try {
        await this.saveToCloud(dependencies);
      } finally {
        this.autoSaveInFlight = false;
      }

      if (this.autoSaveQueued) {
        this.autoSaveQueued = false;
        await this.runQueuedAutoSave(dependencies);
      }
    },

    clearLocalData(input?: SettingsStoreInput) {
      const dependencies = resolveDependencies(input);
      const { storage } = dependencies;
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
