import type { CreateRoomMessageParams, HhhlChatMessage } from '../hhhl/types';
import type { BindingState, MessageMapState } from '../state/schemas';
import type { TelegramMessage } from '../telegram/types';
import { resolveReplyMapping, type ReplyMappingState } from './mapping';

const NO_BINDING_REPLY = '请先使用 /bind <roomId> 绑定 HHHL 聊天室。';
const UNSUPPORTED_REPLY = '暂不支持这类 Telegram 消息。';

export interface InboundStateStore extends ReplyMappingState {
  getBinding(telegramUserId: string): Promise<BindingState | null>;
  getMessageMapByTelegram(telegramUserId: string, telegramMessageId: number): Promise<MessageMapState | null>;
  putMessageMap(map: MessageMapState): Promise<void>;
}

export interface InboundHhhlChatApi {
  createToRoom(params: CreateRoomMessageParams): Promise<HhhlChatMessage>;
}

export interface InboundTelegramApi {
  sendMessage(chatId: TelegramMessage['chatId'], text: string): Promise<unknown>;
}

export interface ForwardTelegramMessageToHhhlOptions {
  state: InboundStateStore;
  chatApi: InboundHhhlChatApi;
  telegram: InboundTelegramApi;
  driveApi: null | unknown;
  telegramUserId: string;
  message: TelegramMessage;
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

export async function forwardTelegramMessageToHhhl(options: ForwardTelegramMessageToHhhlOptions): Promise<void> {
  const binding = await options.state.getBinding(options.telegramUserId);
  if (binding == null) {
    await options.telegram.sendMessage(options.message.chatId, NO_BINDING_REPLY);
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
  await options.state.putMessageMap({
    version: 1,
    roomId: binding.roomId,
    hhhlMessageId: created.id,
    telegramUserId: options.telegramUserId,
    telegramMessageId: options.message.messageId,
    createdAt: currentTime(options.now),
  });
}
