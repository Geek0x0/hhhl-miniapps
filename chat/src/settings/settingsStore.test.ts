import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { LocalStorageAdapter } from '@/shared/storage';
import { useAuthStore, type AuthDependencies } from '@/auth/authStore';
import { i18n } from '@/i18n';
import {
  SETTINGS_FAVORITE_USERS_KEY,
  SETTINGS_LANGUAGE_KEY,
  SETTINGS_THEME_MODE_KEY,
  useSettingsStore,
} from './settingsStore';
import { createCloudSettingsDocument, SETTINGS_UPDATED_AT_KEY } from './settingsConfig';
import type { SettingsSyncResult, SettingsSyncService } from './settingsSync';

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

function authDeps(storage = createLocalStorageAdapter(new MemoryStorage())): AuthDependencies {
  return {
    storage,
    api: { callEndpoint: vi.fn(async () => ({ id: 'user-1', username: 'alice' })) as AuthDependencies['api']['callEndpoint'] },
    completeMiAuth: vi.fn(async () => 'token'),
    openAuthUrl: vi.fn(),
    buildAuthUrl: vi.fn(() => 'https://dc.hhhl.cc/miauth/session'),
    createSession: vi.fn(() => 'session'),
    currentUrl: () => 'https://mini.example/settings',
  };
}

function syncDeps(
  storage = createLocalStorageAdapter(new MemoryStorage()),
  overrides: Partial<SettingsSyncService> = {},
): { storage: LocalStorageAdapter; sync: SettingsSyncService; now: () => Date; debounceMs: number } {
  const sync: SettingsSyncService = {
    syncAfterLogin: vi.fn(async (snapshot): Promise<SettingsSyncResult> => ({
      status: 'unchanged',
      document: createCloudSettingsDocument(snapshot.preferences, snapshot.updatedAt, snapshot.baseDocument ?? null),
      syncedAt: '2026-06-05T02:00:00.000Z',
    })),
    save: vi.fn(async (snapshot): Promise<SettingsSyncResult> => ({
      status: 'saved-local',
      document: createCloudSettingsDocument(snapshot.preferences, snapshot.updatedAt, snapshot.baseDocument ?? null),
      syncedAt: '2026-06-05T02:00:00.000Z',
    })),
    ...overrides,
  };

  return {
    storage,
    sync,
    now: () => new Date('2026-06-05T01:00:00.000Z'),
    debounceMs: 10,
  };
}

describe('settingsStore', () => {
  beforeEach(() => {
    vi.useRealTimers();
    setActivePinia(createPinia());
    i18n.setLocale('en');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
    document.documentElement.removeAttribute('style');
  });

  it('stores language preference and keeps debug panel closed by default', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();

    store.init(storage);
    expect(store.debugOpen).toBe(false);

    store.setLanguage('zh', storage);

    expect(store.language).toBe('zh');
    expect(storage.getJson(SETTINGS_LANGUAGE_KEY, null)).toBe('zh');
    expect(i18n.locale.value).toBe('zh');
  });

  it('uses current i18n locale when no stored language preference exists', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();
    i18n.setLocale('zh');

    store.init(storage);

    expect(store.language).toBe('zh');
  });

  it('stores theme mode and applies CSS variables', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();

    store.setThemeMode('dark', storage);

    expect(store.themeMode).toBe('dark');
    expect(storage.getJson(SETTINGS_THEME_MODE_KEY, null)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--tg-panel')).toBe('#17212b');
  });

  it('stores and clears favorite users', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();

    store.toggleFavoriteUser('user-2', storage);
    expect(store.isFavoriteUser('user-2')).toBe(true);
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, [])).toEqual(['user-2']);

    store.toggleFavoriteUser('user-2', storage);
    expect(store.isFavoriteUser('user-2')).toBe(false);
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, [])).toEqual([]);
  });

  it('redacts token-like strings from diagnostics', () => {
    const store = useSettingsStore();

    store.collectDiagnostics({
      instanceUrl: 'https://dc.hhhl.cc',
      realtimeStatus: 'degraded',
      storageStatus: 'available',
      raw: 'token=secret &i=secret2 {"token":"secret3"}',
    });

    expect(store.diagnostics).toContain('token=[redacted]');
    expect(store.diagnostics).toContain('&i=[redacted]');
    expect(store.diagnostics).toContain('"token":"[redacted]"');
    expect(store.diagnostics).not.toContain('secret3');
  });

  it('clears local app data without leaving drafts or recent rooms', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();

    storage.setJson('hhhl-chat:drafts', { 'room-1': 'draft' });
    storage.setJson('hhhl-chat:recent-room', 'room-1');
    storage.setJson(SETTINGS_FAVORITE_USERS_KEY, ['user-2']);
    store.favoriteUserIds = ['user-2'];
    store.clearLocalData(storage);

    expect(storage.getJson('hhhl-chat:drafts', null)).toBeNull();
    expect(storage.getJson('hhhl-chat:recent-room', null)).toBeNull();
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, null)).toBeNull();
    expect(store.favoriteUserIds).toEqual([]);
    expect(store.lastAction).toBe('settings.clearLocalDataDone');
  });

  it('initializes local updatedAt when missing', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();

    store.init(syncDeps(storage));

    expect(store.localUpdatedAt).toBe('2026-06-05T01:00:00.000Z');
    expect(storage.getJson(SETTINGS_UPDATED_AT_KEY, null)).toBe('2026-06-05T01:00:00.000Z');
    expect(store.syncStatus).toBe('idle');
    expect(store.syncError).toBeNull();
  });

  it('updates local updatedAt and auto-saves changed language using fake timers', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      const deps = syncDeps(storage);
      const store = useSettingsStore();

      store.init(deps);
      store.setLanguage('zh', deps);
      await vi.advanceTimersByTimeAsync(10);

      expect(store.language).toBe('zh');
      expect(storage.getJson(SETTINGS_LANGUAGE_KEY, null)).toBe('zh');
      expect(storage.getJson(SETTINGS_UPDATED_AT_KEY, null)).toBe('2026-06-05T01:00:00.000Z');
      expect(deps.sync.save).toHaveBeenCalledWith({
        preferences: {
          language: 'zh',
          themeMode: 'system',
          favoriteUserIds: [],
        },
        updatedAt: '2026-06-05T01:00:00.000Z',
        baseDocument: undefined,
      });
      expect(store.syncStatus).toBe('synced');
      expect(store.lastSyncedAt).toBe('2026-06-05T02:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies newer cloud settings after login', async () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    storage.setJson(SETTINGS_LANGUAGE_KEY, 'en');
    storage.setJson(SETTINGS_THEME_MODE_KEY, 'light');
    storage.setJson(SETTINGS_FAVORITE_USERS_KEY, ['local-user']);
    storage.setJson(SETTINGS_UPDATED_AT_KEY, '2026-06-05T01:00:00.000Z');
    const cloudDocument = createCloudSettingsDocument(
      {
        language: 'zh',
        themeMode: 'dark',
        favoriteUserIds: ['cloud-user'],
      },
      '2026-06-05T03:00:00.000Z',
    );
    const deps = syncDeps(storage, {
      syncAfterLogin: vi.fn(async (): Promise<SettingsSyncResult> => ({
        status: 'loaded-cloud',
        document: cloudDocument,
        syncedAt: '2026-06-05T02:00:00.000Z',
      })),
    });
    const store = useSettingsStore();

    await store.syncAfterLogin(deps);

    expect(store.language).toBe('zh');
    expect(store.themeMode).toBe('dark');
    expect(store.favoriteUserIds).toEqual(['cloud-user']);
    expect(store.localUpdatedAt).toBe('2026-06-05T03:00:00.000Z');
    expect(store.baseCloudDocument).toEqual(cloudDocument);
    expect(storage.getJson(SETTINGS_LANGUAGE_KEY, null)).toBe('zh');
    expect(storage.getJson(SETTINGS_THEME_MODE_KEY, null)).toBe('dark');
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, [])).toEqual(['cloud-user']);
    expect(storage.getJson(SETTINGS_UPDATED_AT_KEY, null)).toBe('2026-06-05T03:00:00.000Z');
    expect(i18n.locale.value).toBe('zh');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(store.syncStatus).toBe('synced');
    expect(store.syncError).toBeNull();
    expect(store.lastSyncedAt).toBe('2026-06-05T02:00:00.000Z');
  });

  it('keeps local UI state when sync save fails and redacts token secrets', async () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const deps = syncDeps(storage, {
      save: vi.fn(async () => {
        throw new Error('request failed token=secret-token');
      }),
    });
    const store = useSettingsStore();

    store.init(deps);
    store.setThemeMode('dark', deps);
    await store.saveToCloud(deps);

    expect(store.themeMode).toBe('dark');
    expect(storage.getJson(SETTINGS_THEME_MODE_KEY, null)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(store.syncStatus).toBe('failed');
    expect(store.syncError).toBe('request failed token=[redacted]');
    expect(store.syncError).not.toContain('secret-token');
  });

  it('does not delete or save cloud config when clearing local data', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const deps = syncDeps(storage);
    const store = useSettingsStore();

    storage.setJson('hhhl-chat:drafts', { 'room-1': 'draft' });
    storage.setJson('hhhl-chat:recent-room', 'room-1');
    storage.setJson(SETTINGS_FAVORITE_USERS_KEY, ['user-2']);
    store.favoriteUserIds = ['user-2'];
    store.clearLocalData(deps);

    expect(storage.getJson('hhhl-chat:drafts', null)).toBeNull();
    expect(storage.getJson('hhhl-chat:recent-room', null)).toBeNull();
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, null)).toBeNull();
    expect(store.favoriteUserIds).toEqual([]);
    expect(store.lastAction).toBe('settings.clearLocalDataDone');
    expect(deps.sync.save).not.toHaveBeenCalled();
    expect(deps.sync.syncAfterLogin).not.toHaveBeenCalled();
  });

  it('logs out through auth store and redirects to login route', async () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const deps = authDeps(storage);
    const auth = useAuthStore();
    const settings = useSettingsStore();
    const replace = vi.fn();

    storage.setToken('secret-token');
    await auth.restore(deps);
    settings.logout(auth, deps, { replace });

    expect(auth.status).toBe('logout-complete');
    expect(storage.getToken()).toBeNull();
    expect(replace).toHaveBeenCalledWith('/');
  });
});
