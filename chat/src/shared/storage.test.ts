import { describe, expect, it } from 'vitest';
import { createLocalStorageAdapter, safeJsonParse } from './storage';

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

describe('safeJsonParse', () => {
  it('returns parsed JSON for valid input', () => {
    expect(safeJsonParse<{ ok: boolean }>('{"ok":true}', { ok: false })).toEqual({ ok: true });
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('{bad json', { ok: false })).toEqual({ ok: false });
  });
});

describe('createLocalStorageAdapter', () => {
  it('saves, loads, and clears tokens', () => {
    const adapter = createLocalStorageAdapter(new MemoryStorage());

    adapter.setToken('secret-token');
    expect(adapter.getToken()).toBe('secret-token');

    adapter.clearAuth();
    expect(adapter.getToken()).toBeNull();
  });

  it('returns null when stored auth JSON is invalid', () => {
    const storage = new MemoryStorage();
    const adapter = createLocalStorageAdapter(storage);

    storage.setItem('hhhl-chat:auth', '{bad json');

    expect(adapter.getToken()).toBeNull();
  });

  it('falls back to memory when storage throws', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage;
    const adapter = createLocalStorageAdapter(throwingStorage);

    adapter.setToken('fallback-token');

    expect(adapter.getToken()).toBe('fallback-token');
  });
});
