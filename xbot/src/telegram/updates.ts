import type { TelegramMedia, TelegramMessage, TelegramMessageKind, TelegramUpdate } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function integerField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function positiveIntegerField(value: unknown): number | undefined {
  const integer = integerField(value);
  return integer != null && integer > 0 ? integer : undefined;
}

function idField(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  return stringField(value);
}

function updateIdField(value: unknown): number | undefined {
  const integer = integerField(value);
  return integer != null && integer >= 0 ? integer : undefined;
}

function assignDefined<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value;
}

function baseMedia(raw: Record<string, unknown>): TelegramMedia | null {
  const fileId = stringField(raw.file_id);
  if (fileId == null) return null;

  const media: TelegramMedia = { fileId };
  assignDefined(media, 'fileName', stringField(raw.file_name));
  assignDefined(media, 'mimeType', stringField(raw.mime_type));
  assignDefined(media, 'fileSize', positiveIntegerField(raw.file_size));
  assignDefined(media, 'width', positiveIntegerField(raw.width));
  assignDefined(media, 'height', positiveIntegerField(raw.height));
  assignDefined(media, 'duration', positiveIntegerField(raw.duration));
  return media;
}

function mediaFrom(raw: Record<string, unknown>, key: 'document' | 'video' | 'voice'): TelegramMedia | null {
  const media = raw[key];
  return isRecord(media) ? baseMedia(media) : null;
}

function photoFrom(raw: Record<string, unknown>): TelegramMedia | null {
  const photos = raw.photo;
  if (!Array.isArray(photos)) return null;

  let largest: Record<string, unknown> | null = null;
  let largestRank: number | undefined;

  for (const photo of photos) {
    if (!isRecord(photo)) continue;
    if (stringField(photo.file_id) == null) continue;

    const fileSize = positiveIntegerField(photo.file_size);
    const width = positiveIntegerField(photo.width);
    const height = positiveIntegerField(photo.height);
    const rank = fileSize ?? (width != null && height != null ? width * height : undefined);
    if (largest == null || largestRank == null || (rank != null && rank >= largestRank)) {
      largest = photo;
      largestRank = rank;
    }
  }

  return largest == null ? null : baseMedia(largest);
}

function messageWithMedia(base: TelegramMessage, kind: TelegramMessageKind, media: TelegramMedia): TelegramMessage {
  return { ...base, kind, media };
}

export function parseTelegramUpdate(value: unknown): TelegramUpdate | null {
  if (!isRecord(value)) return null;

  const updateId = updateIdField(value.update_id);
  if (updateId == null) return null;

  if (value.message == null) return { updateId };
  if (!isRecord(value.message)) return null;

  const messageRaw = value.message;
  const chatRaw = messageRaw.chat;
  const fromRaw = messageRaw.from;
  if (!isRecord(chatRaw) || !isRecord(fromRaw)) return null;

  const messageId = positiveIntegerField(messageRaw.message_id);
  const chatId = idField(chatRaw.id);
  const chatType = stringField(chatRaw.type);
  const fromId = idField(fromRaw.id);

  if (messageId == null || chatId == null || chatType == null || fromId == null) return null;

  const message: TelegramMessage = {
    messageId,
    chatId,
    chatType,
    fromId,
    kind: 'unsupported',
  };
  assignDefined(message, 'text', stringField(messageRaw.text));
  assignDefined(message, 'caption', stringField(messageRaw.caption));

  if (isRecord(messageRaw.reply_to_message)) {
    assignDefined(message, 'replyToMessageId', positiveIntegerField(messageRaw.reply_to_message.message_id));
  }

  const photo = photoFrom(messageRaw);
  if (photo != null) return { updateId, message: messageWithMedia(message, 'photo', photo) };

  const document = mediaFrom(messageRaw, 'document');
  if (document != null) return { updateId, message: messageWithMedia(message, 'document', document) };

  const video = mediaFrom(messageRaw, 'video');
  if (video != null) return { updateId, message: messageWithMedia(message, 'video', video) };

  const voice = mediaFrom(messageRaw, 'voice');
  if (voice != null) return { updateId, message: messageWithMedia(message, 'voice', voice) };

  return { updateId, message: { ...message, kind: message.text == null ? 'unsupported' : 'text' } };
}
