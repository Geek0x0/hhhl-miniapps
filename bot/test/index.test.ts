import worker from '../src/index';

interface TestEnv {
  BOT_TOKEN?: string;
  MINI_APP_URL?: string;
}

const baseEnv: TestEnv = {
  BOT_TOKEN: '123456:telegram-token',
  MINI_APP_URL: 'https://miniapp.example.com',
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
        ],
      },
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
