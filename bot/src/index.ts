interface Env {
  BOT_TOKEN?: string;
  MINI_APP_URL?: string;
}

interface TelegramMessage {
  text?: string;
  languageCode?: string;
  chat: {
    id: number | string;
  };
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const HHHL_URL = 'https://dc.hhhl.cc';
const CHAT_APP_BUTTON_TEXT = '打开 Chat App';

const startMessageCopy = {
  en: {
    text: 'Open the Mini App with the button below.',
  },
  zh: {
    text: '点击下方按钮打开 Mini App。',
  },
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({ ok: true });
    }

    if (request.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '/webhook')) {
      return json({ ok: false, error: 'not found' }, { status: 404 });
    }

    const config = readConfig(env);
    if ('error' in config) {
      return json({ ok: false, error: config.error }, { status: 500 });
    }

    const update = await readTelegramUpdate(request);
    if (update == null) {
      return json({ ok: false, error: 'invalid json' }, { status: 400 });
    }

    const message = update.message;
    if (message != null && isStartCommand(message.text)) {
      const sent = await sendStartMessage(message.chat.id, message.languageCode, config);
      if (!sent) {
        return json({ ok: false, error: 'telegram send failed' });
      }
    }

    return json({ ok: true });
  },
} satisfies ExportedHandler<Env>;

async function readTelegramUpdate(request: Request): Promise<TelegramUpdate | null> {
  try {
    const body = await request.json();
    return parseTelegramUpdate(body);
  } catch {
    return null;
  }
}

function parseTelegramUpdate(value: unknown): TelegramUpdate | null {
  if (!isRecord(value)) {
    return null;
  }

  const message = value.message;
  if (message == null) {
    return {};
  }

  if (!isRecord(message) || !isRecord(message.chat)) {
    return null;
  }

  const chatId = message.chat.id;
  if (typeof chatId !== 'number' && typeof chatId !== 'string') {
    return null;
  }

  const text = message.text;
  const languageCode = parseLanguageCode(message.from);
  return {
    message: {
      chat: {
        id: chatId,
      },
      text: typeof text === 'string' ? text : undefined,
      languageCode,
    },
  };
}

function parseLanguageCode(from: unknown): string | undefined {
  if (!isRecord(from)) {
    return undefined;
  }

  return typeof from.language_code === 'string' ? from.language_code : undefined;
}

function isStartCommand(text: string | undefined): boolean {
  if (text == null) {
    return false;
  }

  return /^\/start(?:@\w+)?(?:\s|$)/.test(text.trim());
}

async function sendStartMessage(chatId: number | string, languageCode: string | undefined, env: Required<Env>): Promise<boolean> {
  const copy = getStartMessageCopy(languageCode);
  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: copy.text,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '打开hhhl',
              url: HHHL_URL,
            },
            {
              text: CHAT_APP_BUTTON_TEXT,
              web_app: {
                url: env.MINI_APP_URL,
              },
            },
          ],
        ],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Telegram sendMessage failed', {
      body,
      status: response.status,
    });
  }

  return response.ok;
}

function getStartMessageCopy(languageCode: string | undefined): (typeof startMessageCopy)[keyof typeof startMessageCopy] {
  const normalizedLanguageCode = languageCode?.toLowerCase().replace('_', '-');

  if (normalizedLanguageCode?.startsWith('zh')) {
    return startMessageCopy.zh;
  }

  return startMessageCopy.en;
}

function readConfig(env: Env): Required<Env> | { error: string } {
  if (!isNonEmptyString(env.BOT_TOKEN)) {
    return { error: 'missing BOT_TOKEN' };
  }

  if (!isNonEmptyString(env.MINI_APP_URL)) {
    return { error: 'missing MINI_APP_URL' };
  }

  return {
    BOT_TOKEN: env.BOT_TOKEN,
    MINI_APP_URL: env.MINI_APP_URL,
  };
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}
