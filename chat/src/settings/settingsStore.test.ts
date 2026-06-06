import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
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

  it('preserves unrelated stored settings when setting language before init', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();

    storage.setJson(SETTINGS_THEME_MODE_KEY, 'dark');
    storage.setJson(SETTINGS_FAVORITE_USERS_KEY, ['user-2']);
    store.setLanguage('zh', storage);

    expect(storage.getJson(SETTINGS_LANGUAGE_KEY, null)).toBe('zh');
    expect(storage.getJson(SETTINGS_THEME_MODE_KEY, null)).toBe('dark');
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, [])).toEqual(['user-2']);
  });

  it('keeps legacy storage setter calls local-only without queueing auto-save', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      const store = useSettingsStore();

      store.setLanguage('zh', storage);
      expect(store.autoSaveTimer).toBeNull();
      await vi.advanceTimersByTimeAsync(750);

      expect(store.autoSaveTimer).toBeNull();
      expect(store.syncStatus).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
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

  it('collects safe and detailed diagnostics while keeping the compatibility diagnostics field safe', () => {
    const store = useSettingsStore();

    store.collectDiagnostics({
      environment: {
        appVersion: '0.4.0',
        mode: 'test',
        isDev: false,
        instanceUrl: 'https://dc.hhhl.cc',
        telegramPresent: true,
        telegramPlatform: 'ios',
      },
      auth: {
        status: 'authorized',
        hasUser: true,
        userId: 'user-secret',
        username: 'alice',
      },
      route: {
        name: 'room-detail',
        path: '/rooms/room-secret',
      },
      realtime: {
        status: 'degraded',
        roomId: 'room-secret',
      },
      storage: {
        status: 'available',
      },
      rooms: {
        loading: false,
        roomCount: 2,
        invitationCount: 1,
        activeRoomId: 'room-secret',
        activeRoomName: 'Secret Room',
        pendingStartRoomId: 'room-pending',
        memberCount: 5,
        outboxInvitationCount: 3,
        error: 'room-secret failed &i=secret-room-token',
      },
      chat: {
        loading: false,
        roomId: 'room-secret',
        timelineCount: 9,
        outgoingCount: 2,
        failedOutgoingCount: 1,
        searchResultCount: 4,
        keySearchResultCount: 1,
        replyTargetPresent: true,
        quoteTargetPresent: false,
        error: 'token=secret-chat-token',
      },
      raw: 'token=secret &i=secret2 {"token":"secret3"} user-secret alice room-secret Secret Room',
    });

    expect(store.safeDiagnostics).toContain('appVersion=0.4.0');
    expect(store.safeDiagnostics).toContain('authStatus=authorized');
    expect(store.safeDiagnostics).toContain('roomCount=2');
    expect(store.safeDiagnostics).toContain('timelineCount=9');
    expect(store.safeDiagnostics).toContain('roomsError=[redacted]');
    expect(store.safeDiagnostics).toContain('chatError=[redacted]');
    expect(store.safeDiagnostics).toContain('[raw]\n[redacted]');
    expect(store.safeDiagnostics).not.toContain('user-secret');
    expect(store.safeDiagnostics).not.toContain('alice');
    expect(store.safeDiagnostics).not.toContain('room-secret');
    expect(store.safeDiagnostics).not.toContain('Secret Room');
    expect(store.safeDiagnostics).not.toContain('secret-chat-token');
    expect(store.safeDiagnostics).not.toContain('secret-room-token');
    expect(store.safeDiagnostics).not.toContain('secret3');
    expect(store.detailedDiagnostics).toContain('userId=user-secret');
    expect(store.detailedDiagnostics).toContain('username=alice');
    expect(store.detailedDiagnostics).toContain('activeRoomId=room-secret');
    expect(store.detailedDiagnostics).toContain('activeRoomName=Secret Room');
    expect(store.detailedDiagnostics).not.toContain('secret-chat-token');
    expect(store.detailedDiagnostics).not.toContain('secret-room-token');
    expect(store.detailedDiagnostics).not.toContain('secret3');
    expect(store.diagnostics).toBe(store.safeDiagnostics);
    expect(store.diagnosticsDetailConfirmed).toBe(false);
  });

  it('resets diagnostics detail confirmation when diagnostics refresh or the panel closes', () => {
    const store = useSettingsStore();

    store.collectDiagnostics({ storage: { status: 'available' } });
    store.confirmDiagnosticsDetail();
    expect(store.diagnosticsDetailConfirmed).toBe(true);

    store.collectDiagnostics({ storage: { status: 'available' } });
    expect(store.diagnosticsDetailConfirmed).toBe(false);

    store.confirmDiagnosticsDetail();
    store.debugOpen = true;
    store.toggleDebug();
    expect(store.debugOpen).toBe(false);
    expect(store.diagnosticsDetailConfirmed).toBe(false);
  });

  it('does not save settings sync state from diagnostics actions', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const deps = syncDeps(storage);
    const store = useSettingsStore();

    store.collectDiagnostics({ storage: { status: 'available' } });
    store.confirmDiagnosticsDetail();
    store.resetDiagnosticsDetail();

    expect(deps.sync.save).not.toHaveBeenCalled();
    expect(deps.sync.syncAfterLogin).not.toHaveBeenCalled();
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

  it('uses epoch updatedAt fallback before init', () => {
    const store = useSettingsStore();

    expect(store.localSnapshot().updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('normalizes favorite users in preference snapshots', () => {
    const store = useSettingsStore();

    store.favoriteUserIds = [' user-1 ', 'user-1', '', 'user-2'];

    expect(store.preferencesSnapshot().favoriteUserIds).toEqual(['user-1', 'user-2']);
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
        baseDocument: null,
      });
      expect(store.syncStatus).toBe('synced');
      expect(store.lastSyncedAt).toBe('2026-06-05T02:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses 750ms auto-save debounce when partial dependencies omit debounceMs', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      const sync = syncDeps(storage).sync;
      const store = useSettingsStore();

      store.init({ storage, sync, now: () => new Date('2026-06-05T01:00:00.000Z') });
      store.setLanguage('zh', { storage, sync, now: () => new Date('2026-06-05T01:00:00.000Z') });
      await vi.advanceTimersByTimeAsync(749);

      expect(sync.save).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);

      expect(sync.save).toHaveBeenCalledTimes(1);
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

  it('normalizes cloud favorite users when applying a document', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();
    const document = createCloudSettingsDocument(
      {
        language: 'en',
        themeMode: 'system',
        favoriteUserIds: ['user-1'],
      },
      '2026-06-05T03:00:00.000Z',
    );

    document.preferences.favoriteUserIds = [' user-1 ', 'user-1', '', 'user-2'];
    store.applyCloudDocument(document, storage);

    expect(store.favoriteUserIds).toEqual(['user-1', 'user-2']);
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, [])).toEqual(['user-1', 'user-2']);
  });

  it('keeps local UI state when sync save fails and redacts token secrets', async () => {
    vi.useFakeTimers();
    try {
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
    } finally {
      vi.useRealTimers();
    }
  });

  it('redacts bearer secrets from sync save errors', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      const deps = syncDeps(storage, {
        save: vi.fn(async () => {
          throw new Error('Authorization: Bearer secret-token');
        }),
      });
      const store = useSettingsStore();

      store.init(deps);
      store.setThemeMode('dark', deps);
      await store.saveToCloud(deps);

      expect(store.syncStatus).toBe('failed');
      expect(store.syncError).toBe('Authorization: Bearer [redacted]');
      expect(store.syncError).not.toContain('secret-token');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not delete or save cloud config when clearing local data', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const deps = syncDeps(storage);
    const store = useSettingsStore();

    storage.setJson('hhhl-chat:drafts', { 'room-1': 'draft' });
    storage.setJson('hhhl-chat:recent-room', 'room-1');
    storage.setJson(SETTINGS_FAVORITE_USERS_KEY, ['user-2']);
    store.favoriteUserIds = ['user-2'];
    store.syncStatus = 'failed';
    store.syncError = 'previous failure';
    store.lastSyncedAt = '2026-06-05T02:00:00.000Z';
    store.clearLocalData(deps);

    expect(storage.getJson('hhhl-chat:drafts', null)).toBeNull();
    expect(storage.getJson('hhhl-chat:recent-room', null)).toBeNull();
    expect(storage.getJson(SETTINGS_FAVORITE_USERS_KEY, null)).toBeNull();
    expect(store.favoriteUserIds).toEqual([]);
    expect(store.lastAction).toBe('settings.clearLocalDataDone');
    expect(store.syncStatus).toBe('idle');
    expect(store.syncError).toBeNull();
    expect(store.lastSyncedAt).toBeNull();
    expect(deps.sync.save).not.toHaveBeenCalled();
    expect(deps.sync.syncAfterLogin).not.toHaveBeenCalled();
  });

  it('cancels pending auto-save when clearing local data', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      const deps = syncDeps(storage);
      const store = useSettingsStore();

      store.init(deps);
      store.setLanguage('zh', deps);
      store.clearLocalData(deps);
      await vi.advanceTimersByTimeAsync(10);

      expect(deps.sync.save).not.toHaveBeenCalled();
      expect(store.autoSaveTimer).toBeNull();
      expect(store.autoSaveQueued).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores stale in-flight auto-save results after clearing local data', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      let resolveSave: (result: SettingsSyncResult) => void = () => {};
      const savePromise = new Promise<SettingsSyncResult>((resolve) => {
        resolveSave = resolve;
      });
      const cloudDocument = createCloudSettingsDocument(
        {
          language: 'zh',
          themeMode: 'light',
          favoriteUserIds: ['cloud-user'],
        },
        '2026-06-05T03:00:00.000Z',
      );
      const deps = syncDeps(storage, {
        save: vi.fn(() => savePromise),
      });
      const store = useSettingsStore();

      store.init(deps);
      store.setThemeMode('dark', deps);
      await vi.advanceTimersByTimeAsync(10);
      expect(store.autoSaveInFlight).toBe(true);

      store.clearLocalData(deps);
      resolveSave({
        status: 'loaded-cloud',
        document: cloudDocument,
        syncedAt: '2026-06-05T04:00:00.000Z',
      });
      await savePromise;
      await Promise.resolve();

      expect(store.syncStatus).toBe('idle');
      expect(store.lastSyncedAt).toBeNull();
      expect(store.favoriteUserIds).toEqual([]);
      expect(store.themeMode).toBe('dark');
      expect(store.language).toBe('en');
      expect(store.autoSaveQueued).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores stale syncAfterLogin results after clearing local data', async () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    let resolveSync: (result: SettingsSyncResult) => void = () => {};
    const syncPromise = new Promise<SettingsSyncResult>((resolve) => {
      resolveSync = resolve;
    });
    const cloudDocument = createCloudSettingsDocument(
      {
        language: 'zh',
        themeMode: 'dark',
        favoriteUserIds: ['cloud-user'],
      },
      '2026-06-05T03:00:00.000Z',
    );
    const deps = syncDeps(storage, {
      syncAfterLogin: vi.fn(() => syncPromise),
    });
    const store = useSettingsStore();

    const pendingSync = store.syncAfterLogin(deps);
    expect(store.syncStatus).toBe('loading');
    store.clearLocalData(deps);
    resolveSync({
      status: 'loaded-cloud',
      document: cloudDocument,
      syncedAt: '2026-06-05T04:00:00.000Z',
    });
    await pendingSync;

    expect(store.syncStatus).toBe('idle');
    expect(store.lastSyncedAt).toBeNull();
    expect(store.favoriteUserIds).toEqual([]);
    expect(store.language).toBe('en');
    expect(store.themeMode).toBe('system');
  });

  it('ignores stale syncAfterLogin results after local preference changes', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      let resolveSync: (result: SettingsSyncResult) => void = () => {};
      const syncPromise = new Promise<SettingsSyncResult>((resolve) => {
        resolveSync = resolve;
      });
      const cloudDocument = createCloudSettingsDocument(
        {
          language: 'en',
          themeMode: 'dark',
          favoriteUserIds: ['cloud-user'],
        },
        '2026-06-05T03:00:00.000Z',
      );
      const deps = syncDeps(storage, {
        syncAfterLogin: vi.fn(() => syncPromise),
      });
      const store = useSettingsStore();

      store.init(deps);
      const pendingSync = store.syncAfterLogin(deps);
      store.setLanguage('zh', deps);
      resolveSync({
        status: 'loaded-cloud',
        document: cloudDocument,
        syncedAt: '2026-06-05T04:00:00.000Z',
      });
      await pendingSync;

      expect(store.language).toBe('zh');
      expect(store.themeMode).toBe('system');
      expect(store.favoriteUserIds).toEqual([]);
      expect(storage.getJson(SETTINGS_LANGUAGE_KEY, null)).toBe('zh');
      expect(storage.getJson(SETTINGS_THEME_MODE_KEY, null)).toBeNull();

      await vi.advanceTimersByTimeAsync(10);

      expect(deps.sync.save).toHaveBeenCalledTimes(1);
      expect(deps.sync.save).toHaveBeenCalledWith({
        preferences: {
          language: 'zh',
          themeMode: 'system',
          favoriteUserIds: [],
        },
        updatedAt: '2026-06-05T01:00:00.000Z',
        baseDocument: null,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('serializes manual saves behind an in-flight auto-save', async () => {
    vi.useFakeTimers();
    try {
      const storage = createLocalStorageAdapter(new MemoryStorage());
      let resolveFirstSave: (result: SettingsSyncResult) => void = () => {};
      const firstSavePromise = new Promise<SettingsSyncResult>((resolve) => {
        resolveFirstSave = resolve;
      });
      const save = vi.fn((snapshot): Promise<SettingsSyncResult> => {
        const result = {
          status: 'saved-local',
          document: createCloudSettingsDocument(snapshot.preferences, snapshot.updatedAt, snapshot.baseDocument ?? null),
          syncedAt: '2026-06-05T02:00:00.000Z',
        } satisfies SettingsSyncResult;

        return save.mock.calls.length === 1 ? firstSavePromise : Promise.resolve(result);
      });
      const deps = syncDeps(storage, { save });
      const store = useSettingsStore();

      store.init(deps);
      store.setLanguage('zh', deps);
      await vi.advanceTimersByTimeAsync(10);

      expect(save).toHaveBeenCalledTimes(1);
      const manualSave = store.saveToCloud(deps);

      expect(save).toHaveBeenCalledTimes(1);
      resolveFirstSave({
        status: 'saved-local',
        document: createCloudSettingsDocument(
          {
            language: 'zh',
            themeMode: 'system',
            favoriteUserIds: [],
          },
          '2026-06-05T01:00:00.000Z',
        ),
        syncedAt: '2026-06-05T02:00:00.000Z',
      });
      await manualSave;

      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenLastCalledWith({
        preferences: {
          language: 'zh',
          themeMode: 'system',
          favoriteUserIds: [],
        },
        updatedAt: '2026-06-05T01:00:00.000Z',
        baseDocument: expect.objectContaining({
          preferences: {
            language: 'zh',
            themeMode: 'system',
            favoriteUserIds: [],
          },
          updatedAt: '2026-06-05T01:00:00.000Z',
        }),
      });
    } finally {
      vi.useRealTimers();
    }
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
