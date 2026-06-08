import type { AppConfig, ConfigResult, Env } from './env';

const DEFAULT_HHHL_ORIGIN = 'https://dc.hhhl.cc';

function nonEmpty(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function positiveInteger(name: string, value: string | undefined, fallback: number): number | { error: string } {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${name} must be a positive integer` };
  }

  return parsed;
}

export function readConfig(env: Env): ConfigResult {
  const missing: string[] = [];
  const botToken = nonEmpty(env.BOT_TOKEN);
  const botWebhookSecret = nonEmpty(env.BOT_WEBHOOK_SECRET);
  const hhhlToken = nonEmpty(env.HHHL_TOKEN);
  const allowedTelegramUserId = nonEmpty(env.ALLOWED_TELEGRAM_USER_ID);

  if (botToken == null) missing.push('BOT_TOKEN');
  if (botWebhookSecret == null) missing.push('BOT_WEBHOOK_SECRET');
  if (hhhlToken == null) missing.push('HHHL_TOKEN');
  if (allowedTelegramUserId == null) missing.push('ALLOWED_TELEGRAM_USER_ID');

  if (missing.length > 0) {
    return { ok: false, error: `missing ${missing.join(', ')}` };
  }

  const initialHistoryLimit = positiveInteger('INITIAL_HISTORY_LIMIT', env.INITIAL_HISTORY_LIMIT, 30);
  if (typeof initialHistoryLimit !== 'number') return { ok: false, error: initialHistoryLimit.error };

  const reconnectBaseDelayMs = positiveInteger('RECONNECT_BASE_DELAY_MS', env.RECONNECT_BASE_DELAY_MS, 1000);
  if (typeof reconnectBaseDelayMs !== 'number') return { ok: false, error: reconnectBaseDelayMs.error };

  const reconnectMaxDelayMs = positiveInteger('RECONNECT_MAX_DELAY_MS', env.RECONNECT_MAX_DELAY_MS, 60000);
  if (typeof reconnectMaxDelayMs !== 'number') return { ok: false, error: reconnectMaxDelayMs.error };

  const hhhlOrigin = nonEmpty(env.HHHL_ORIGIN) ?? DEFAULT_HHHL_ORIGIN;
  const hhhlApiBaseUrl = nonEmpty(env.HHHL_API_BASE_URL) ?? `${hhhlOrigin.replace(/\/$/, '')}/api`;
  const kvKeyPrefix = nonEmpty(env.KV_KEY_PREFIX) ?? 'xbot';

  const value: AppConfig = {
    botToken: botToken as string,
    botWebhookSecret: botWebhookSecret as string,
    hhhlToken: hhhlToken as string,
    allowedTelegramUserId: allowedTelegramUserId as string,
    hhhlOrigin,
    hhhlApiBaseUrl,
    initialHistoryLimit,
    reconnectBaseDelayMs,
    reconnectMaxDelayMs,
    kvKeyPrefix,
  };

  return { ok: true, value };
}
