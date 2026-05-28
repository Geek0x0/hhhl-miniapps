import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createLocalStorageAdapter } from '@/shared/storage';
import { useAuthStore, type AuthDependencies } from '@/auth/authStore';
import { useSettingsStore, SETTINGS_LANGUAGE_KEY } from './settingsStore';

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

describe('settingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('stores language preference and keeps debug panel closed by default', () => {
    const storage = createLocalStorageAdapter(new MemoryStorage());
    const store = useSettingsStore();

    store.init(storage);
    expect(store.debugOpen).toBe(false);

    store.setLanguage('zh', storage);

    expect(store.language).toBe('zh');
    expect(storage.getJson(SETTINGS_LANGUAGE_KEY, null)).toBe('zh');
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
    store.clearLocalData(storage);

    expect(storage.getJson('hhhl-chat:drafts', null)).toBeNull();
    expect(storage.getJson('hhhl-chat:recent-room', null)).toBeNull();
    expect(store.lastAction).toBe('settings.clearLocalDataDone');
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
