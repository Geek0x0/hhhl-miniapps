import type { MessageMapState } from '../state/schemas';

export interface ReplyMappingState {
  getMessageMapByTelegram(telegramUserId: string, telegramMessageId: number): Promise<MessageMapState | null>;
}

export async function resolveReplyMapping(
  state: ReplyMappingState,
  telegramUserId: string,
  roomId: string,
  replyToMessageId: number | undefined,
): Promise<string | undefined> {
  if (replyToMessageId === undefined) return undefined;

  const map = await state.getMessageMapByTelegram(telegramUserId, replyToMessageId);
  if (map == null || map.roomId !== roomId) return undefined;

  return map.hhhlMessageId;
}
