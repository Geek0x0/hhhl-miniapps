import worker from '../src/index';
import type { Env } from '../src/env';
import { commandHelpText } from '../src/telegram/commands';
import { createTestEnv } from './fakes';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

const baseEnv: Env = createTestEnv();

function telegramUpdate(options: {
  text?: string;
  fromId?: number | string;
  chatId?: number | string;
  chatType?: string;
  message?: Record<string, unknown>;
} = {}): Record<string, unknown> {
  const fromId = options.fromId ?? 42;

  return {
    update_id: 1,
    message: {
      message_id: 10,
      text: options.text ?? '/help',
      from: { id: fromId, is_bot: false, first_name: 'K' },
      chat: { id: options.chatId ?? fromId, type: options.chatType ?? 'private' },
      ...options.message,
    },
  };
}

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function createTelegramFetch(response: Response = jsonResponse({ ok: true, result: { message_id: 321 } })): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
    calls.push({ url: input.toString(), init });
    return response;
  });

  return { fetchImpl, calls };
}

function requestBody(call: FetchCall): Record<string, unknown> {
  expect(typeof call.init?.body).toBe('string');
  return JSON.parse(call.init?.body as string) as Record<string, unknown>;
}

async function postUpdate(
  path: '/' | '/webhook',
  update: unknown,
  env: Env = baseEnv,
  webhookSecret: string | null | undefined = env.BOT_WEBHOOK_SECRET,
): Promise<Response> {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (webhookSecret !== null && webhookSecret !== undefined) {
    headers.set('X-Telegram-Bot-Api-Secret-Token', webhookSecret);
  }

  return worker.fetch(
    new Request(`https://xbot.example.com${path}`, {
      method: 'POST',
      headers,
      body: typeof update === 'string' ? update : JSON.stringify(update),
    }),
    env,
    {} as ExecutionContext,
  );
}

describe('worker Telegram routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['/', '/health'] as const)('keeps GET %s as health status', async (path) => {
    const response = await worker.fetch(new Request(`https://xbot.example.com${path}`), baseEnv, {} as ExecutionContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: 'xbot' });
  });

  it.each(['/', '/webhook'] as const)('accepts POST %s Telegram updates', async (path) => {
    const { fetchImpl, calls } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate(path, telegramUpdate({ text: '/help' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.telegram.org/bot123456:telegram-secret/sendMessage');
    expect(requestBody(calls[0])).toEqual({
      chat_id: 42,
      text: commandHelpText,
      reply_to_message_id: 10,
      allow_sending_without_reply: true,
    });
  });

  it('returns config errors before parsing or processing updates', async () => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', 'not-json', {
      XBOT_STATE: {} as KVNamespace,
      BRIDGE: {} as DurableObjectNamespace,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'missing BOT_TOKEN, BOT_WEBHOOK_SECRET, HHHL_TOKEN, ALLOWED_TELEGRAM_USER_ID',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['wrong', 'wrong-secret'],
  ] as const)('rejects webhook requests with %s secret header before parsing updates', async (_label, webhookSecret) => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', telegramUpdate({ text: '/help' }), baseEnv, webhookSecret);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', '{');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'invalid json' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('acks unsupported Telegram updates without retrying', async () => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', { update_id: 2, message: { message_id: 20 } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats JSON null as an invalid Telegram update', async () => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', 'null');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'invalid update' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('acks updates without messages without calling Telegram', async () => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', { update_id: 3, edited_message: { message_id: 30 } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ignores unauthorized private users without calling Telegram', async () => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', telegramUpdate({ text: '/help', fromId: 99 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ignores allowed users in group chats without calling Telegram', async () => {
    const { fetchImpl } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate(
      '/webhook',
      telegramUpdate({ text: '/help', fromId: 42, chatId: -100123, chatType: 'group' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['/bind', '用法：/bind <roomId> [显示名]'],
    ['/does-not-exist', '未知命令。发送 /help 查看帮助。'],
    ['/status', ['实时状态：', 'state：stopped', 'connectedAt：无', 'lastError：无', 'nextReconnectAt：无'].join('\n')],
    ['普通消息', '命令处理中断：该功能还没有接入。'],
  ] as const)('replies to %s with routed text', async (text, expectedReply) => {
    const { fetchImpl, calls } = createTelegramFetch();
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', telegramUpdate({ text }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(requestBody(calls[0])).toEqual({
      chat_id: 42,
      text: expectedReply,
      reply_to_message_id: 10,
      allow_sending_without_reply: true,
    });
  });

  it('acks webhook and logs sanitized error when Telegram send fails', async () => {
    const { fetchImpl } = createTelegramFetch(
      jsonResponse({ ok: false, error_code: 400, description: 'bad request 123456:telegram-secret' }, { status: 400 }),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', fetchImpl);

    const response = await postUpdate('/webhook', telegramUpdate({ text: '/help' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('telegram send failed');
    expect(logged).not.toContain('123456:telegram-secret');
    expect(logged).not.toContain('telegram-webhook-secret');
    expect(logged).not.toContain('/bot123456:telegram-secret');
  });
});
