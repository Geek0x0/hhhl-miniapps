import { describe, expect, it, vi } from 'vitest';
import type { TelegramCloudStorage, TelegramWebApp } from '@/telegram/telegram';
import { createCloudAuthStorageAdapter, createTelegramCloudAuthStorage } from './cloudAuthStorage';

function createCloudStorage(initialValues: Record<string, string> = {}): TelegramCloudStorage & { values: Record<string, string> } {
  const values = { ...initialValues };
  const cloudStorage: TelegramCloudStorage & { values: Record<string, string> } = {
    values,
    getItem: vi.fn((key, callback) => {
      callback(null, values[key] ?? null);
      return cloudStorage;
    }),
    setItem: vi.fn((key, value, callback) => {
      values[key] = value;
      callback?.(null, true);
      return cloudStorage;
    }),
    removeItem: vi.fn((key, callback) => {
      delete values[key];
      callback?.(null, true);
      return cloudStorage;
    }),
  };

  return cloudStorage;
}

function createWebApp(cloudStorage?: TelegramCloudStorage): TelegramWebApp {
  return {
    initData: 'init-data',
    initDataUnsafe: {},
    platform: 'tdesktop',
    themeParams: {},
    CloudStorage: cloudStorage,
  };
}

describe('cloudAuthStorage', () => {
  it('returns null when Telegram CloudStorage is unavailable', () => {
    expect(createTelegramCloudAuthStorage(createWebApp())).toBeNull();
  });

  it('reads HHHL auth token from Telegram CloudStorage JSON', async () => {
    const cloudStorage = createCloudStorage({
      hhhl_chat_auth: JSON.stringify({ token: 'cloud-token', savedAt: '2026-06-08T00:00:00.000Z' }),
    });
    const authStorage = createCloudAuthStorageAdapter(cloudStorage);

    await expect(authStorage.getToken()).resolves.toBe('cloud-token');
    expect(cloudStorage.getItem).toHaveBeenCalledWith('hhhl_chat_auth', expect.any(Function));
  });

  it('writes and clears HHHL auth token in Telegram CloudStorage', async () => {
    const cloudStorage = createCloudStorage();
    const authStorage = createCloudAuthStorageAdapter(cloudStorage);

    await authStorage.setToken('next-token');
    expect(JSON.parse(cloudStorage.values.hhhl_chat_auth)).toMatchObject({
      token: 'next-token',
    });

    await authStorage.clearToken();
    expect(cloudStorage.values.hhhl_chat_auth).toBeUndefined();
  });

  it('rejects when Telegram CloudStorage reports an error', async () => {
    const cloudStorage = createCloudStorage();
    vi.mocked(cloudStorage.getItem).mockImplementationOnce((key, callback) => {
      callback(`failed to read ${key}`, null);
      return cloudStorage;
    });
    const authStorage = createCloudAuthStorageAdapter(cloudStorage);

    await expect(authStorage.getToken()).rejects.toThrow('failed to read hhhl_chat_auth');
  });
});
