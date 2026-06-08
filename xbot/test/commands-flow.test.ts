import worker from '../src/index';
import { createKeys } from '../src/state/keys';
import { KvStateStore } from '../src/state/kvStore';
import type { BindingState, MessageMapState, RealtimeStatusState } from '../src/state/schemas';
import { createTestEnv } from './fakes';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

type BridgeFailure = 'start' | 'stop';

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function telegramUpdate(text: string): Record<string, unknown> {
  return {
    update_id: 1,
    message: {
      message_id: 10,
      text,
      from: { id: 42, is_bot: false, first_name: 'K' },
      chat: { id: 42, type: 'private' },
    },
  };
}

function createBridgeNamespace(options: { fail?: BridgeFailure; error?: Error } = {}): {
  namespace: DurableObjectNamespace;
  getByName: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} {
  const start = vi.fn(async () => {
    if (options.fail === 'start') throw options.error ?? new Error('start failed');
  });
  const stop = vi.fn(async () => {
    if (options.fail === 'stop') throw options.error ?? new Error('stop failed');
  });
  const stub = { start, stop };
  const getByName = vi.fn(() => stub);

  return {
    namespace: { getByName } as unknown as DurableObjectNamespace,
    getByName,
    start,
    stop,
  };
}

function createCommandFetch(options: {
  hhhl?: Record<string, unknown | Error>;
  telegram?: Response | Error;
} = {}): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
  hhhlEndpoints: string[];
  telegramCalls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const hhhlEndpoints: string[] = [];
  const telegramCalls: FetchCall[] = [];
  const hhhlResponses = options.hhhl ?? {};
  const telegram = options.telegram ?? jsonResponse({ ok: true, result: { message_id: 321 } });

  const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
    const url = input.toString();
    const call = { url, init };
    calls.push(call);

    if (url.startsWith('https://api.telegram.org/')) {
      telegramCalls.push(call);
      if (telegram instanceof Error) throw telegram;
      return telegram;
    }

    const endpoint = url.replace(/^https:\/\/hhhl\.example\/api\/?/, '');
    hhhlEndpoints.push(endpoint);
    const response = hhhlResponses[endpoint];
    if (response instanceof Error) throw response;
    if (response === undefined) throw new Error(`Unexpected HHHL endpoint ${endpoint}`);
    return jsonResponse(response);
  });

  return { fetchImpl, calls, hhhlEndpoints, telegramCalls };
}

function requestBody(call: FetchCall): Record<string, unknown> {
  expect(typeof call.init?.body).toBe('string');
  return JSON.parse(call.init?.body as string) as Record<string, unknown>;
}

function telegramTexts(calls: FetchCall[]): string[] {
  return calls.map((call) => String(requestBody(call).text));
}

function createCommandEnv(options: { bridge?: DurableObjectNamespace } = {}) {
  return createTestEnv({
    HHHL_API_BASE_URL: 'https://hhhl.example/api',
    BRIDGE: options.bridge ?? createBridgeNamespace().namespace,
  });
}

async function postUpdate(text: string, env: ReturnType<typeof createTestEnv>): Promise<Response> {
  return worker.fetch(
    new Request('https://xbot.example.com/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': env.BOT_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify(telegramUpdate(text)),
    }),
    env,
    {} as ExecutionContext,
  );
}

function storeFor(env: ReturnType<typeof createTestEnv>): KvStateStore {
  return new KvStateStore(env.XBOT_STATE, createKeys(env.KV_KEY_PREFIX ?? 'xbot'));
}

async function seedBinding(store: KvStateStore, overrides: Partial<BindingState> = {}): Promise<BindingState> {
  const binding: BindingState = {
    version: 1,
    telegramUserId: '42',
    roomId: 'room-1',
    roomName: 'Ops',
    boundAt: '2026-06-08T00:00:00.000Z',
    lastSeenMessageId: 'm1',
    ...overrides,
  };
  await store.setBinding(binding);
  return binding;
}

describe('command flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('binds a room after validating HHHL account membership and starts the per-user bridge', async () => {
    const bridge = createBridgeNamespace();
    const env = createCommandEnv({ bridge: bridge.namespace });
    const store = storeFor(env);
    const { fetchImpl, hhhlEndpoints, telegramCalls } = createCommandFetch({
      hhhl: {
        i: { user: { id: 'u1', username: 'ada' } },
        'chat/rooms/show': { room: { id: 'room-1', name: 'Ops Room' } },
        'chat/rooms/members': [{ user: { id: 'u1', username: 'ada' } }],
      },
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/bind room-1 手动显示名', env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(hhhlEndpoints).toEqual(['i', 'chat/rooms/show', 'chat/rooms/members']);
    expect(bridge.getByName).toHaveBeenCalledWith('telegram:42');
    expect(bridge.start).toHaveBeenCalledTimes(1);
    expect(telegramTexts(telegramCalls)[0]).toContain('已绑定');
    expect(telegramTexts(telegramCalls)[0]).toContain('手动显示名');

    await expect(store.getBinding('42')).resolves.toMatchObject({
      version: 1,
      telegramUserId: '42',
      roomId: 'room-1',
      roomName: '手动显示名',
      lastSeenMessageId: null,
    });
  });

  it('rejects bind when the Telegram user already has a binding', async () => {
    const bridge = createBridgeNamespace();
    const env = createCommandEnv({ bridge: bridge.namespace });
    const store = storeFor(env);
    await seedBinding(store);
    const { fetchImpl, hhhlEndpoints, telegramCalls } = createCommandFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/bind room-2 New', env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(hhhlEndpoints).toEqual([]);
    expect(bridge.start).not.toHaveBeenCalled();
    expect(telegramTexts(telegramCalls)[0]).toContain('已经绑定');
    await expect(store.getBinding('42')).resolves.toMatchObject({ roomId: 'room-1', roomName: 'Ops' });
  });

  it('uses the HHHL room name when bind has no display name', async () => {
    const bridge = createBridgeNamespace();
    const env = createCommandEnv({ bridge: bridge.namespace });
    const store = storeFor(env);
    const { fetchImpl, telegramCalls } = createCommandFetch({
      hhhl: {
        i: { user: { id: 'u1', username: 'ada' } },
        'chat/rooms/show': { room: { id: 'room-1', name: 'Ops Room' } },
        'chat/rooms/members': [{ user: { username: 'ada' } }],
      },
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/bind room-1', env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramTexts(telegramCalls)[0]).toContain('已绑定');
    expect(telegramTexts(telegramCalls)[0]).toContain('Ops Room');
    await expect(store.getBinding('42')).resolves.toMatchObject({
      roomId: 'room-1',
      roomName: 'Ops Room',
      lastSeenMessageId: null,
    });
  });

  it('replies to HHHL validation and membership failures while still acknowledging the webhook', async () => {
    const bridge = createBridgeNamespace();
    const env = createCommandEnv({ bridge: bridge.namespace });
    const store = storeFor(env);
    const { fetchImpl, hhhlEndpoints, telegramCalls } = createCommandFetch({
      hhhl: {
        i: { user: { id: 'u1', username: 'ada' } },
        'chat/rooms/show': { room: { id: 'room-1', name: 'Ops Room' } },
        'chat/rooms/members': [{ user: { id: 'u2', username: 'grace' } }],
      },
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/bind room-1', env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(hhhlEndpoints).toEqual(['i', 'chat/rooms/show', 'chat/rooms/members']);
    expect(bridge.start).not.toHaveBeenCalled();
    expect(telegramTexts(telegramCalls)[0]).toContain('绑定失败');
    expect(telegramTexts(telegramCalls)[0]).toContain('不在该聊天室');
    await expect(store.getBinding('42')).resolves.toBeNull();
  });

  it('replies to HHHL API validation failures without starting the bridge', async () => {
    const bridge = createBridgeNamespace();
    const env = createCommandEnv({ bridge: bridge.namespace });
    const store = storeFor(env);
    const { fetchImpl, telegramCalls } = createCommandFetch({
      hhhl: {
        i: { user: { id: 'u1', username: 'ada' } },
        'chat/rooms/show': new Error('room validation failed'),
      },
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/bind room-1', env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(bridge.start).not.toHaveBeenCalled();
    expect(telegramTexts(telegramCalls)[0]).toContain('绑定失败');
    expect(telegramTexts(telegramCalls)[0]).toContain('无法验证');
    await expect(store.getBinding('42')).resolves.toBeNull();
  });

  it('renames, lists, reports status, and unbinds while clearing message maps and stopping the bridge', async () => {
    const bridge = createBridgeNamespace();
    const env = createCommandEnv({ bridge: bridge.namespace });
    const store = storeFor(env);
    await seedBinding(store);
    const map: MessageMapState = {
      version: 1,
      roomId: 'room-1',
      hhhlMessageId: 'm1',
      telegramUserId: '42',
      telegramMessageId: 100,
      createdAt: '2026-06-08T00:00:01.000Z',
    };
    const status: RealtimeStatusState = {
      version: 1,
      state: 'connected',
      connectedAt: '2026-06-08T00:00:02.000Z',
      lastError: 'last websocket error',
      nextReconnectAt: null,
    };
    await store.putMessageMap(map);
    await store.setStatus('42', status);
    const { fetchImpl, telegramCalls } = createCommandFetch();
    vi.stubGlobal('fetch', fetchImpl);

    await expect((await postUpdate('/rename 新名字', env)).json()).resolves.toEqual({ ok: true });
    await expect(store.getBinding('42')).resolves.toMatchObject({ roomName: '新名字', lastSeenMessageId: 'm1' });
    expect(telegramTexts(telegramCalls).at(-1)).toContain('已重命名');

    await expect((await postUpdate('/list', env)).json()).resolves.toEqual({ ok: true });
    expect(telegramTexts(telegramCalls).at(-1)).toContain('显示名：新名字');
    expect(telegramTexts(telegramCalls).at(-1)).toContain('房间 ID：room-1');
    expect(telegramTexts(telegramCalls).at(-1)).toContain('lastSeen：m1');

    await expect((await postUpdate('/status', env)).json()).resolves.toEqual({ ok: true });
    expect(telegramTexts(telegramCalls).at(-1)).toContain('state：connected');
    expect(telegramTexts(telegramCalls).at(-1)).toContain('last websocket error');

    await expect((await postUpdate('/unbind', env)).json()).resolves.toEqual({ ok: true });
    expect(bridge.stop).toHaveBeenCalledTimes(1);
    expect(telegramTexts(telegramCalls).at(-1)).toContain('已解绑');
    await expect(store.getBinding('42')).resolves.toBeNull();
    await expect(store.getMessageMapByTelegram('42', 100)).resolves.toBeNull();
    await expect(store.getMessageMapByHhhl('room-1', 'm1')).resolves.toBeNull();
  });

  it('reports stopped status with no error when realtime status is missing', async () => {
    const env = createCommandEnv();
    const { fetchImpl, telegramCalls } = createCommandFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/status', env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramTexts(telegramCalls)[0]).toContain('state：stopped');
    expect(telegramTexts(telegramCalls)[0]).toContain('lastError：无');
  });

  it.each([
    ['start', '/bind room-1', '绑定失败'] as const,
    ['stop', '/unbind', '解绑失败'] as const,
  ])('acks and sends a Chinese failure reply when bridge %s fails', async (failure, command, expectedText) => {
    const bridge = createBridgeNamespace({
      fail: failure,
      error: new Error(`bridge ${failure} failed for 123456:telegram-secret hhhl-secret telegram-webhook-secret`),
    });
    const env = createCommandEnv({ bridge: bridge.namespace });
    const store = storeFor(env);
    if (failure === 'stop') await seedBinding(store);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fetchImpl, telegramCalls } = createCommandFetch({
      hhhl: {
        i: { user: { id: 'u1', username: 'ada' } },
        'chat/rooms/show': { room: { id: 'room-1', name: 'Ops Room' } },
        'chat/rooms/members': [{ user: { id: 'u1', username: 'ada' } }],
      },
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate(command, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramTexts(telegramCalls)[0]).toContain(expectedText);
    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('command failed');
    expect(logged).not.toContain('123456:telegram-secret');
    expect(logged).not.toContain('hhhl-secret');
    expect(logged).not.toContain('telegram-webhook-secret');
  });

  it('acks and logs redacted details when Telegram send fails during command handling', async () => {
    const env = createCommandEnv();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fetchImpl } = createCommandFetch({
      telegram: new Error('send failed with 123456:telegram-secret hhhl-secret telegram-webhook-secret https://hhhl.example/api'),
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/status', env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('telegram send failed');
    expect(logged).not.toContain('123456:telegram-secret');
    expect(logged).not.toContain('hhhl-secret');
    expect(logged).not.toContain('telegram-webhook-secret');
    expect(logged).not.toContain('https://hhhl.example/api');
  });
});
