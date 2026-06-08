import {
  BridgeRuntime,
  type BridgeRuntimeChatApi,
  type BridgeRuntimeOutbound,
  type BridgeRuntimeScheduleReconnect,
} from '../src/realtime/bridgeRuntime';
import { DurableObject } from 'cloudflare:workers';
import { BridgeObject as DirectBridgeObject } from '../src/realtime/BridgeObject';
import { BridgeObject as ExportedBridgeObject } from '../src/index';
import type { HhhlChatMessage, PaginationParams } from '../src/hhhl/types';
import { createKeys } from '../src/state/keys';
import { KvStateStore } from '../src/state/kvStore';
import type { BindingState } from '../src/state/schemas';
import { createFakeKV, createTestEnv } from './fakes';

type SocketListener = (event: unknown) => unknown;
type RuntimeMock<T extends (...args: any[]) => any> = T & { mock: { calls: Array<Parameters<T>> } };
type RoomTimelineMock = RuntimeMock<BridgeRuntimeChatApi['roomTimeline']>;
type OutboundMock = RuntimeMock<BridgeRuntimeOutbound>;
type ScheduleReconnectMock = RuntimeMock<BridgeRuntimeScheduleReconnect>;

class FakeSocket {
  static instances: FakeSocket[] = [];

  readonly listeners = new Map<string, SocketListener[]>();
  readonly sent: string[] = [];
  closeCalls = 0;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, listener: SocketListener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  async open(): Promise<void> {
    await this.emit('open', {});
  }

  async message(data: unknown): Promise<void> {
    await this.emit('message', { data: typeof data === 'string' ? data : JSON.stringify(data) });
  }

  async fail(): Promise<void> {
    await this.emit('close', { code: 1006 });
  }

  close(): void {
    this.closeCalls += 1;
    void this.emit('close', { code: 1000 });
  }

  private async emit(type: string, event: unknown): Promise<void> {
    for (const listener of this.listeners.get(type) ?? []) {
      await listener(event);
    }
  }
}

function message(overrides: Partial<HhhlChatMessage>): HhhlChatMessage {
  return {
    id: 'msg-1',
    roomId: 'room-1',
    createdAt: '2026-06-08T00:00:00.000Z',
    text: null,
    user: { id: 'u1', username: 'ada' },
    file: null,
    reactions: [],
    replyId: null,
    reply: null,
    quoteId: null,
    quote: null,
    ...overrides,
  };
}

function realtimeMessageEnvelope(roomId: string, body: Partial<HhhlChatMessage>): Record<string, unknown> {
  return {
    type: 'ch',
    body: {
      id: `test-main:${roomId}`,
      type: 'message',
      body: {
        roomId,
        message: message({ roomId, ...body }),
      },
    },
  };
}

function createStore(): KvStateStore {
  return new KvStateStore(createFakeKV(), createKeys('xbot'));
}

async function seedBinding(store: KvStateStore, overrides: Partial<BindingState> = {}): Promise<void> {
  await store.setBinding({
    version: 1,
    telegramUserId: '42',
    roomId: 'room-1',
    roomName: 'Ops',
    boundAt: '2026-06-08T00:00:00.000Z',
    lastSeenMessageId: null,
    ...overrides,
  });
}

function createRuntime(
  options: {
    store?: KvStateStore;
    roomTimeline?: RoomTimelineMock;
    outbound?: OutboundMock;
    scheduleReconnect?: ScheduleReconnectMock;
    initialHistoryLimit?: number;
  } = {},
): {
  runtime: BridgeRuntime;
  store: KvStateStore;
  roomTimeline: RoomTimelineMock;
  outbound: OutboundMock;
  timers: Array<{ callback: () => void; delayMs: number }>;
} {
  const store = options.store ?? createStore();
  const roomTimeline =
    options.roomTimeline ??
    (vi.fn(async (_roomId: string, _params?: PaginationParams): Promise<HhhlChatMessage[]> => []) as unknown as RoomTimelineMock);
  const outbound = options.outbound ?? (vi.fn(async (_message: HhhlChatMessage) => undefined) as unknown as OutboundMock);
  const timers: Array<{ callback: () => void; delayMs: number }> = [];

  return {
    runtime: new BridgeRuntime({
      telegramUserId: '42',
      chatId: '42',
      hhhlOrigin: 'https://hhhl.example',
      hhhlToken: 'hhhl-token',
      hhhlBotUserId: 'bot-user',
      state: store,
      chatApi: { roomTimeline },
      outbound,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      setTimeoutImpl: (callback, delayMs) => {
        timers.push({ callback, delayMs });
        return timers.length;
      },
      scheduleReconnect: options.scheduleReconnect,
      now: () => new Date('2026-06-08T00:00:00.000Z'),
      reconnectBaseDelayMs: 2500,
      reconnectMaxDelayMs: 10000,
      initialHistoryLimit: options.initialHistoryLimit ?? 2,
    }),
    store,
    roomTimeline,
    outbound,
    timers,
  };
}

function sentJson(socket: FakeSocket): unknown[] {
  return socket.sent.map((item) => JSON.parse(item) as unknown);
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
}

function createFakeDurableObjectState(): {
  state: DurableObjectState;
  storage: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    setAlarm: ReturnType<typeof vi.fn>;
    deleteAlarm: ReturnType<typeof vi.fn>;
  };
} {
  const values = new Map<string, unknown>();
  const storage = {
    get: vi.fn(async (key: string) => values.get(key)),
    put: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    setAlarm: vi.fn(async (_scheduledTime: number) => undefined),
    deleteAlarm: vi.fn(async () => undefined),
  };

  return { state: { storage } as unknown as DurableObjectState, storage };
}

describe('BridgeRuntime', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects, subscribes, backfills in creation order, and forwards realtime messages', async () => {
    const store = createStore();
    await seedBinding(store);
    const roomTimeline = vi.fn(async (_roomId: string, _params?: PaginationParams): Promise<HhhlChatMessage[]> => [
      message({ id: 'msg-newer', createdAt: '2026-06-08T00:00:03.000Z', text: 'newer' }),
      message({ id: 'msg-older', createdAt: '2026-06-08T00:00:01.000Z', text: 'older' }),
    ]) as unknown as RoomTimelineMock;
    const { runtime, outbound } = createRuntime({ store, roomTimeline });

    await runtime.start();
    const socket = FakeSocket.instances[0];

    expect(socket.url).toBe('wss://hhhl.example/streaming?i=hhhl-token');
    await expect(store.getStatus('42')).resolves.toMatchObject({ state: 'connecting' });

    await socket.open();

    expect(sentJson(socket)).toEqual([
      { type: 'connect', body: { channel: 'main', id: 'test-main', params: {}, pong: true } },
      { type: 'ch', body: { id: 'test-main:room-1', type: 'connect', body: { roomId: 'room-1' } } },
    ]);
    expect(roomTimeline).toHaveBeenCalledWith('room-1', { limit: 2 });
    expect(outbound.mock.calls.map(([forwarded]) => forwarded.id)).toEqual(['msg-older', 'msg-newer']);
    await expect(store.getStatus('42')).resolves.toMatchObject({
      state: 'connected',
      connectedAt: '2026-06-08T00:00:00.000Z',
      lastError: null,
      nextReconnectAt: null,
    });

    await socket.message('{bad json');
    await socket.message({ type: 'connect', body: {} });
    await socket.message(realtimeMessageEnvelope('room-2', { id: 'ignored', text: 'ignore me' }));
    expect(outbound).toHaveBeenCalledTimes(2);

    await socket.message(realtimeMessageEnvelope('room-1', { id: 'msg-live', text: 'live' }));

    expect(outbound.mock.calls.map(([forwarded]) => forwarded.id)).toEqual(['msg-older', 'msg-newer', 'msg-live']);
  });

  it('backfills using sinceId when the binding has a last seen message id', async () => {
    const store = createStore();
    await seedBinding(store, { lastSeenMessageId: 'msg-last' });
    const roomTimeline = vi.fn(async (_roomId: string, _params?: PaginationParams): Promise<HhhlChatMessage[]> => []) as unknown as RoomTimelineMock;
    const { runtime } = createRuntime({ store, roomTimeline, initialHistoryLimit: 7 });

    await runtime.start();
    await FakeSocket.instances[0].open();

    expect(roomTimeline).toHaveBeenCalledWith('room-1', { sinceId: 'msg-last', limit: 7 });
  });

  it('queues live messages until backfill finishes and skips duplicates', async () => {
    const store = createStore();
    await seedBinding(store);
    let resolveTimeline!: (messages: HhhlChatMessage[]) => void;
    let roomTimelineStarted!: () => void;
    const startedTimeline = new Promise<void>((resolve) => {
      roomTimelineStarted = resolve;
    });
    const roomTimeline = vi.fn(async (_roomId: string, _params?: PaginationParams): Promise<HhhlChatMessage[]> => {
      roomTimelineStarted();
      return new Promise((resolve) => {
        resolveTimeline = resolve;
      });
    }) as unknown as RoomTimelineMock;
    const { runtime, outbound } = createRuntime({ store, roomTimeline });

    await runtime.start();
    const socket = FakeSocket.instances[0];
    const openPromise = socket.open();
    await startedTimeline;

    const livePromise = socket.message(realtimeMessageEnvelope('room-1', { id: 'msg-live', text: 'live' }));
    await Promise.resolve();
    expect(outbound).not.toHaveBeenCalled();

    resolveTimeline([
      message({ id: 'msg-live', createdAt: '2026-06-08T00:00:02.000Z', text: 'live from backfill' }),
      message({ id: 'msg-old', createdAt: '2026-06-08T00:00:01.000Z', text: 'old' }),
    ]);
    await openPromise;
    await livePromise;

    expect(outbound.mock.calls.map(([forwarded]) => forwarded.id)).toEqual(['msg-old', 'msg-live']);
  });

  it('writes backing_off status and schedules reconnect on socket failure', async () => {
    const store = createStore();
    await seedBinding(store);
    const { runtime, timers } = createRuntime({ store });

    await runtime.start();
    await FakeSocket.instances[0].fail();

    await expect(store.getStatus('42')).resolves.toEqual({
      version: 1,
      state: 'backing_off',
      connectedAt: null,
      lastError: 'websocket closed',
      nextReconnectAt: '2026-06-08T00:00:02.500Z',
    });
    expect(timers).toHaveLength(1);
    expect(timers[0].delayMs).toBe(2500);
  });

  it('uses the injected reconnect scheduler when one is provided', async () => {
    const store = createStore();
    await seedBinding(store);
    const scheduleReconnect = vi.fn(async (_delayMs: number) => undefined) as unknown as ScheduleReconnectMock;
    const { runtime, timers } = createRuntime({ store, scheduleReconnect });

    await runtime.start();
    await FakeSocket.instances[0].fail();

    expect(scheduleReconnect).toHaveBeenCalledWith(2500);
    expect(timers).toEqual([]);
  });

  it('does not schedule reconnect when stop closes the socket', async () => {
    const store = createStore();
    await seedBinding(store);
    const { runtime, timers } = createRuntime({ store });

    await runtime.start();
    await runtime.stop();

    expect(FakeSocket.instances[0].closeCalls).toBe(1);
    expect(timers).toEqual([]);
    await expect(store.getStatus('42')).resolves.toMatchObject({ state: 'stopped' });
  });

  it('ignores stale old socket messages after a restart', async () => {
    const store = createStore();
    await seedBinding(store);
    const { runtime, outbound, timers } = createRuntime({ store });

    await runtime.start();
    const oldSocket = FakeSocket.instances[0];
    await oldSocket.open();

    await runtime.start();
    const newSocket = FakeSocket.instances[1];
    await newSocket.open();

    await oldSocket.message(realtimeMessageEnvelope('room-1', { id: 'old-live', text: 'old' }));
    expect(outbound).not.toHaveBeenCalled();
    expect(timers).toEqual([]);

    await newSocket.message(realtimeMessageEnvelope('room-1', { id: 'new-live', text: 'new' }));

    expect(outbound).toHaveBeenCalledTimes(1);
    expect(outbound.mock.calls[0][0]).toMatchObject({ id: 'new-live' });
  });

  it('writes stopped status and does not open a socket when no binding exists', async () => {
    const store = createStore();
    const { runtime } = createRuntime({ store });

    await runtime.start();

    expect(FakeSocket.instances).toEqual([]);
    await expect(store.getStatus('42')).resolves.toEqual({
      version: 1,
      state: 'stopped',
      connectedAt: null,
      lastError: null,
      nextReconnectAt: null,
    });
  });
});

describe('BridgeObject export', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('re-exports the real Durable Object class from index', () => {
    const state = { storage: {} } as DurableObjectState;
    const instance = new ExportedBridgeObject(state, createTestEnv());

    expect(ExportedBridgeObject).toBe(DirectBridgeObject);
    expect(instance).toBeInstanceOf(DurableObject);
    expect(instance).toEqual(
      expect.objectContaining({
        start: expect.any(Function),
        stop: expect.any(Function),
        alarm: expect.any(Function),
      }),
    );
  });

  it('starts from persisted binding and schedules reconnects through Durable Object alarms', async () => {
    const { state, storage } = createFakeDurableObjectState();
    const env = createTestEnv({
      HHHL_ORIGIN: 'https://hhhl.example',
      HHHL_API_BASE_URL: 'https://hhhl.example/api',
      RECONNECT_BASE_DELAY_MS: '1000',
      RECONNECT_MAX_DELAY_MS: '1000',
    });
    const store = new KvStateStore(env.XBOT_STATE, createKeys('xbot'));
    await seedBinding(store);
    const fetchImpl = vi.fn(async () => jsonResponse({ user: { id: 'bot-user', username: 'bridge-bot' } }));
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const object = new DirectBridgeObject(state, env);

    await object.start('42');
    await FakeSocket.instances[0].fail();

    expect(storage.put).toHaveBeenCalledWith('telegramUserId', '42');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://hhhl.example/api/i',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(FakeSocket.instances[0].url).toBe('wss://hhhl.example/streaming?i=hhhl-secret');
    expect(storage.setAlarm).toHaveBeenCalledWith(1_001_000);

    await object.stop('42');

    expect(storage.deleteAlarm).toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledWith('telegramUserId');
  });

  it('does not create a socket when stop wins over an in-flight start', async () => {
    const { state, storage } = createFakeDurableObjectState();
    const env = createTestEnv({
      HHHL_ORIGIN: 'https://hhhl.example',
      HHHL_API_BASE_URL: 'https://hhhl.example/api',
    });
    const store = new KvStateStore(env.XBOT_STATE, createKeys('xbot'));
    await seedBinding(store);
    let resolveMe!: (response: Response) => void;
    let meRequested!: () => void;
    const requestedMe = new Promise<void>((resolve) => {
      meRequested = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      meRequested();
      return new Promise<Response>((resolve) => {
        resolveMe = resolve;
      });
    });
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('WebSocket', FakeSocket);

    const object = new DirectBridgeObject(state, env);
    const startPromise = object.start('42');
    await requestedMe;

    await object.stop('42');
    resolveMe(jsonResponse({ user: { id: 'bot-user', username: 'bridge-bot' } }));
    await startPromise;

    expect(FakeSocket.instances).toEqual([]);
    expect(storage.delete).toHaveBeenCalledWith('telegramUserId');
  });

  it('preserves alarm reconnect backoff across runtime recreation', async () => {
    const { state, storage } = createFakeDurableObjectState();
    const env = createTestEnv({
      HHHL_ORIGIN: 'https://hhhl.example',
      HHHL_API_BASE_URL: 'https://hhhl.example/api',
      RECONNECT_BASE_DELAY_MS: '1000',
      RECONNECT_MAX_DELAY_MS: '4000',
    });
    const store = new KvStateStore(env.XBOT_STATE, createKeys('xbot'));
    await seedBinding(store);
    const fetchImpl = vi.fn(async () => jsonResponse({ user: { id: 'bot-user', username: 'bridge-bot' } }));
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const object = new DirectBridgeObject(state, env);

    await object.start('42');
    await FakeSocket.instances[0].fail();
    expect(storage.setAlarm).toHaveBeenLastCalledWith(1_001_000);

    await object.alarm();
    await FakeSocket.instances[1].fail();
    expect(storage.setAlarm).toHaveBeenLastCalledWith(1_002_000);
  });

  it('clears persisted restart state and writes stopped status when start has no binding', async () => {
    const { state, storage } = createFakeDurableObjectState();
    const env = createTestEnv({
      HHHL_ORIGIN: 'https://hhhl.example',
      HHHL_API_BASE_URL: 'https://hhhl.example/api',
    });
    const store = new KvStateStore(env.XBOT_STATE, createKeys('xbot'));
    const fetchImpl = vi.fn(async () => jsonResponse({ user: { id: 'bot-user', username: 'bridge-bot' } }));
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('WebSocket', FakeSocket);

    const object = new DirectBridgeObject(state, env);

    await object.start('42');

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toEqual([]);
    expect(storage.put).not.toHaveBeenCalledWith('telegramUserId', '42');
    expect(storage.deleteAlarm).toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledWith('telegramUserId');
    await expect(store.getStatus('42')).resolves.toEqual({
      version: 1,
      state: 'stopped',
      connectedAt: null,
      lastError: null,
      nextReconnectAt: null,
    });
  });
});
