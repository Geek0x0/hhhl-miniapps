import { readConfig } from './config';
import { executeBridgeCommand } from './bridge/commands';
import { forwardTelegramMessageToHhhl } from './bridge/inbound';
import type { AppConfig, Env } from './env';
import { HhhlApiClient } from './hhhl/apiClient';
import { createHhhlChatApi } from './hhhl/chatApi';
import { createHhhlDriveApi } from './hhhl/driveApi';
import { redactSensitiveText } from './security/redact';
import { createKeys } from './state/keys';
import { KvStateStore } from './state/kvStore';
import { TelegramApi } from './telegram/api';
import { commandHelpText, parseCommand, type BotCommand } from './telegram/commands';
import { downloadTelegramMedia } from './telegram/media';
import type { TelegramMessage } from './telegram/types';
import { parseTelegramUpdate } from './telegram/updates';

const UNKNOWN_COMMAND_REPLY = '未知命令。发送 /help 查看帮助。';
const TELEGRAM_WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

function json(value: unknown, init?: ResponseInit): Response {
  return Response.json(value, init);
}

function isHealthRequest(request: Request, pathname: string): boolean {
  return request.method === 'GET' && (pathname === '/' || pathname === '/health');
}

function isWebhookRequest(request: Request, pathname: string): boolean {
  return request.method === 'POST' && (pathname === '/' || pathname === '/webhook');
}

type JsonParseResult = { ok: true; value: unknown } | { ok: false };

async function parseJson(request: Request): Promise<JsonParseResult> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

async function routedReplyText(
  command: BotCommand,
  telegramUserId: string,
  env: Env,
  config: AppConfig,
): Promise<string> {
  switch (command.type) {
    case 'help':
      return commandHelpText;
    case 'invalid':
      return command.reason;
    case 'unknown':
      return UNKNOWN_COMMAND_REPLY;
    case 'bind':
    case 'unbind':
    case 'rename':
    case 'list':
    case 'status':
      return executeBridgeCommand(command, {
        config,
        env,
        telegramUserId,
      });
  }
}

function shouldProcessMessage(message: TelegramMessage, config: AppConfig): boolean {
  return message.chatType === 'private' && String(message.fromId) === config.allowedTelegramUserId;
}

function redactionSecrets(config: AppConfig): string[] {
  return [config.botToken, config.botWebhookSecret, config.hhhlToken, config.hhhlOrigin, config.hhhlApiBaseUrl];
}

function logTelegramSendFailure(error: unknown, config: AppConfig): void {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = redactSensitiveText(message, redactionSecrets(config));
  console.error('telegram send failed', redacted);
}

function logInboundFailure(error: unknown, config: AppConfig): void {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = redactSensitiveText(message, redactionSecrets(config));
  console.error('inbound forwarding failed', redacted);
}

function scheduleWebhookWork(ctx: ExecutionContext, work: Promise<void>): Promise<void> | undefined {
  if (typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(work);
    return undefined;
  }

  return work;
}

function hasValidWebhookHeader(request: Request, config: AppConfig): boolean {
  return request.headers.get(TELEGRAM_WEBHOOK_SECRET_HEADER) === config.botWebhookSecret;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTelegramUpdateEnvelope(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.update_id === 'number' && Number.isInteger(value.update_id) && value.update_id >= 0;
}

async function sendRoutedReply(
  message: TelegramMessage,
  command: BotCommand,
  env: Env,
  config: AppConfig,
): Promise<void> {
  const telegram = new TelegramApi(config.botToken);
  try {
    await telegram.sendMessage(message.chatId, await routedReplyText(command, String(message.fromId), env, config), {
      replyToMessageId: message.messageId,
    });
  } catch (error) {
    logTelegramSendFailure(error, config);
  }
}

async function forwardInboundMessage(message: TelegramMessage, env: Env, config: AppConfig): Promise<void> {
  const telegram = new TelegramApi(config.botToken);
  const hhhlClient = new HhhlApiClient({
    baseUrl: config.hhhlApiBaseUrl,
    token: config.hhhlToken,
  });

  try {
    await forwardTelegramMessageToHhhl({
      state: new KvStateStore(env.XBOT_STATE, createKeys(config.kvKeyPrefix)),
      chatApi: createHhhlChatApi(hhhlClient),
      telegram,
      driveApi: createHhhlDriveApi(hhhlClient),
      mediaDownloader: (downloadMessage) => {
        if (downloadMessage.media == null) throw new Error('Telegram 消息没有媒体文件。');
        return downloadTelegramMedia(telegram, downloadMessage.media, downloadMessage.kind);
      },
      telegramUserId: String(message.fromId),
      message,
      onError: (error) => logInboundFailure(error, config),
    });
  } catch (error) {
    logInboundFailure(error, config);
  }
}

async function processAuthorizedMessage(message: TelegramMessage, env: Env, config: AppConfig): Promise<void> {
  const command = message.text == null ? null : parseCommand(message.text);
  if (command == null) {
    await forwardInboundMessage(message, env, config);
    return;
  }

  await sendRoutedReply(message, command, env, config);
}

async function processWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const config = readConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, { status: 500 });
  if (!hasValidWebhookHeader(request, config.value)) {
    return json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await parseJson(request);
  if (!body.ok) return json({ ok: false, error: 'invalid json' }, { status: 400 });

  const update = parseTelegramUpdate(body.value);
  if (update == null) {
    return isTelegramUpdateEnvelope(body.value) ? json({ ok: true }) : json({ ok: false, error: 'invalid update' }, { status: 400 });
  }
  if (update.message == null) return json({ ok: true });
  if (!shouldProcessMessage(update.message, config.value)) return json({ ok: true });

  const pendingWork = scheduleWebhookWork(ctx, processAuthorizedMessage(update.message, env, config.value));
  if (pendingWork != null) await pendingWork;

  return json({ ok: true });
}

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (isHealthRequest(request, url.pathname)) {
    return json({ ok: true, service: 'xbot' });
  }

  if (isWebhookRequest(request, url.pathname)) {
    return processWebhook(request, env, ctx);
  }

  return json({ ok: false, error: 'not found' }, { status: 404 });
}
