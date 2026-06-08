import type { HhhlChatMessage, HhhlDriveFile, HhhlUser } from '../hhhl/types';
import type { MessageMapState } from '../state/schemas';

type TelegramChatId = number | string;

const TELEGRAM_TEXT_LIMIT = 4096;
const TELEGRAM_CAPTION_LIMIT = 1024;
const TRUNCATION_SUFFIX = '...';

export interface OutboundTelegramSendOptions {
  caption?: string;
  replyToMessageId?: number;
}

export interface OutboundTelegramSendResult {
  messageId: number;
}

export interface OutboundTelegramApi {
  sendMessage(
    chatId: TelegramChatId,
    text: string,
    options?: Pick<OutboundTelegramSendOptions, 'replyToMessageId'>,
  ): Promise<OutboundTelegramSendResult>;
  sendPhoto(
    chatId: TelegramChatId,
    photo: string,
    options?: OutboundTelegramSendOptions,
  ): Promise<OutboundTelegramSendResult>;
  sendDocument(
    chatId: TelegramChatId,
    document: string,
    options?: OutboundTelegramSendOptions,
  ): Promise<OutboundTelegramSendResult>;
  sendVideo(
    chatId: TelegramChatId,
    video: string,
    options?: OutboundTelegramSendOptions,
  ): Promise<OutboundTelegramSendResult>;
  sendVoice(
    chatId: TelegramChatId,
    voice: string,
    options?: OutboundTelegramSendOptions,
  ): Promise<OutboundTelegramSendResult>;
}

export interface OutboundStateStore {
  getMessageMapByHhhl(roomId: string, hhhlMessageId: string): Promise<MessageMapState | null>;
  putMessageMap(map: MessageMapState): Promise<void>;
  updateLastSeen(telegramUserId: string, messageId: string): Promise<void>;
}

export interface ForwardHhhlMessageToTelegramOptions {
  message: HhhlChatMessage;
  telegramUserId: string;
  chatId: TelegramChatId;
  state: OutboundStateStore;
  telegram: OutboundTelegramApi;
  hhhlBotUserId: string;
  now?: () => string;
}

type FileMethod = 'photo' | 'video' | 'voice' | 'document';

interface ReplyContext {
  replyToMessageId?: number;
  quotePrefix?: string;
}

function currentTime(now: (() => string) | undefined): string {
  return now == null ? new Date().toISOString() : now();
}

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text == null || text === '' ? null : text;
}

function authorName(user: HhhlUser | null | undefined): string {
  return trimmed(user?.username) ?? trimmed(user?.name) ?? 'HHHL';
}

function formattedText(message: HhhlChatMessage): string | null {
  const body = trimmed(message.text);
  return body == null ? null : `${authorName(message.user)}: ${body}`;
}

function fileName(file: HhhlDriveFile | null | undefined): string | null {
  return trimmed(file?.name);
}

function fallbackBody(message: HhhlChatMessage): string {
  return formattedText(message) ?? fileName(message.file) ?? authorName(message.user);
}

function truncateTelegramText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - TRUNCATION_SUFFIX.length))}${TRUNCATION_SUFFIX}`;
}

function messageOptions(replyToMessageId: number | undefined): Pick<OutboundTelegramSendOptions, 'replyToMessageId'> | undefined {
  return replyToMessageId === undefined ? undefined : { replyToMessageId };
}

function mediaOptions(caption: string | null, replyToMessageId: number | undefined): OutboundTelegramSendOptions | undefined {
  const options: OutboundTelegramSendOptions = {};
  if (caption != null && caption !== '') {
    options.caption = caption;
  }
  if (replyToMessageId !== undefined) {
    options.replyToMessageId = replyToMessageId;
  }

  return Object.keys(options).length === 0 ? undefined : options;
}

function fileMethod(file: HhhlDriveFile): FileMethod {
  const type = (file.type ?? '').toLowerCase();
  if (type.startsWith('image/')) return 'photo';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/ogg') || type.startsWith('audio/opus') || type.includes('voice')) return 'voice';
  return 'document';
}

function sameHhhlMessage(map: MessageMapState | null, roomId: string, hhhlMessageId: string): map is MessageMapState {
  return map != null && map.roomId === roomId && map.hhhlMessageId === hhhlMessageId;
}

async function resolveReplyContext(options: ForwardHhhlMessageToTelegramOptions): Promise<ReplyContext> {
  const refs = [
    { id: trimmed(options.message.replyId), message: options.message.reply },
    { id: trimmed(options.message.quoteId), message: options.message.quote },
  ];

  for (const ref of refs) {
    if (ref.id == null) continue;

    const map = await options.state.getMessageMapByHhhl(options.message.roomId, ref.id);
    if (sameHhhlMessage(map, options.message.roomId, ref.id)) {
      return { replyToMessageId: map.telegramMessageId };
    }
  }

  for (const ref of refs) {
    const body = trimmed(ref.message?.text);
    if (body != null) {
      return { quotePrefix: `引用：${authorName(ref.message?.user)}: ${body}\n` };
    }
  }

  return {};
}

async function putCreatedMessageMap(
  options: ForwardHhhlMessageToTelegramOptions,
  sent: OutboundTelegramSendResult,
): Promise<void> {
  await options.state.putMessageMap({
    version: 1,
    roomId: options.message.roomId,
    hhhlMessageId: options.message.id,
    telegramUserId: options.telegramUserId,
    telegramMessageId: sent.messageId,
    createdAt: currentTime(options.now),
  });
}

async function sendText(
  options: ForwardHhhlMessageToTelegramOptions,
  replyContext: ReplyContext,
): Promise<OutboundTelegramSendResult> {
  const text = truncateTelegramText(`${replyContext.quotePrefix ?? ''}${fallbackBody(options.message)}`, TELEGRAM_TEXT_LIMIT);
  const sendOptions = messageOptions(replyContext.replyToMessageId);
  return sendOptions === undefined
    ? options.telegram.sendMessage(options.chatId, text)
    : options.telegram.sendMessage(options.chatId, text, sendOptions);
}

async function sendFile(
  options: ForwardHhhlMessageToTelegramOptions,
  file: HhhlDriveFile,
  url: string,
  replyContext: ReplyContext,
): Promise<OutboundTelegramSendResult> {
  const caption = truncateTelegramText(
    `${replyContext.quotePrefix ?? ''}${formattedText(options.message) ?? fileName(file) ?? ''}`,
    TELEGRAM_CAPTION_LIMIT,
  );
  const sendOptions = mediaOptions(caption, replyContext.replyToMessageId);

  switch (fileMethod(file)) {
    case 'photo':
      return sendOptions === undefined
        ? options.telegram.sendPhoto(options.chatId, url)
        : options.telegram.sendPhoto(options.chatId, url, sendOptions);
    case 'video':
      return sendOptions === undefined
        ? options.telegram.sendVideo(options.chatId, url)
        : options.telegram.sendVideo(options.chatId, url, sendOptions);
    case 'voice':
      return sendOptions === undefined
        ? options.telegram.sendVoice(options.chatId, url)
        : options.telegram.sendVoice(options.chatId, url, sendOptions);
    case 'document':
      return sendOptions === undefined
        ? options.telegram.sendDocument(options.chatId, url)
        : options.telegram.sendDocument(options.chatId, url, sendOptions);
  }
}

export async function forwardHhhlMessageToTelegram(options: ForwardHhhlMessageToTelegramOptions): Promise<void> {
  if (options.message.user?.id === options.hhhlBotUserId) {
    await options.state.updateLastSeen(options.telegramUserId, options.message.id);
    return;
  }

  const existingMap = await options.state.getMessageMapByHhhl(options.message.roomId, options.message.id);
  if (sameHhhlMessage(existingMap, options.message.roomId, options.message.id)) {
    await options.state.updateLastSeen(options.telegramUserId, options.message.id);
    return;
  }

  const replyContext = await resolveReplyContext(options);
  const file = options.message.file;
  const fileUrl = trimmed(file?.url);
  const sent = file != null && fileUrl != null ? await sendFile(options, file, fileUrl, replyContext) : await sendText(options, replyContext);

  await putCreatedMessageMap(options, sent);
  await options.state.updateLastSeen(options.telegramUserId, options.message.id);
}
