import { readConfig } from '../src/config';
import { redactSensitiveText } from '../src/security/redact';
import type { Env } from '../src/env';
import { createTestEnv } from './fakes';

const baseEnv: Env = createTestEnv({
  BOT_TOKEN: '123456:telegram-secret',
  BOT_WEBHOOK_SECRET: 'telegram-webhook-secret',
  HHHL_TOKEN: 'hhhl-secret',
  ALLOWED_TELEGRAM_USER_ID: '42',
});

describe('readConfig', () => {
  it('reads required secrets and default non-sensitive values', () => {
    const config = readConfig(baseEnv);

    expect(config.ok).toBe(true);
    if (!config.ok) throw new Error('expected config');

    expect(config.value).toMatchObject({
      botToken: '123456:telegram-secret',
      botWebhookSecret: 'telegram-webhook-secret',
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
      error: 'missing BOT_TOKEN, BOT_WEBHOOK_SECRET, HHHL_TOKEN, ALLOWED_TELEGRAM_USER_ID',
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
    const text =
      'BOT_TOKEN=123456:telegram-secret BOT_WEBHOOK_SECRET=telegram-webhook-secret HHHL_TOKEN=hhhl-secret i=hhhl-secret token=other secret=plain';

    expect(redactSensitiveText(text, ['123456:telegram-secret', 'telegram-webhook-secret', 'hhhl-secret'])).toBe(
      'BOT_TOKEN=[redacted] BOT_WEBHOOK_SECRET=[redacted] HHHL_TOKEN=[redacted] i=[redacted] token=[redacted] secret=[redacted]',
    );
  });

  it('redacts JSON token and i fields while preserving field formatting', () => {
    const text = '{"i":"hhhl-secret","token": "other"}';

    expect(redactSensitiveText(text)).toBe('{"i":"[redacted]","token": "[redacted]"}');
  });

  it('redacts token-like query parameters without consuming neighboring parameters', () => {
    const text = 'https://example.test/callback?i=hhhl-secret&token=other&keep=value';

    expect(redactSensitiveText(text)).toBe(
      'https://example.test/callback?i=[redacted]&token=[redacted]&keep=value',
    );
  });

  it('leaves already-redacted output unchanged on later passes', () => {
    const text = 'BOT_TOKEN=123456:telegram-secret {"token":"other"} ?i=hhhl-secret';
    const secrets = ['123456:telegram-secret', 'hhhl-secret'];
    const once = redactSensitiveText(text, secrets);

    expect(redactSensitiveText(once, secrets)).toBe(once);
  });

  it('redacts Telegram file URLs and paths through configured secrets', () => {
    const text =
      'https://api.telegram.org/file/bot123456:telegram-secret/photos/file_0.jpg file/bot123456:telegram-secret/documents/file_1.pdf';

    expect(redactSensitiveText(text, ['123456:telegram-secret'])).toBe(
      'https://api.telegram.org/file/bot[redacted]/photos/file_0.jpg file/bot[redacted]/documents/file_1.pdf',
    );
  });

  it('redacts configured secrets that contain regex-special characters', () => {
    const secret = 'a.b*c+?^${}()|[]\\secret';

    expect(redactSensitiveText(`value=${secret}`, [secret])).toBe('value=[redacted]');
  });

  it('redacts prefix secrets longest-first', () => {
    expect(redactSensitiveText('secret=abcdef', ['abc', 'abcdef'])).toBe('secret=[redacted]');
  });
});
