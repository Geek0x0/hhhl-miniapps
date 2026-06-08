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

interface TelegramWebAppUser {
  id: number | string;
}

interface KeyResultRequest {
  initData: string;
  roomId: string;
  status: 'found' | 'not_found' | 'failed';
  key?: string;
}

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const HHHL_URL = 'https://dc.hhhl.cc';
const CHAT_APP_BUTTON_TEXT = '打开 Chat App';
const GET_KEY_BUTTON_TEXT = '获取密钥';
const GET_KEY_ROOM_ID = 'amlc1bekzi';
const AUTO_KEY_SEARCH_PARAM = 'autoKeySearch';
const AUTO_KEY_SEND_TO_BOT_VALUE = 'sendToBot';
const KEY_RESULT_PATH = '/webapp/key-result';
const KEY_TOKEN_PATTERN = /^sk-[A-Za-z0-9]{32}$/;
const WEB_APP_DATA_KEY = 'WebAppData';
const INIT_DATA_MAX_AGE_SECONDS = 86400;

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

    const config = readConfig(env);
    if ('error' in config) {
      return json({ ok: false, error: config.error }, { status: 500 });
    }

    if (url.pathname === KEY_RESULT_PATH && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, config),
      });
    }

    if (url.pathname === KEY_RESULT_PATH && request.method === 'POST') {
      return handleKeyResult(request, config);
    }

    if (request.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '/webhook')) {
      return json({ ok: false, error: 'not found' }, { status: 404 });
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

async function handleKeyResult(request: Request, env: BotConfig): Promise<Response> {
  const keyResult = await readKeyResultRequest(request);
  const cors = corsHeaders(request, env);
  if (keyResult == null) {
    return json({ ok: false, error: 'invalid key result' }, { status: 400, headers: cors });
  }

  const user = await validateTelegramInitData(keyResult.initData, env.BOT_TOKEN);
  if (user == null) {
    return json({ ok: false, error: 'invalid init data' }, { status: 401, headers: cors });
  }

  const text = keyResultText(keyResult);
  const sent = await sendTelegramApi(
    'sendMessage',
    {
      chat_id: user.id,
      text,
    },
    env,
  );

  if (!sent) {
    return json({ ok: false, error: 'telegram send failed' }, { headers: cors });
  }

  return json({ ok: true }, { headers: cors });
}

async function readKeyResultRequest(request: Request): Promise<KeyResultRequest | null> {
  try {
    return parseKeyResultRequest(await request.json());
  } catch {
    return null;
  }
}

function parseKeyResultRequest(value: unknown): KeyResultRequest | null {
  if (!isRecord(value) || typeof value.initData !== 'string' || typeof value.roomId !== 'string' || value.roomId !== GET_KEY_ROOM_ID) {
    return null;
  }

  if (value.status === 'found') {
    if (typeof value.key !== 'string' || !KEY_TOKEN_PATTERN.test(value.key)) {
      return null;
    }

    return {
      initData: value.initData,
      roomId: value.roomId,
      status: 'found',
      key: value.key,
    };
  }

  if (value.status === 'not_found' || value.status === 'failed') {
    return {
      initData: value.initData,
      roomId: value.roomId,
      status: value.status,
    };
  }

  return null;
}

function keyResultText(keyResult: KeyResultRequest): string {
  if (keyResult.status === 'found') {
    return keyResult.key ?? '';
  }

  if (keyResult.status === 'not_found') {
    return '未找到可用密钥。';
  }

  return '获取密钥失败，请打开 Mini App 检查 HHHL 登录状态。';
}

async function validateTelegramInitData(initData: string, botToken: string): Promise<TelegramWebAppUser | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (hash == null || !isNonEmptyString(hash) || !isFreshAuthDate(params.get('auth_date'))) {
    return null;
  }

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmacSha256(new TextEncoder().encode(WEB_APP_DATA_KEY), botToken);
  const expectedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));
  if (!constantTimeEqual(hash, expectedHash)) {
    return null;
  }

  return parseTelegramWebAppUser(params.get('user'));
}

function parseTelegramWebAppUser(rawUser: string | null): TelegramWebAppUser | null {
  if (rawUser == null) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as unknown;
    if (!isRecord(user)) {
      return null;
    }

    const userId = user.id;
    if (typeof userId !== 'number' && typeof userId !== 'string') {
      return null;
    }

    return { id: userId };
  } catch {
    return null;
  }
}

function isFreshAuthDate(rawAuthDate: string | null): boolean {
  if (rawAuthDate == null || !/^\d+$/.test(rawAuthDate)) {
    return false;
  }

  const authDateSeconds = Number(rawAuthDate);
  if (!Number.isFinite(authDateSeconds)) {
    return false;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDateSeconds;
  return ageSeconds >= -300 && ageSeconds <= INIT_DATA_MAX_AGE_SECONDS;
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

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
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
  url.searchParams.set(AUTO_KEY_SEARCH_PARAM, AUTO_KEY_SEND_TO_BOT_VALUE);
  return url.toString();
}

function corsHeaders(request: Request, env: BotConfig): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  const miniAppOrigin = new URL(env.MINI_APP_URL).origin;
  if (origin === miniAppOrigin) {
    headers.set('access-control-allow-origin', origin);
  }
  headers.set('access-control-allow-methods', 'POST, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('access-control-max-age', '86400');
  return headers;
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
