interface Env {
  BOT_TOKEN?: string;
  MINI_APP_URL?: string;
}

type BotConfig = Required<Pick<Env, 'BOT_TOKEN' | 'MINI_APP_URL'>>;

interface TelegramMessage {
  text?: string;
  languageCode?: string;
  chat: {
    id: number | string;
  };
}

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: {
    chat: {
      id: number | string;
    };
  };
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callbackQuery?: TelegramCallbackQuery;
}

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const HHHL_URL = 'https://dc.hhhl.cc';
const CHAT_APP_BUTTON_TEXT = '打开 Chat App';
const GET_KEY_BUTTON_TEXT = '获取密钥';
const GET_KEY_ROOM_ID = 'amlc1bekzi';
const AUTO_KEY_SEARCH_PARAM = 'autoKeySearch';

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

  const message = parseTelegramMessage(value.message);
  if (message === null) {
    return null;
  }

  const callbackQuery = parseTelegramCallbackQuery(value.callback_query);
  if (callbackQuery === null) {
    return null;
  }

  return {
    ...(message == null ? {} : { message }),
    ...(callbackQuery == null ? {} : { callbackQuery }),
  };
}

function parseTelegramMessage(value: unknown): TelegramMessage | null | undefined {
  if (value == null) {
    return undefined;
  }

  if (!isRecord(value) || !isRecord(value.chat)) {
    return null;
  }

  const chatId = value.chat.id;
  if (typeof chatId !== 'number' && typeof chatId !== 'string') {
    return null;
  }

  const text = value.text;
  const languageCode = parseLanguageCode(value.from);
  return {
    chat: {
      id: chatId,
    },
    text: typeof text === 'string' ? text : undefined,
    languageCode,
  };
}

function parseTelegramCallbackQuery(value: unknown): TelegramCallbackQuery | null | undefined {
  if (value == null) {
    return undefined;
  }

  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  const message = parseCallbackMessage(value.message);
  if (message === null) {
    return null;
  }

  const data = value.data;
  return {
    id: value.id,
    data: typeof data === 'string' ? data : undefined,
    ...(message == null ? {} : { message }),
  };
}

function parseCallbackMessage(value: unknown): TelegramCallbackQuery['message'] | null | undefined {
  if (value == null) {
    return undefined;
  }

  if (!isRecord(value) || !isRecord(value.chat)) {
    return null;
  }

  const chatId = value.chat.id;
  if (typeof chatId !== 'number' && typeof chatId !== 'string') {
    return null;
  }

  return {
    chat: {
      id: chatId,
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

async function sendStartMessage(chatId: number | string, languageCode: string | undefined, env: BotConfig): Promise<boolean> {
  const copy = getStartMessageCopy(languageCode);
  return sendTelegramApi(
    'sendMessage',
    {
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
          [
            {
              text: GET_KEY_BUTTON_TEXT,
              web_app: {
                url: buildGetKeyMiniAppUrl(env.MINI_APP_URL),
              },
            },
          ],
        ],
      },
    },
    env,
  );
}

async function sendTelegramApi(methodName: string, body: unknown, env: BotConfig): Promise<boolean> {
  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${env.BOT_TOKEN}/${methodName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    console.error(`Telegram ${methodName} failed`, {
      body: responseBody,
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

function readConfig(env: Env): BotConfig | { error: string } {
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

function buildGetKeyMiniAppUrl(miniAppUrl: string): string {
  const url = new URL(miniAppUrl);
  url.pathname = `/rooms/${GET_KEY_ROOM_ID}`;
  url.searchParams.set(AUTO_KEY_SEARCH_PARAM, '1');
  return url.toString();
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
