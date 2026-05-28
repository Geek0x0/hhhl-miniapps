export interface StoredAuthState {
  token: string;
  savedAt: string;
}

export interface LocalStorageAdapter {
  getToken: () => string | null;
  setToken: (token: string) => void;
  clearAuth: () => void;
  getJson: <T>(key: string, fallback: T) => T;
  setJson: <T>(key: string, value: T) => void;
  remove: (key: string) => void;
}

const AUTH_KEY = 'hhhl-chat:auth';

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (value == null) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createLocalStorageAdapter(storage: Storage | undefined = window.localStorage): LocalStorageAdapter {
  const memory = new Map<string, string>();

  function getRaw(key: string): string | null {
    try {
      return storage?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  }

  function setRaw(key: string, value: string): void {
    memory.set(key, value);
    try {
      storage?.setItem(key, value);
    } catch {
      // In-memory fallback keeps the current session usable when persistent storage is blocked.
    }
  }

  function removeRaw(key: string): void {
    memory.delete(key);
    try {
      storage?.removeItem(key);
    } catch {
      // Ignore storage failures; memory state has already been cleared.
    }
  }

  return {
    getToken: () => {
      const auth = safeJsonParse<StoredAuthState | null>(getRaw(AUTH_KEY), null);
      return auth?.token ?? null;
    },
    setToken: (token) => setRaw(AUTH_KEY, JSON.stringify({ token, savedAt: new Date().toISOString() })),
    clearAuth: () => removeRaw(AUTH_KEY),
    getJson: (key, fallback) => safeJsonParse(getRaw(key), fallback),
    setJson: (key, value) => setRaw(key, JSON.stringify(value)),
    remove: (key) => removeRaw(key),
  };
}
