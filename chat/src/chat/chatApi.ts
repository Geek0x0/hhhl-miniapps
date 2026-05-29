import type { EndpointCaller } from '@/api/endpointTypes';
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

function normalizeUserSummary(value: unknown): UserSummary | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const id = stringField(raw.id) ?? stringField(raw.userId) ?? stringField(raw.username) ?? '';
  const name = stringField(raw.name) ?? stringField(raw.displayName) ?? stringField(raw.nickname);
  const username = stringField(raw.username) ?? name ?? id;

  if (id === '' && username === '') {
    return null;
  }

  return {
    id: id === '' ? username : id,
    username,
    name,
    avatarUrl: stringField(raw.avatarUrl) ?? stringField(raw.avatar) ?? stringField(raw.iconUrl),
  };
}

export function normalizeChatMessage(value: unknown): ChatMessage {
  const raw = value as Record<string, unknown>;
  const nestedUser = raw.user ?? raw.sender ?? raw.author ?? raw.account ?? raw.createdBy;
  const user = normalizeUserSummary(nestedUser) ?? normalizeUserSummary({
    id: raw.userId ?? raw.senderId ?? raw.authorId,
    username: raw.username,
    name: raw.name ?? raw.userName ?? raw.senderName ?? raw.authorName,
    avatarUrl: raw.avatarUrl ?? raw.userAvatarUrl ?? raw.senderAvatarUrl,
  });

  return {
    ...(raw as Partial<ChatMessage>),
    id: stringField(raw.id) ?? stringField(raw.messageId) ?? '',
    roomId: stringField(raw.roomId) ?? stringField(raw.toRoomId) ?? '',
    createdAt: stringField(raw.createdAt) ?? stringField(raw.created_at) ?? new Date().toISOString(),
    text: stringField(raw.text) ?? stringField(raw.body) ?? stringField(raw.content),
    user,
  };
}

function normalizeMessages(values: unknown): ChatMessage[] {
  return Array.isArray(values) ? values.map(normalizeChatMessage).filter((message) => message.id !== '') : [];
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
