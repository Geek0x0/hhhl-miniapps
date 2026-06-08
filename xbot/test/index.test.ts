import worker from '../src/index';
import type { Env } from '../src/env';

const baseEnv: Env = {
  BOT_TOKEN: '123456:telegram-secret',
  HHHL_TOKEN: 'hhhl-secret',
  ALLOWED_TELEGRAM_USER_ID: '42',
  XBOT_STATE: {} as KVNamespace,
  BRIDGE: {} as DurableObjectNamespace,
};

describe('xbot worker', () => {
  it('returns health status', async () => {
    const response = await worker.fetch(new Request('https://xbot.example.com/health'), baseEnv, {} as ExecutionContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: 'xbot' });
  });
});
