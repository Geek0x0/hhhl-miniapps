import type { CreateRoomMessageParams, HhhlChatMessage, HhhlDriveFile } from '../hhhl/types';
import type { BindingState, MessageMapState } from '../state/schemas';
import type { TelegramMessage } from '../telegram/types';
import { resolveReplyMapping, type ReplyMappingState } from './mapping';

const NO_BINDING_REPLY = '请先使用 /bind <roomId> 绑定 HHHL 聊天室。';
const UNSUPPORTED_REPLY = '暂不支持这类 Telegram 消息。';
const MEDIA_FAILURE_REPLY = '媒体发送失败';

export interface InboundStateStore extends ReplyMappingState {
  getBinding(telegramUserId: string): Promise<BindingState | null>;
  getMessageMapByTelegram(telegramUserId: string, telegramMessageId: number): Promise<MessageMapState | null>;
  putMessageMap(map: MessageMapState): Promise<void>;
}

export interface InboundHhhlChatApi {
  createToRoom(params: CreateRoomMessageParams): Promise<HhhlChatMessage>;
}

export interface InboundDriveApi {
  upload(params: { blob: Blob; name: string; type: string }): Promise<HhhlDriveFile>;
}

export interface InboundTelegramApi {
  sendMessage(chatId: TelegramMessage['chatId'], text: string): Promise<unknown>;
}

export interface ForwardTelegramMessageToHhhlOptions {
  state: InboundStateStore;
  chatApi: InboundHhhlChatApi;
  telegram: InboundTelegramApi;
  driveApi: InboundDriveApi | null;
  mediaDownloader?: (message: TelegramMessage) => Promise<{ blob: Blob; name: string; type: string }>;
  telegramUserId: string;
  message: TelegramMessage;
  onError?: (error: unknown) => void;
  now?: () => string;
}

function currentTime(now: (() => string) | undefined): string {
  return now == null ? new Date().toISOString() : now();
}

function textPayload(message: TelegramMessage): string | null {
  if (message.kind !== 'text' || message.text == null) return null;
  const text = message.text.trim();
  return text === '' ? null : text;
}

function captionPayload(message: TelegramMessage): string | null {
  const caption = message.caption?.trim();
  return caption == null || caption === '' ? null : caption;
}

async function putCreatedMessageMap(
  options: ForwardTelegramMessageToHhhlOptions,
  roomId: string,
  created: HhhlChatMessage,
): Promise<void> {
  await options.state.putMessageMap({
    version: 1,
    roomId,
    hhhlMessageId: created.id,
    telegramUserId: options.telegramUserId,
    telegramMessageId: options.message.messageId,
    createdAt: currentTime(options.now),
  });
}

export async function forwardTelegramMessageToHhhl(options: ForwardTelegramMessageToHhhlOptions): Promise<void> {
  const binding = await options.state.getBinding(options.telegramUserId);
  if (binding == null) {
    await options.telegram.sendMessage(options.message.chatId, NO_BINDING_REPLY);
    return;
  }

  if (options.message.media != null) {
    if (options.driveApi == null || options.mediaDownloader == null) {
      await options.telegram.sendMessage(options.message.chatId, UNSUPPORTED_REPLY);
      return;
    }

    const existingMap = await options.state.getMessageMapByTelegram(options.telegramUserId, options.message.messageId);
    if (existingMap?.roomId === binding.roomId) return;

    const replyId = await resolveReplyMapping(
      options.state,
      options.telegramUserId,
      binding.roomId,
      options.message.replyToMessageId,
    );
    const caption = captionPayload(options.message);

    let created: HhhlChatMessage;
    try {
      const downloaded = await options.mediaDownloader(options.message);
      const uploaded = await options.driveApi.upload(downloaded);
      const params: CreateRoomMessageParams = { toRoomId: binding.roomId, fileId: uploaded.id };
      if (caption !== null) {
        params.text = caption;
      }
      if (replyId !== undefined) {
        params.replyId = replyId;
        params.quoteId = replyId;
      }

      created = await options.chatApi.createToRoom(params);
    } catch (error) {
      options.onError?.(error);
      await options.telegram.sendMessage(options.message.chatId, MEDIA_FAILURE_REPLY);
      return;
    }

    await putCreatedMessageMap(options, binding.roomId, created);
    return;
  }

  const text = textPayload(options.message);
  if (text == null) {
    await options.telegram.sendMessage(options.message.chatId, UNSUPPORTED_REPLY);
    return;
  }

  const existingMap = await options.state.getMessageMapByTelegram(options.telegramUserId, options.message.messageId);
  if (existingMap?.roomId === binding.roomId) return;

  const replyId = await resolveReplyMapping(
    options.state,
    options.telegramUserId,
    binding.roomId,
    options.message.replyToMessageId,
  );
  const params: CreateRoomMessageParams = { toRoomId: binding.roomId, text };
  if (replyId !== undefined) {
    params.replyId = replyId;
    params.quoteId = replyId;
  }

  const created = await options.chatApi.createToRoom(params);
  await putCreatedMessageMap(options, binding.roomId, created);
}
