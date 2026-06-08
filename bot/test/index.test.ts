import worker from '../src/index';

interface TestEnv {
  BOT_TOKEN?: string;
  MINI_APP_URL?: string;
}

const baseEnv: TestEnv = {
  BOT_TOKEN: '123456:telegram-token',
  MINI_APP_URL: 'https://miniapp.example.com',
};

const KEY_TEXT = 'sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd';

function webhookRequest(update: unknown, path = '/webhook'): Request {
  return new Request(`https://bot.example.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(update),
  });
}

function keyResultRequest(body: unknown): Request {
  return new Request('https://bot.example.com/webapp/key-result', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signedInitData(params: Record<string, string>, botToken = baseEnv.BOT_TOKEN ?? ''): Promise<string> {
  const searchParams = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'query-1',
    user: JSON.stringify({ id: 100, first_name: 'Test', is_bot: false }),
    ...params,
  });
  const dataCheckString = [...searchParams.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
  searchParams.set('hash', bytesToHex(await hmacSha256(secretKey, dataCheckString)));
  return searchParams.toString();
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
              web_app: {
                url: 'https://miniapp.example.com/rooms/amlc1bekzi?autoKeySearch=sendToBot',
              },
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

  it('ignores stale get-key callback buttons because key lookup now opens the Mini App', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const callbackResponse = await dispatch(webhookRequest(callbackUpdate('get_key')));

    expect(callbackResponse.status).toBe(200);
    expect(telegramFetch).not.toHaveBeenCalled();
  });

  it('sends a Mini App delivered key result to the signed Telegram user', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const initData = await signedInitData({});
    const response = await dispatch(keyResultRequest({
      initData,
      roomId: 'amlc1bekzi',
      status: 'found',
      key: KEY_TEXT,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(telegramFetch).toHaveBeenCalledOnce();

    const [url, init] = telegramFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bot123456:telegram-token/sendMessage');
    expect(JSON.parse(String(init.body))).toEqual({
      chat_id: 100,
      text: KEY_TEXT,
    });
  });

  it('sends a failure message for signed Mini App key lookup failures', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const initData = await signedInitData({});
    const response = await dispatch(keyResultRequest({
      initData,
      roomId: 'amlc1bekzi',
      status: 'failed',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const [, init] = telegramFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      chat_id: 100,
      text: '获取密钥失败，请打开 Mini App 检查 HHHL 登录状态。',
    });
  });

  it('rejects Mini App key result requests with invalid Telegram init data', async () => {
    const telegramFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', telegramFetch);

    const response = await dispatch(keyResultRequest({
      initData: 'user=%7B%22id%22%3A100%7D&auth_date=1800000000&hash=bad',
      roomId: 'amlc1bekzi',
      status: 'found',
      key: KEY_TEXT,
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'invalid init data' });
    expect(telegramFetch).not.toHaveBeenCalled();
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
