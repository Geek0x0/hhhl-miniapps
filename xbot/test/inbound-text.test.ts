import worker from '../src/index';
import { forwardTelegramMessageToHhhl } from '../src/bridge/inbound';
import { resolveReplyMapping } from '../src/bridge/mapping';
import { createKeys } from '../src/state/keys';
import { KvStateStore } from '../src/state/kvStore';
import type { BindingState, MessageMapState } from '../src/state/schemas';
import type { TelegramMessage } from '../src/telegram/types';
import { createTestEnv } from './fakes';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function storeFor(env = createTestEnv()): KvStateStore {
  return new KvStateStore(env.XBOT_STATE, createKeys(env.KV_KEY_PREFIX ?? 'xbot'));
}

async function seedBinding(store: KvStateStore, overrides: Partial<BindingState> = {}): Promise<BindingState> {
  const binding: BindingState = {
    version: 1,
    telegramUserId: '42',
    roomId: 'room-1',
    roomName: 'Ops',
    boundAt: '2026-06-08T00:00:00.000Z',
    lastSeenMessageId: null,
    ...overrides,
  };
  await store.setBinding(binding);
  return binding;
}

async function seedMessageMap(store: KvStateStore, overrides: Partial<MessageMapState> = {}): Promise<MessageMapState> {
  const map: MessageMapState = {
    version: 1,
    roomId: 'room-1',
    hhhlMessageId: 'hhhl-reply-1',
    telegramUserId: '42',
    telegramMessageId: 100,
    createdAt: '2026-06-08T00:00:01.000Z',
    ...overrides,
  };
  await store.putMessageMap(map);
  return map;
}

function textMessage(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    messageId: 101,
    chatId: 42,
    chatType: 'private',
    fromId: 42,
    kind: 'text',
    text: '  hello HHHL  ',
    ...overrides,
  };
}

function createForwardingFakes() {
  const chatApi = {
    createToRoom: vi.fn(async (params: { toRoomId: string; text?: string; replyId?: string; quoteId?: string }) => ({
      id: 'hhhl-created-1',
      roomId: params.toRoomId,
      createdAt: '2026-06-08T00:00:03.000Z',
      text: params.text,
    })),
  };
  const telegram = {
    sendMessage: vi.fn(async () => ({ messageId: 301 })),
  };

  return { chatApi, telegram };
}

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function requestBody(call: FetchCall): Record<string, unknown> {
  expect(typeof call.init?.body).toBe('string');
  return JSON.parse(call.init?.body as string) as Record<string, unknown>;
}

function telegramUpdate(text: string): Record<string, unknown> {
  return {
    update_id: 1,
    message: {
      message_id: 101,
      text,
      from: { id: 42, is_bot: false, first_name: 'K' },
      chat: { id: 42, type: 'private' },
    },
  };
}

describe('Telegram inbound text forwarding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks the Telegram user to bind first when no active binding exists', async () => {
    const state = storeFor();
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage(),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(chatApi.createToRoom).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(42, '请先使用 /bind <roomId> 绑定 HHHL 聊天室。');
  });

  it('resolves reply mappings only for the current bound room', async () => {
    const state = storeFor();
    await seedMessageMap(state, { roomId: 'room-1', hhhlMessageId: 'hhhl-reply-1', telegramMessageId: 100 });
    await seedMessageMap(state, { roomId: 'room-2', hhhlMessageId: 'hhhl-other-room', telegramMessageId: 200 });

    await expect(resolveReplyMapping(state, '42', 'room-1', undefined)).resolves.toBeUndefined();
    await expect(resolveReplyMapping(state, '42', 'room-1', 100)).resolves.toBe('hhhl-reply-1');
    await expect(resolveReplyMapping(state, '42', 'room-1', 200)).resolves.toBeUndefined();
  });

  it('forwards text without reply metadata and stores the source message map', async () => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage(),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).toHaveBeenCalledWith({ toRoomId: 'room-1', text: 'hello HHHL' });
    const params = chatApi.createToRoom.mock.calls[0][0];
    expect(params).not.toHaveProperty('replyId');
    expect(params).not.toHaveProperty('quoteId');
    await expect(state.getMessageMapByTelegram('42', 101)).resolves.toEqual({
      version: 1,
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-created-1',
      telegramUserId: '42',
      telegramMessageId: 101,
      createdAt: '2026-06-08T00:00:04.000Z',
    });
  });

  it('does not create another HHHL message for duplicate Telegram deliveries in the same room', async () => {
    const state = storeFor();
    await seedBinding(state);
    await seedMessageMap(state, {
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-created-1',
      telegramMessageId: 101,
      createdAt: '2026-06-08T00:00:04.000Z',
    });
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage(),
      now: () => '2026-06-08T00:00:05.000Z',
    });

    expect(chatApi.createToRoom).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    await expect(state.getMessageMapByTelegram('42', 101)).resolves.toMatchObject({
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-created-1',
      createdAt: '2026-06-08T00:00:04.000Z',
    });
  });

  it('omits reply metadata when Telegram reply id has no stored map', async () => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage({ replyToMessageId: 999 }),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).toHaveBeenCalledWith({ toRoomId: 'room-1', text: 'hello HHHL' });
    const params = chatApi.createToRoom.mock.calls[0][0];
    expect(params).not.toHaveProperty('replyId');
    expect(params).not.toHaveProperty('quoteId');
  });

  it('uses a same-room reply mapping for both HHHL replyId and quoteId', async () => {
    const state = storeFor();
    await seedBinding(state);
    await seedMessageMap(state, { roomId: 'room-1', hhhlMessageId: 'hhhl-reply-1', telegramMessageId: 100 });
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage({ replyToMessageId: 100 }),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).toHaveBeenCalledWith({
      toRoomId: 'room-1',
      text: 'hello HHHL',
      replyId: 'hhhl-reply-1',
      quoteId: 'hhhl-reply-1',
    });
  });

  it('ignores a reply mapping from a different room', async () => {
    const state = storeFor();
    await seedBinding(state, { roomId: 'room-1' });
    await seedMessageMap(state, { roomId: 'room-2', hhhlMessageId: 'hhhl-other-room', telegramMessageId: 100 });
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage({ replyToMessageId: 100 }),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).toHaveBeenCalledWith({ toRoomId: 'room-1', text: 'hello HHHL' });
    const params = chatApi.createToRoom.mock.calls[0][0];
    expect(params).not.toHaveProperty('replyId');
    expect(params).not.toHaveProperty('quoteId');
  });

  it('sends an unsupported-message notice for non-text messages in Task 9', async () => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage({ kind: 'unsupported', text: undefined }),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(chatApi.createToRoom).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(42, '暂不支持这类 Telegram 消息。');
  });

  it('does not forward whitespace-only text to HHHL', async () => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      telegramUserId: '42',
      message: textMessage({ text: '   \n\t   ' }),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(chatApi.createToRoom).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(42, '暂不支持这类 Telegram 消息。');
  });

  it('routes authorized normal text through HHHL without sending the old placeholder reply', async () => {
    const env = createTestEnv({ HHHL_API_BASE_URL: 'https://hhhl.example/api' });
    const state = storeFor(env);
    await seedBinding(state);
    const calls: FetchCall[] = [];
    const telegramCalls: FetchCall[] = [];
    const hhhlCalls: FetchCall[] = [];
    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      const call = { url: input.toString(), init };
      calls.push(call);
      if (call.url.startsWith('https://api.telegram.org/')) {
        telegramCalls.push(call);
        return jsonResponse({ ok: true, result: { message_id: 321 } });
      }
      hhhlCalls.push(call);
      return jsonResponse({ message: { id: 'hhhl-created-1', roomId: 'room-1', text: 'hello HHHL' } });
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await worker.fetch(
      new Request('https://xbot.example.com/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': env.BOT_WEBHOOK_SECRET ?? '',
        },
        body: JSON.stringify(telegramUpdate('  hello HHHL  ')),
      }),
      env,
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramCalls).toHaveLength(0);
    expect(hhhlCalls).toHaveLength(1);
    expect(hhhlCalls[0].url).toBe('https://hhhl.example/api/chat/messages/create-to-room');
    expect(requestBody(hhhlCalls[0])).toEqual({
      toRoomId: 'room-1',
      text: 'hello HHHL',
      i: 'hhhl-secret',
    });
    await expect(state.getMessageMapByTelegram('42', 101)).resolves.toMatchObject({
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-created-1',
      telegramMessageId: 101,
    });
    expect(calls.map((call) => requestBody(call).text)).not.toContain('命令处理中断：该功能还没有接入。');
  });

  it('acks normal text webhooks and logs sanitized inbound failures when HHHL create fails', async () => {
    const env = createTestEnv({ HHHL_API_BASE_URL: 'https://hhhl.example/api' });
    const state = storeFor(env);
    await seedBinding(state);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchImpl: typeof fetch = vi.fn(async (input) => {
      const url = input.toString();
      if (url.startsWith('https://api.telegram.org/')) {
        return jsonResponse({ ok: true, result: { message_id: 321 } });
      }
      return jsonResponse(
        { error: 'failed with 123456:telegram-secret hhhl-secret telegram-webhook-secret' },
        { status: 500 },
      );
    });
    vi.stubGlobal('fetch', fetchImpl);

    const response = await worker.fetch(
      new Request('https://xbot.example.com/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': env.BOT_WEBHOOK_SECRET ?? '',
        },
        body: JSON.stringify(telegramUpdate('hello HHHL')),
      }),
      env,
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('inbound forwarding failed');
    expect(logged).not.toContain('123456:telegram-secret');
    expect(logged).not.toContain('hhhl-secret');
    expect(logged).not.toContain('telegram-webhook-secret');
  });
});
