import { safeJsonParse, type StoredAuthState } from '@/shared/storage';
import { getTelegramWebApp, type TelegramCloudStorage, type TelegramWebApp } from '@/telegram/telegram';

export interface CloudAuthStorage {
  getToken: () => Promise<string | null>;
  setToken: (token: string) => Promise<void>;
  clearToken: () => Promise<void>;
}

const CLOUD_AUTH_KEY = 'hhhl_chat_auth';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function callCloudStorage<T>(operation: (callback: (error: string | null, value: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      operation((error, value) => {
        if (error != null && error !== '') {
          reject(new Error(error));
          return;
        }

        resolve(value);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function parseToken(value: string | null): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const stored = safeJsonParse<StoredAuthState | null>(value, null);
  if (isNonEmptyString(stored?.token)) {
    return stored.token;
  }

  return value.startsWith('{') ? null : value;
}

function createStoredValue(token: string): string {
  return JSON.stringify({ token, savedAt: new Date().toISOString() } satisfies StoredAuthState);
}

export function createTelegramCloudAuthStorage(webApp: TelegramWebApp | undefined = getTelegramWebApp()): CloudAuthStorage | null {
  const cloudStorage = webApp?.CloudStorage;
  if (cloudStorage == null) {
    return null;
  }

  return createCloudAuthStorageAdapter(cloudStorage);
}

export function createCloudAuthStorageAdapter(cloudStorage: TelegramCloudStorage): CloudAuthStorage {
  return {
    async getToken() {
      const value = await callCloudStorage<string | null>((callback) => cloudStorage.getItem(CLOUD_AUTH_KEY, callback));
      return parseToken(value);
    },
    async setToken(token) {
      await callCloudStorage<boolean>((callback) => cloudStorage.setItem(CLOUD_AUTH_KEY, createStoredValue(token), callback));
    },
    async clearToken() {
      await callCloudStorage<boolean>((callback) => cloudStorage.removeItem(CLOUD_AUTH_KEY, callback));
    },
  };
}
