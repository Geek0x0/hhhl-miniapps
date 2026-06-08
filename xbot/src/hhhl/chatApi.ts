import { normalizeDriveFile } from './driveApi';
import type {
  CreateRoomMessageParams,
  EndpointParams,
  HhhlChatMessage,
  HhhlEndpointCaller,
  HhhlMessageReaction,
  HhhlRoom,
  HhhlUser,
  PaginationParams,
} from './types';

function recordField(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
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

function booleanField(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
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

function firstArrayFrom(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const raw = recordField(value);
  if (raw == null) {
    return [];
  }

  for (const key of keys) {
    const items = raw[key];
    if (Array.isArray(items)) {
      return items;
    }
  }

  return [];
}

function urlFrom(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

export function normalizeUser(value: unknown): HhhlUser | null {
  if (typeof value === 'string' && value.trim() !== '') {
    const id = value.trim();
    return { id, username: id, name: null, avatarUrl: null, avatarFallbackUrl: null };
  }

  const container = recordField(value);
  if (container == null) {
    return null;
  }

  const nested = recordFrom(container, ['user', 'member', 'account', 'profile']);
  const source = nested == null ? container : { ...container, ...nested };
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
    avatarUrl: urlFrom(source, [
      'avatarUrl',
      'avatarURL',
      'avatarUri',
      'avatarURI',
      'avatar',
      'iconUrl',
      'iconUri',
      'image',
      'imageUrl',
      'photo',
      'photoUrl',
      'photoURL',
      'picture',
      'pictureUrl',
    ]),
    avatarFallbackUrl: urlFrom(source, ['avatarFallbackUrl', 'avatarFallbackURL', 'fallbackAvatarUrl', 'fallbackAvatarURL']),
  };
}

export function normalizeUsers(values: unknown): HhhlUser[] {
  return firstArrayFrom(values, ['users', 'members', 'items', 'data'])
    .map((item) => normalizeUser(item))
    .filter((user): user is HhhlUser => user != null && user.id !== '');
}

export function normalizeRoom(value: unknown): HhhlRoom {
  const fallback = recordField(value) ?? {};
  const raw = recordFrom(fallback, ['room']) ?? fallback;
  const id = stringFrom(raw, ['id', 'roomId', '_id']) ?? stringFrom(fallback, ['roomId', 'id', '_id']) ?? '';
  const name =
    stringFrom(raw, ['name', 'title', 'displayName', 'roomName']) ??
    stringFrom(fallback, ['name', 'title', 'displayName', 'roomName']) ??
    id;

  return {
    id,
    name,
    description: stringFrom(raw, ['description', 'summary']) ?? stringFrom(fallback, ['description', 'summary']),
    avatarUrl: stringFrom(raw, ['avatarUrl', 'avatarURL', 'iconUrl', 'iconURL']) ?? stringFrom(fallback, ['avatarUrl', 'avatarURL', 'iconUrl', 'iconURL']),
    joinMode: stringFrom(raw, ['joinMode']) ?? stringFrom(fallback, ['joinMode']),
  };
}

function normalizeReactionRecord(value: unknown, fallbackReaction?: string): HhhlMessageReaction | null {
  const raw = recordField(value);
  const reaction = stringField(raw?.reaction) ?? stringField(raw?.emoji) ?? stringField(raw?.name) ?? fallbackReaction ?? null;
  const count = numberField(raw?.count ?? raw?.total ?? raw?.value ?? (typeof value === 'number' ? value : null)) ?? 1;

  if (reaction == null || count <= 0) {
    return null;
  }

  return {
    reaction,
    count,
    reacted: booleanField(raw?.reacted ?? raw?.me ?? raw?.own ?? raw?.isMine) ?? false,
  };
}

function normalizeReactions(value: unknown): HhhlMessageReaction[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const reaction = normalizeReactionRecord(item);
      return reaction == null ? [] : [reaction];
    });
  }

  const raw = recordField(value);
  if (raw == null) {
    const single = normalizeReactionRecord(value);
    return single == null ? [] : [single];
  }

  return Object.entries(raw).flatMap(([reactionName, reactionValue]) => {
    const reaction = normalizeReactionRecord(reactionValue, reactionName);
    return reaction == null ? [] : [reaction];
  });
}

function unwrapMessage(value: unknown): Record<string, unknown> {
  const raw = recordField(value) ?? {};
  if (stringFrom(raw, ['id', 'messageId', 'chatMessageId']) != null) {
    return raw;
  }

  return recordFrom(raw, ['message', 'chatMessage']) ?? raw;
}

function embeddedMessage(raw: Record<string, unknown>, keys: string[], depth: number): HhhlChatMessage | null {
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

export function normalizeChatMessage(value: unknown, depth = 0): HhhlChatMessage {
  const raw = unwrapMessage(value);
  const nestedUser = raw.user ?? raw.fromUser ?? raw.sender ?? raw.author ?? raw.account ?? raw.createdBy ?? raw.createdByUser;
  const user =
    normalizeUser(nestedUser) ??
    normalizeUser({
      id: raw.userId ?? raw.fromUserId ?? raw.senderId ?? raw.authorId,
      username: raw.username ?? raw.fromUserUsername ?? raw.senderUsername ?? raw.authorUsername,
      name: raw.name ?? raw.userName ?? raw.fromUserName ?? raw.senderName ?? raw.authorName,
      avatarUrl:
        raw.avatarUrl ??
        raw.avatarURL ??
        raw.avatarUri ??
        raw.avatarURI ??
        raw.avatar ??
        raw.userAvatarUrl ??
        raw.userAvatarURL ??
        raw.fromUserAvatarUrl ??
        raw.fromUserAvatarURL ??
        raw.senderAvatarUrl ??
        raw.senderAvatarURL ??
        raw.userImage ??
        raw.fromUserImage ??
        raw.senderImage ??
        raw.userPhotoUrl ??
        raw.fromUserPhotoUrl ??
        raw.senderPhotoUrl,
    });
  const room = recordFrom(raw, ['room', 'toRoom']);
  const fileSource = raw.file ?? raw.attachment ?? raw.driveFile ?? arrayFirstFrom(raw, ['files', 'attachments']);
  const replyId = stringFrom(raw, ['replyId', 'replyToId', 'replyMessageId']);
  const quoteId = stringFrom(raw, ['quoteId', 'quoteMessageId']);

  return {
    id: stringFrom(raw, ['id', 'messageId', 'chatMessageId']) ?? '',
    roomId: stringFrom(raw, ['roomId', 'toRoomId']) ?? stringFrom(room ?? {}, ['id', 'roomId', '_id']) ?? '',
    createdAt: stringFrom(raw, ['createdAt', 'created_at', 'created']) ?? new Date().toISOString(),
    text: stringFrom(raw, ['text', 'body', 'content', 'message']),
    user,
    file: normalizeDriveFile(fileSource, raw),
    reactions: normalizeReactions(raw.reactions ?? raw.reactionSummary ?? raw.emojiReactions ?? raw.emojis),
    replyId,
    reply: embeddedMessage(raw, ['reply', 'replyTo', 'replyMessage'], depth),
    quoteId,
    quote: embeddedMessage(raw, ['quote', 'quoteMessage'], depth),
  };
}

export function normalizeMessages(values: unknown): HhhlChatMessage[] {
  return firstArrayFrom(values, ['messages', 'items', 'data', 'timeline'])
    .map((item) => normalizeChatMessage(item))
    .filter((message) => message.id !== '');
}

export function createHhhlChatApi(client: HhhlEndpointCaller) {
  return {
    me: async () => requireUser(await client.callEndpoint<unknown>('i')),
    showRoom: async (roomId: string) => normalizeRoom(await client.callEndpoint<unknown>('chat/rooms/show', { roomId })),
    members: async (roomId: string, params: PaginationParams = {}) =>
      normalizeUsers(await client.callEndpoint<unknown>('chat/rooms/members', endpointParams({ roomId, ...params }))),
    roomTimeline: async (roomId: string, params: PaginationParams = {}) =>
      normalizeMessages(await client.callEndpoint<unknown>('chat/messages/room-timeline', endpointParams({ roomId, ...params }))),
    createToRoom: async (params: CreateRoomMessageParams) =>
      normalizeChatMessage(await client.callEndpoint<unknown>('chat/messages/create-to-room', endpointParams(params))),
  };
}

function endpointParams<T extends EndpointParams>(params: T): T {
  return params;
}

function requireUser(value: unknown): HhhlUser {
  const user = normalizeUser(value);
  if (user == null || user.id === '') {
    throw new Error('HHHL me failed with invalid response');
  }

  return user;
}
