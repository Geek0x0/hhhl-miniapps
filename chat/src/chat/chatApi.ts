import type { EndpointCaller } from '@/api/endpointTypes';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import type { ChatMessage, PaginationParams, UserSummary } from '@/shared/types';

export interface CreateRoomMessageParams {
  toRoomId: string;
  text?: string;
  fileId?: string;
  replyId?: string;
  quoteId?: string;
}

export interface SearchMessagesParams extends PaginationParams {
  query: string;
  roomId?: string;
  userId?: string;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function stringLikeField(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return stringField(value);
}

function numberField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function recordField(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringFrom(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringLikeField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function recordFrom(raw: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = recordField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function arrayFirstFrom(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
  }

  return null;
}

function urlField(value: unknown): string | null {
  const url = stringField(value);
  if (url == null) {
    return null;
  }

  if (/^(?:https?:|blob:|data:)/.test(url)) {
    return url;
  }

  return url.startsWith('/') ? `${DC_HHHL_ORIGIN}${url}` : url;
}

function urlFrom(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = urlField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function normalizeUserSummary(value: unknown): UserSummary | null {
  if (typeof value === 'string' && value.trim() !== '') {
    const id = value.trim();
    return { id, username: id, name: null, avatarUrl: null };
  }

  const raw = recordField(value);
  if (raw == null) {
    return null;
  }

  const nested = recordFrom(raw, ['user', 'account', 'profile']);
  const source = nested == null ? raw : { ...raw, ...nested };
  const id = stringFrom(source, ['id', 'userId', 'fromUserId', 'senderId', 'authorId', 'accountId', 'username', 'acct']) ?? '';
  const name = stringFrom(source, ['name', 'displayName', 'display_name', 'nickname', 'nick', 'screenName']);
  const username = stringFrom(source, ['username', 'userName', 'acct', 'handle', 'screenName']) ?? name ?? id;

  if (id === '' && username === '') {
    return null;
  }

  return {
    id: id === '' ? username : id,
    username,
    name,
    avatarUrl: urlFrom(source, ['avatarUrl', 'avatarURL', 'avatarUri', 'avatar', 'iconUrl', 'imageUrl', 'photoUrl', 'photoURL']),
  };
}

function normalizeDriveFile(value: unknown, fallback: Record<string, unknown>): ChatMessage['file'] {
  const raw = recordField(value) ?? (typeof value === 'string' ? { id: value, name: value } : null);
  if (raw == null && stringFrom(fallback, ['fileId', 'driveFileId', 'attachmentId', 'fileName', 'filename']) == null) {
    return null;
  }

  const source = raw ?? fallback;
  const id = stringFrom(source, raw == null ? ['fileId', 'driveFileId', 'attachmentId'] : ['id', 'fileId', 'driveFileId', 'attachmentId']);
  const name = stringFrom(source, ['name', 'fileName', 'filename', 'originalName', 'title']) ?? id;

  if (id == null && name == null) {
    return null;
  }

  return {
    id: id ?? name ?? '',
    name: name ?? id ?? '',
    type: stringFrom(source, ['type', 'mimeType', 'contentType', 'mediaType']),
    size: numberField(source.size ?? source.byteSize ?? source.length),
    url: urlFrom(source, ['url', 'src', 'downloadUrl', 'downloadURL', 'webpublicUrl', 'webUrl']),
    thumbnailUrl: urlFrom(source, ['thumbnailUrl', 'thumbnailURL', 'thumbnail', 'previewUrl', 'previewURL']),
  };
}

function embeddedMessage(raw: Record<string, unknown>, keys: string[], depth: number): ChatMessage | null {
  if (depth >= 2) {
    return null;
  }

  const source = recordFrom(raw, keys);
  if (source == null) {
    return null;
  }

  const message = normalizeChatMessage(source, depth + 1);
  return message.id === '' && message.text == null && message.file == null ? null : message;
}

function unwrapMessage(value: unknown): Record<string, unknown> {
  const raw = recordField(value) ?? {};
  if (stringFrom(raw, ['id', 'messageId', 'chatMessageId']) != null) {
    return raw;
  }

  const nested = recordFrom(raw, ['message', 'chatMessage']);
  return nested ?? raw;
}

export function normalizeChatMessage(value: unknown, depth = 0): ChatMessage {
  const raw = unwrapMessage(value);
  const nestedUser = raw.user ?? raw.fromUser ?? raw.sender ?? raw.author ?? raw.account ?? raw.createdBy ?? raw.createdByUser;
  const user = normalizeUserSummary(nestedUser) ?? normalizeUserSummary({
    id: raw.userId ?? raw.fromUserId ?? raw.senderId ?? raw.authorId,
    username: raw.username ?? raw.fromUserUsername ?? raw.senderUsername ?? raw.authorUsername,
    name: raw.name ?? raw.userName ?? raw.fromUserName ?? raw.senderName ?? raw.authorName,
    avatarUrl: raw.avatarUrl ?? raw.userAvatarUrl ?? raw.fromUserAvatarUrl ?? raw.senderAvatarUrl,
  });
  const fileSource = raw.file ?? raw.attachment ?? raw.driveFile ?? arrayFirstFrom(raw, ['files', 'attachments']);
  const replyId = stringFrom(raw, ['replyId', 'replyToId', 'replyMessageId']);
  const quoteId = stringFrom(raw, ['quoteId', 'quoteMessageId']);

  return {
    ...(raw as Partial<ChatMessage>),
    id: stringFrom(raw, ['id', 'messageId', 'chatMessageId']) ?? '',
    roomId: stringFrom(raw, ['roomId', 'toRoomId']) ?? stringFrom(recordFrom(raw, ['room', 'toRoom']) ?? {}, ['id']) ?? '',
    createdAt: stringFrom(raw, ['createdAt', 'created_at', 'created']) ?? new Date().toISOString(),
    text: stringFrom(raw, ['text', 'body', 'content', 'message']),
    user,
    file: normalizeDriveFile(fileSource, raw),
    replyId,
    reply: embeddedMessage(raw, ['reply', 'replyTo', 'replyMessage'], depth),
    quoteId,
    quote: embeddedMessage(raw, ['quote', 'quoteMessage'], depth),
  };
}

function normalizeMessages(values: unknown): ChatMessage[] {
  const raw = recordField(values);
  let items: unknown[] = [];

  if (Array.isArray(values)) {
    items = values;
  } else if (raw != null) {
    for (const key of ['messages', 'items', 'data', 'timeline']) {
      if (Array.isArray(raw[key])) {
        items = raw[key] as unknown[];
        break;
      }
    }
  }

  return items.map((item) => normalizeChatMessage(item)).filter((message) => message.id !== '');
}

export function createChatApi(client: EndpointCaller) {
  return {
    roomTimeline: (roomId: string, params: PaginationParams = {}) =>
      client.callEndpoint<unknown>('chat/messages/room-timeline', { roomId, ...params }).then(normalizeMessages),
    createToRoom: (params: CreateRoomMessageParams) =>
      client.callEndpoint<unknown>('chat/messages/create-to-room', params).then(normalizeChatMessage),
    delete: (messageId: string) => client.callEndpoint('chat/messages/delete', { messageId }),
    react: (messageId: string, reaction: string) => client.callEndpoint('chat/messages/react', { messageId, reaction }),
    unreact: (messageId: string) => client.callEndpoint('chat/messages/unreact', { messageId }),
    search: (params: SearchMessagesParams) => client.callEndpoint<unknown>('chat/messages/search', params).then(normalizeMessages),
    show: (messageId: string) => client.callEndpoint<unknown>('chat/messages/show', { messageId }).then(normalizeChatMessage),
    context: (messageId: string) => client.callEndpoint<unknown>('chat/messages/context', { messageId }).then(normalizeMessages),
  };
}
