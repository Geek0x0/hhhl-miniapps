interface Env {
  BOT_TOKEN?: string;
  MINI_APP_URL?: string;
  HHHL_TOKEN?: string;
  HHHL_ROOM_ID?: string;
}

type BotConfig = Required<Pick<Env, 'BOT_TOKEN' | 'MINI_APP_URL'>> & Pick<Env, 'HHHL_TOKEN' | 'HHHL_ROOM_ID'>;
type KeyLookupConfig = Required<Pick<Env, 'HHHL_TOKEN' | 'HHHL_ROOM_ID'>>;

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

interface HhhlSearchMessage {
  id: string;
  text?: string;
  createdAt?: string;
  user?: {
    id?: string;
  };
}

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const HHHL_URL = 'https://dc.hhhl.cc';
const CHAT_APP_BUTTON_TEXT = '打开 Chat App';
const GET_KEY_BUTTON_TEXT = '获取密钥';
const GET_KEY_CALLBACK_DATA = 'get_key';
const KEY_SEARCH_QUERY = 'sk-';
const KEY_SEARCH_USER_ID = 'amk1v51gkh1u0001';
const KEY_SEARCH_LIMIT = 30;
const KEY_TOKEN_PATTERN = /sk-[A-Za-z0-9]{32}(?![A-Za-z0-9])/;

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

    const callbackQuery = update.callbackQuery;
    if (callbackQuery?.data === GET_KEY_CALLBACK_DATA) {
      await answerCallbackQuery(callbackQuery.id, config);

      const chatId = callbackQuery.message?.chat.id;
      if (chatId != null) {
        const reply = await getKeyReply(config);
        await sendTelegramMessage(chatId, reply, config);
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
              callback_data: GET_KEY_CALLBACK_DATA,
            },
          ],
        ],
      },
    },
    env,
  );
}

async function sendTelegramMessage(chatId: number | string, text: string, env: BotConfig): Promise<boolean> {
  return sendTelegramApi('sendMessage', { chat_id: chatId, text }, env);
}

async function answerCallbackQuery(callbackQueryId: string, env: BotConfig): Promise<boolean> {
  return sendTelegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId }, env);
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

async function getKeyReply(config: BotConfig): Promise<string> {
  if (!isNonEmptyString(config.HHHL_TOKEN) || !isNonEmptyString(config.HHHL_ROOM_ID)) {
    return '获取密钥失败：bot 未配置 HHHL_TOKEN 或 HHHL_ROOM_ID。';
  }

  const keyConfig: KeyLookupConfig = {
    HHHL_TOKEN: config.HHHL_TOKEN,
    HHHL_ROOM_ID: config.HHHL_ROOM_ID,
  };

  try {
    const filteredResults = await searchHhhlKeyMessages(keyConfig, true);
    const messages = filteredResults.length > 0 ? filteredResults : await searchHhhlKeyMessages(keyConfig, false);
    return extractLatestKeyToken(messages) ?? '未找到可用密钥。';
  } catch (error) {
    console.error('HHHL key lookup failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return '获取密钥失败：请求 HHHL 接口失败。';
  }
}

async function searchHhhlKeyMessages(config: KeyLookupConfig, filterByUser: boolean): Promise<HhhlSearchMessage[]> {
  const payload = await callHhhlEndpoint(config, 'chat/messages/search', {
    roomId: config.HHHL_ROOM_ID,
    query: KEY_SEARCH_QUERY,
    ...(filterByUser ? { userId: KEY_SEARCH_USER_ID } : {}),
    limit: KEY_SEARCH_LIMIT,
  });

  return normalizeHhhlMessages(payload);
}

async function callHhhlEndpoint(config: KeyLookupConfig, endpoint: string, params: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${HHHL_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      i: config.HHHL_TOKEN,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`HHHL HTTP ${response.status}`);
  }

  return payload;
}

function normalizeHhhlMessages(value: unknown): HhhlSearchMessage[] {
  return getHhhlMessageItems(value).map(normalizeHhhlMessage).filter((message) => message.id !== '');
}

function getHhhlMessageItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of ['messages', 'items', 'data', 'timeline']) {
    const item = value[key];
    if (Array.isArray(item)) {
      return item;
    }
  }

  return [];
}

function normalizeHhhlMessage(value: unknown): HhhlSearchMessage {
  const raw = unwrapHhhlMessage(value);
  const user = getRecordField(raw, ['user', 'fromUser', 'sender', 'author']);
  return {
    id: stringField(raw, ['id', 'messageId', 'chatMessageId']) ?? '',
    text: stringField(raw, ['text', 'body', 'content', 'message']),
    createdAt: stringField(raw, ['createdAt', 'created_at', 'created']),
    user: {
      id: stringField(user, ['id']) ?? stringField(raw, ['userId', 'fromUserId', 'senderId', 'authorId']),
    },
  };
}

function unwrapHhhlMessage(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  const nestedMessage = value.message;
  return isRecord(nestedMessage) ? nestedMessage : value;
}

function extractLatestKeyToken(messages: HhhlSearchMessage[]): string | null {
  const candidates = messages
    .filter((message) => message.user?.id === KEY_SEARCH_USER_ID)
    .map((message, index) => ({
      index,
      token: extractKeyToken(message.text),
      timestamp: timestampFrom(message.createdAt),
    }))
    .filter((candidate): candidate is { index: number; token: string; timestamp: number } => candidate.token != null)
    .sort((a, b) => b.timestamp - a.timestamp || a.index - b.index);

  return candidates[0]?.token ?? null;
}

function extractKeyToken(text: string | undefined): string | null {
  return text?.match(KEY_TOKEN_PATTERN)?.[0] ?? null;
}

function timestampFrom(value: string | undefined): number {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) ? timestamp : 0;
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
    HHHL_TOKEN: env.HHHL_TOKEN,
    HHHL_ROOM_ID: env.HHHL_ROOM_ID,
  };
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRecordField(value: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const item = value[key];
    if (isRecord(item)) {
      return item;
    }
  }

  return undefined;
}

function stringField(value: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (value == null) {
    return undefined;
  }

  for (const key of keys) {
    const item = value[key];
    if (typeof item === 'string') {
      return item;
    }
  }

  return undefined;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}
