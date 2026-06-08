import { readConfig } from '../src/config';
import { redactSensitiveText } from '../src/security/redact';
import type { Env } from '../src/env';

const baseEnv: Env = {
  BOT_TOKEN: '123456:telegram-secret',
  HHHL_TOKEN: 'hhhl-secret',
  ALLOWED_TELEGRAM_USER_ID: '42',
  XBOT_STATE: {} as KVNamespace,
  BRIDGE: {} as DurableObjectNamespace,
};

describe('readConfig', () => {
  it('reads required secrets and default non-sensitive values', () => {
    const config = readConfig(baseEnv);

    expect(config.ok).toBe(true);
    if (!config.ok) throw new Error('expected config');

    expect(config.value).toMatchObject({
      botToken: '123456:telegram-secret',
      hhhlToken: 'hhhl-secret',
      allowedTelegramUserId: '42',
      hhhlOrigin: 'https://dc.hhhl.cc',
      hhhlApiBaseUrl: 'https://dc.hhhl.cc/api',
      initialHistoryLimit: 30,
      reconnectBaseDelayMs: 1000,
      reconnectMaxDelayMs: 60000,
      kvKeyPrefix: 'xbot',
    });
  });

  it('reports all missing required secrets', () => {
    const config = readConfig({
      XBOT_STATE: {} as KVNamespace,
      BRIDGE: {} as DurableObjectNamespace,
    });

    expect(config).toEqual({
      ok: false,
      error: 'missing BOT_TOKEN, HHHL_TOKEN, ALLOWED_TELEGRAM_USER_ID',
    });
  });

  it('rejects invalid numeric config', () => {
    const config = readConfig({ ...baseEnv, INITIAL_HISTORY_LIMIT: '0' });

    expect(config).toEqual({
      ok: false,
      error: 'INITIAL_HISTORY_LIMIT must be a positive integer',
    });
  });
});

describe('redactSensitiveText', () => {
  it('redacts configured token values and token-like fields', () => {
    const text = 'BOT_TOKEN=123456:telegram-secret HHHL_TOKEN=hhhl-secret i=hhhl-secret token=other';

    expect(redactSensitiveText(text, ['123456:telegram-secret', 'hhhl-secret'])).toBe(
      'BOT_TOKEN=[redacted] HHHL_TOKEN=[redacted] i=[redacted] token=[redacted]',
    );
  });
});
