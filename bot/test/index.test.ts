import worker from '../src/index';

interface TestEnv {
  BOT_TOKEN?: string;
  MINI_APP_URL?: string;
  HHHL_TOKEN?: string;
  HHHL_ROOM_ID?: string;
}

const baseEnv: TestEnv = {
  BOT_TOKEN: '123456:telegram-token',
  MINI_APP_URL: 'https://miniapp.example.com',
  HHHL_TOKEN: 'hhhl-token',
  HHHL_ROOM_ID: 'room-1',
};

function webhookRequest(update: unknown, path = '/webhook'): Request {
  return new Request(`https://bot.example.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(update),
  });
}

function messageUpdate(text: string, languageCode?: string): unknown {
  return {
    update_id: 1,
    message: {
      message_id: 10,
      text,
      from:
        languageCode == null
          ? undefined
          : {
              id: 100,
              is_bot: false,
              first_name: 'Test',
              language_code: languageCode,
            },
      chat: {
        id: 42,
        type: 'private',
      },
    },
  };
}

function callbackUpdate(data: string): unknown {
  return {
    update_id: 2,
    callback_query: {
      id: 'callback-1',
      data,
      from: {
        id: 100,
        is_bot: false,
        first_name: 'Test',
      },
      message: {
        message_id: 10,
        chat: {
          id: 42,
          type: 'private',
        },
      },
    },
  };
}

async function dispatch(request: Request, env: TestEnv = baseEnv): Promise<Response> {
  return worker.fetch(request, env, {} as ExecutionContext);
}

describe('telegram bot worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('replies to /start with a WebApp button for the configured Mini App URL', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(messageUpdate('/start')));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramFetch).toHaveBeenCalledOnce();

    const [url, init] = telegramFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bot123456:telegram-token/sendMessage');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({
      chat_id: 42,
      text: 'Open the Mini App with the button below.',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '打开hhhl',
              url: 'https://dc.hhhl.cc',
            },
            {
              text: '打开 Chat App',
              web_app: {
                url: 'https://miniapp.example.com',
              },
            },
          ],
          [
            {
              text: '获取密钥',
              callback_data: 'get_key',
            },
          ],
        ],
      },
    });
  });

  it('uses Chinese copy when Telegram reports a Chinese user language', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(messageUpdate('/start', 'zh-CN')));

    expect(response.status).toBe(200);
    expect(telegramFetch).toHaveBeenCalledOnce();

    const [, init] = telegramFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      text: '点击下方按钮打开 Mini App。',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '打开hhhl',
              url: 'https://dc.hhhl.cc',
            },
            {
              text: '打开 Chat App',
            },
          ],
          [
            {
              text: '获取密钥',
            },
          ],
        ],
      },
    });
  });

  it('sends the latest HHHL key when the get-key button is clicked', async () => {
    const telegramFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.telegram.org/bot123456:telegram-token/answerCallbackQuery') {
        return Response.json({ ok: true });
      }
      if (url === 'https://api.telegram.org/bot123456:telegram-token/sendMessage') {
        return Response.json({ ok: true });
      }
      if (url === 'https://dc.hhhl.cc/api/chat/messages/search') {
        expect(JSON.parse(String(init?.body))).toEqual({
          roomId: 'room-1',
          query: 'sk-',
          userId: 'amk1v51gkh1u0001',
          limit: 30,
          i: 'hhhl-token',
        });
        return Response.json({
          messages: [
            {
              id: 'key-1',
              text: '提前发一下sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd',
              createdAt: '2026-01-01T00:00:02.000Z',
              user: { id: 'amk1v51gkh1u0001', username: 'ls' },
            },
            {
              id: 'key-2',
              text: 'sk-0123456789abcdefghijklmnopqrstuv',
              createdAt: '2026-01-01T00:00:01.000Z',
              user: { id: 'amk1v51gkh1u0001', username: 'ls' },
            },
          ],
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(callbackUpdate('get_key')));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramFetch).toHaveBeenCalledTimes(3);
    const [, sendInit] = telegramFetch.mock.calls.find(([url]) => String(url).endsWith('/sendMessage')) as [string, RequestInit];
    expect(JSON.parse(String(sendInit.body))).toEqual({
      chat_id: 42,
      text: 'sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd',
    });
  });

  it('falls back to unfiltered HHHL key search when user-filtered search returns no results', async () => {
    const hhhlBodies: unknown[] = [];
    const telegramFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.telegram.org/bot123456:telegram-token/answerCallbackQuery') {
        return Response.json({ ok: true });
      }
      if (url === 'https://api.telegram.org/bot123456:telegram-token/sendMessage') {
        return Response.json({ ok: true });
      }
      if (url === 'https://dc.hhhl.cc/api/chat/messages/search') {
        const body = JSON.parse(String(init?.body));
        hhhlBodies.push(body);
        if (body.userId === 'amk1v51gkh1u0001') {
          return Response.json({ messages: [] });
        }

        return Response.json({
          messages: [
            {
              id: 'key-1',
              text: 'fallback sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd ok',
              createdAt: '2026-01-01T00:00:02.000Z',
              user: { id: 'amk1v51gkh1u0001', username: 'ls' },
            },
          ],
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(callbackUpdate('get_key')));

    expect(response.status).toBe(200);
    expect(hhhlBodies).toEqual([
      {
        roomId: 'room-1',
        query: 'sk-',
        userId: 'amk1v51gkh1u0001',
        limit: 30,
        i: 'hhhl-token',
      },
      {
        roomId: 'room-1',
        query: 'sk-',
        limit: 30,
        i: 'hhhl-token',
      },
    ]);
    const [, sendInit] = telegramFetch.mock.calls.find(([url]) => String(url).endsWith('/sendMessage')) as [string, RequestInit];
    expect(JSON.parse(String(sendInit.body))).toEqual({
      chat_id: 42,
      text: 'sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd',
    });
  });

  it('reports key lookup configuration errors from the get-key button without breaking /start', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const startResponse = await dispatch(webhookRequest(messageUpdate('/start')), {
      BOT_TOKEN: '123456:telegram-token',
      MINI_APP_URL: 'https://miniapp.example.com',
    });
    const callbackResponse = await dispatch(webhookRequest(callbackUpdate('get_key')), {
      BOT_TOKEN: '123456:telegram-token',
      MINI_APP_URL: 'https://miniapp.example.com',
    });

    expect(startResponse.status).toBe(200);
    expect(callbackResponse.status).toBe(200);
    const [, sendInit] = telegramFetch.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(sendInit.body))).toEqual({
      chat_id: 42,
      text: '获取密钥失败：bot 未配置 HHHL_TOKEN 或 HHHL_ROOM_ID。',
    });
  });

  it('accepts POST / as a Telegram webhook endpoint', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(messageUpdate('/start hhhl'), '/'));

    expect(response.status).toBe(200);
    expect(telegramFetch).toHaveBeenCalledOnce();
  });

  it('acknowledges non-start messages without calling Telegram', async () => {
    const telegramFetch = vi.fn();
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(messageUpdate('/help')));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramFetch).not.toHaveBeenCalled();
  });

  it('acknowledges webhook updates when Telegram sendMessage fails so updates are not retried', async () => {
    const telegramFetch = vi.fn(async () =>
      Response.json(
        {
          ok: false,
          error_code: 400,
          description: 'Bad Request: BUTTON_TYPE_INVALID',
        },
        { status: 400 },
      ),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(messageUpdate('/start')));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'telegram send failed',
    });
    expect(consoleError).toHaveBeenCalledWith('Telegram sendMessage failed', {
      body: '{"ok":false,"error_code":400,"description":"Bad Request: BUTTON_TYPE_INVALID"}',
      status: 400,
    });
  });

  it('returns a configuration error when required environment variables are missing', async () => {
    const telegramFetch = vi.fn();
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(webhookRequest(messageUpdate('/start')), {
      BOT_TOKEN: '123456:telegram-token',
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'missing MINI_APP_URL',
    });
    expect(telegramFetch).not.toHaveBeenCalled();
  });
});
