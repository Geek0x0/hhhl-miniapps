export const TELEGRAM_ENVIRONMENT_SEEN_KEY = 'hhhl-chat:telegram-environment-seen-at';
export const TELEGRAM_ENVIRONMENT_SEEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface TelegramEnvironmentMemoryOptions {
  now?: () => number;
  ttlMs?: number;
  storages?: Array<Storage | undefined>;
}

function getTelegramEnvironmentMemoryStorages(options: TelegramEnvironmentMemoryOptions = {}): Array<Storage | undefined> {
  if (options.storages != null) {
    return options.storages;
  }

  try {
    return [window.sessionStorage, window.localStorage];
  } catch {
    return [];
  }
}

export function rememberTelegramEnvironment(options: TelegramEnvironmentMemoryOptions = {}): void {
  const seenAt = String(options.now?.() ?? Date.now());

  for (const storage of getTelegramEnvironmentMemoryStorages(options)) {
    try {
      storage?.setItem(TELEGRAM_ENVIRONMENT_SEEN_KEY, seenAt);
    } catch {
      // Storage can be blocked in embedded iOS webviews; the live Telegram probe still works.
    }
  }
}

export function hasRecentTelegramEnvironment(options: TelegramEnvironmentMemoryOptions = {}): boolean {
  const now = options.now?.() ?? Date.now();
  const ttlMs = options.ttlMs ?? TELEGRAM_ENVIRONMENT_SEEN_TTL_MS;

  for (const storage of getTelegramEnvironmentMemoryStorages(options)) {
    try {
      const rawSeenAt = storage?.getItem(TELEGRAM_ENVIRONMENT_SEEN_KEY);
      const seenAt = rawSeenAt == null ? Number.NaN : Number(rawSeenAt);
      if (Number.isFinite(seenAt) && seenAt <= now && now - seenAt <= ttlMs) {
        return true;
      }
    } catch {
      // Ignore blocked storage and continue with the remaining candidates.
    }
  }

  return false;
}

export function resolveTelegramGateEnvironment(
  isTelegram: boolean,
  options: TelegramEnvironmentMemoryOptions = {},
): boolean {
  if (isTelegram) {
    rememberTelegramEnvironment(options);
    return true;
  }

  return hasRecentTelegramEnvironment(options);
}

export function shouldBypassTelegramGate(mode: string = import.meta.env.MODE): boolean {
  return mode === 'development';
}

export function isAuthCallbackRoute(path: string = window.location.pathname): boolean {
  return path === '/auth/callback';
}

export function shouldRenderMiniApp(isTelegram: boolean, mode: string = import.meta.env.MODE, path: string = window.location.pathname): boolean {
  return isTelegram || shouldBypassTelegramGate(mode) || isAuthCallbackRoute(path);
}
