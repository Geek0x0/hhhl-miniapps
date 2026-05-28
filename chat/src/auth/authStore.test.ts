import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { EndpointCaller } from '@/api/endpointTypes';
import { useAuthStore, type AuthDependencies } from './authStore';

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

function createDeps(overrides: Partial<AuthDependencies> = {}): AuthDependencies {
  const storage = createLocalStorageAdapter(new MemoryStorage());
  const callEndpoint = vi.fn(async () => ({ id: 'user-1', username: 'alice', name: 'Alice' }));
  const api: EndpointCaller = {
    callEndpoint: callEndpoint as unknown as EndpointCaller['callEndpoint'],
  };

  return {
    storage,
    api,
    completeMiAuth: vi.fn(async () => 'dc-token'),
    openAuthUrl: vi.fn(),
    buildAuthUrl: vi.fn(() => 'https://dc.hhhl.cc/miauth/session-1'),
    createSession: vi.fn(() => 'session-1'),
    currentUrl: () => 'https://mini.example/',
    ...overrides,
  };
}

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows the login guide when no token is stored', async () => {
    const deps = createDeps();
    const store = useAuthStore();

    await store.restore(deps);

    expect(store.status).toBe('anonymous');
    expect(store.needsLogin).toBe(true);
    expect(deps.api.callEndpoint).not.toHaveBeenCalled();
  });

  it('validates a stored token and enters authorized state', async () => {
    const deps = createDeps();
    deps.storage.setToken('stored-token');
    const store = useAuthStore();

    await store.restore(deps);

    expect(store.status).toBe('authorized');
    expect(store.token).toBe('stored-token');
    expect(store.user).toEqual({ id: 'user-1', username: 'alice', name: 'Alice' });
    expect(deps.api.callEndpoint).toHaveBeenCalledWith('i', {});
  });

  it('clears invalid stored tokens and returns to login state', async () => {
    const deps = createDeps({
      api: {
        callEndpoint: vi.fn(async () => {
          throw new Error('invalid token');
        }),
      },
    });
    deps.storage.setToken('bad-token');
    const store = useAuthStore();

    await store.restore(deps);

    expect(store.status).toBe('token-invalid');
    expect(store.needsLogin).toBe(true);
    expect(store.token).toBeNull();
    expect(deps.storage.getToken()).toBeNull();
  });

  it('completes MiAuth callback, stores the token, and validates the user', async () => {
    const deps = createDeps();
    const store = useAuthStore();

    await store.completeCallback('session-1', deps);

    expect(deps.completeMiAuth).toHaveBeenCalledWith('session-1');
    expect(deps.storage.getToken()).toBe('dc-token');
    expect(store.status).toBe('authorized');
    expect(store.token).toBe('dc-token');
  });

  it('logout clears token, user, drafts, and recent room state', async () => {
    const deps = createDeps();
    deps.storage.setToken('stored-token');
    deps.storage.setJson('hhhl-chat:drafts', { 'room-1': 'draft' });
    deps.storage.setJson('hhhl-chat:recent-room', 'room-1');
    const store = useAuthStore();

    await store.restore(deps);
    store.logout(deps);

    expect(store.status).toBe('logout-complete');
    expect(store.token).toBeNull();
    expect(store.user).toBeNull();
    expect(deps.storage.getToken()).toBeNull();
    expect(deps.storage.getJson('hhhl-chat:drafts', null)).toBeNull();
    expect(deps.storage.getJson('hhhl-chat:recent-room', null)).toBeNull();
  });
});
