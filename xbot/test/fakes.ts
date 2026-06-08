import type { Env } from '../src/env';

export interface FakeKV extends KVNamespace {
  listCalls: Array<{ prefix?: string; cursor?: string }>;
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    BOT_TOKEN: '123456:telegram-secret',
    BOT_WEBHOOK_SECRET: 'telegram-webhook-secret',
    HHHL_TOKEN: 'hhhl-secret',
    ALLOWED_TELEGRAM_USER_ID: '42',
    XBOT_STATE: createFakeKV(),
    BRIDGE: {} as DurableObjectNamespace,
    ...overrides,
  };
}

export function createFakeKV(options: { pageSize?: number } = {}): FakeKV {
  const values = new Map<string, string>();
  const listCalls: Array<{ prefix?: string; cursor?: string }> = [];
  const pageSize = Math.max(1, options.pageSize ?? Number.POSITIVE_INFINITY);

  const fake = {
    listCalls,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    list: vi.fn(async (listOptions?: { prefix?: string; cursor?: string }) => {
      listCalls.push({ prefix: listOptions?.prefix, cursor: listOptions?.cursor });

      const start = listOptions?.cursor == null ? 0 : Number(listOptions.cursor);
      const matchingKeys = [...values.keys()]
        .filter((name) => listOptions?.prefix == null || name.startsWith(listOptions.prefix))
        .sort();
      const end = Math.min(start + pageSize, matchingKeys.length);
      const keys = matchingKeys.slice(start, end).map((name) => ({ name }));
      const listComplete = end >= matchingKeys.length;

      return {
        keys,
        list_complete: listComplete,
        cursor: listComplete ? undefined : String(end),
        cacheStatus: null,
      };
    }),
    getWithMetadata: vi.fn(),
  };

  return fake as unknown as FakeKV;
}
