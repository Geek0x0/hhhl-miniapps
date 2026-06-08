import { readConfig } from './config';
import type { AppConfig, Env } from './env';
import { redactSensitiveText } from './security/redact';
import { TelegramApi } from './telegram/api';
import { commandHelpText, parseCommand } from './telegram/commands';
import type { TelegramMessage } from './telegram/types';
import { parseTelegramUpdate } from './telegram/updates';

const PLACEHOLDER_REPLY = '命令处理中断：该功能还没有接入。';
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

function routedReplyText(message: TelegramMessage): string {
  const command = message.text == null ? null : parseCommand(message.text);

  if (command == null) return PLACEHOLDER_REPLY;
  if (command.type === 'help') return commandHelpText;
  if (command.type === 'invalid') return command.reason;
  if (command.type === 'unknown') return UNKNOWN_COMMAND_REPLY;
  return PLACEHOLDER_REPLY;
}

function shouldProcessMessage(message: TelegramMessage, config: AppConfig): boolean {
  return message.chatType === 'private' && String(message.fromId) === config.allowedTelegramUserId;
}

function logTelegramSendFailure(error: unknown, config: AppConfig): void {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = redactSensitiveText(message, [config.botToken, config.botWebhookSecret, config.hhhlToken]);
  console.error('telegram send failed', redacted);
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

async function processWebhook(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

  const telegram = new TelegramApi(config.value.botToken);
  try {
    await telegram.sendMessage(update.message.chatId, routedReplyText(update.message), {
      replyToMessageId: update.message.messageId,
    });
  } catch (error) {
    logTelegramSendFailure(error, config.value);
  }

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
