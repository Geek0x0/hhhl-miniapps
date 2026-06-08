export interface Env {
  BOT_TOKEN?: string;
  BOT_WEBHOOK_SECRET?: string;
  HHHL_TOKEN?: string;
  ALLOWED_TELEGRAM_USER_ID?: string;
  HHHL_ORIGIN?: string;
  HHHL_API_BASE_URL?: string;
  INITIAL_HISTORY_LIMIT?: string;
  RECONNECT_BASE_DELAY_MS?: string;
  RECONNECT_MAX_DELAY_MS?: string;
  KV_KEY_PREFIX?: string;
  XBOT_STATE: KVNamespace;
  BRIDGE: DurableObjectNamespace;
}

export interface AppConfig {
  botToken: string;
  botWebhookSecret: string;
  hhhlToken: string;
  allowedTelegramUserId: string;
  hhhlOrigin: string;
  hhhlApiBaseUrl: string;
  initialHistoryLimit: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  kvKeyPrefix: string;
}

export type ConfigResult = { ok: true; value: AppConfig } | { ok: false; error: string };
