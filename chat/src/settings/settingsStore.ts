import { defineStore } from 'pinia';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { redactSensitiveText } from '@/shared/errors';
import type { LocalStorageAdapter } from '@/shared/storage';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { Locale } from '@/i18n/locales';
import type { AuthDependencies, useAuthStore } from '@/auth/authStore';

export const SETTINGS_LANGUAGE_KEY = 'hhhl-chat:locale';
const DRAFTS_KEY = 'hhhl-chat:drafts';
const RECENT_ROOM_KEY = 'hhhl-chat:recent-room';

type AuthStore = ReturnType<typeof useAuthStore>;

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
  debugOpen: boolean;
  diagnostics: string;
  lastAction: 'settings.clearLocalDataDone' | null;
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
    debugOpen: false,
    diagnostics: '',
    lastAction: null,
  }),
  actions: {
    init(storage: LocalStorageAdapter = createLocalStorageAdapter()) {
      this.language = storage.getJson<Locale>(SETTINGS_LANGUAGE_KEY, 'en');
      this.debugOpen = false;
    },

    setLanguage(locale: Locale, storage: LocalStorageAdapter = createLocalStorageAdapter()) {
      this.language = locale;
      storage.setJson(SETTINGS_LANGUAGE_KEY, locale);
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
      this.lastAction = 'settings.clearLocalDataDone';
    },

    logout(auth: AuthStore, dependencies: Pick<AuthDependencies, 'storage'>, router: RouterLike) {
      auth.logout(dependencies);
      router.replace('/');
    },
  },
});
