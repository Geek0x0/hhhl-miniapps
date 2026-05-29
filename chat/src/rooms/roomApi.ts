import type { EndpointCaller } from '@/api/endpointTypes';
import type { PaginationParams, RoomSummary, UserSummary } from '@/shared/types';

export interface RoomCreateParams {
  name: string;
  description?: string;
  joinMode: string;
}

export interface RoomUpdateParams {
  name?: string;
  description?: string;
  joinMode?: string;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function normalizeRoomSummary(value: unknown): RoomSummary {
  const container = value as { room?: unknown };
  const raw = (container.room != null && typeof container.room === 'object' ? container.room : value) as Record<string, unknown>;
  const fallback = value as Record<string, unknown>;
  const id = stringField(raw.id) ?? stringField(raw.roomId) ?? stringField(fallback.roomId) ?? stringField(fallback.id) ?? stringField(raw._id) ?? '';
  const name = stringField(raw.name) ?? stringField(raw.title) ?? stringField(raw.displayName) ?? stringField(raw.roomName) ?? id;

  return {
    ...(raw as Partial<RoomSummary>),
    id,
    name,
    description: stringField(raw.description) ?? stringField(raw.summary) ?? null,
    avatarUrl: stringField(raw.avatarUrl) ?? stringField(raw.iconUrl) ?? null,
    joinMode: stringField(raw.joinMode),
  };
}

function normalizeRooms(values: unknown): RoomSummary[] {
  return Array.isArray(values) ? values.map(normalizeRoomSummary).filter((room) => room.id !== '') : [];
}

function normalizeInvitation(value: unknown) {
  const raw = value as { id?: unknown; room?: unknown; roomId?: unknown };
  return {
    ...raw,
    id: stringField(raw.id) ?? '',
    room: raw.room == null ? null : normalizeRoomSummary(raw.room),
    roomId: stringField(raw.roomId) ?? undefined,
  };
}

function normalizeInvitations(values: unknown) {
  return Array.isArray(values) ? values.map(normalizeInvitation).filter((invitation) => invitation.id !== '') : [];
}

export function createRoomApi(client: EndpointCaller) {
  return {
    joining: async (params: PaginationParams = {}) => normalizeRooms(await client.callEndpoint<unknown>('chat/rooms/joining', params)),
    owned: async (params: PaginationParams = {}) => normalizeRooms(await client.callEndpoint<unknown>('chat/rooms/owned', params)),
    invitationsInbox: (params: PaginationParams = {}) =>
      client.callEndpoint<unknown>('chat/rooms/invitations/inbox', params).then(normalizeInvitations),
    invitationsOutbox: (roomId: string, params: PaginationParams = {}) =>
      client.callEndpoint<unknown[]>('chat/rooms/invitations/outbox', { roomId, ...params }),
    createInvitation: (roomId: string) => client.callEndpoint('chat/rooms/invitations/create', { roomId }),
    ignoreInvitation: (invitationId: string) => client.callEndpoint('chat/rooms/invitations/ignore', { invitationId }),
    show: async (roomId: string) => normalizeRoomSummary(await client.callEndpoint<unknown>('chat/rooms/show', { roomId })),
    join: async (roomId: string) => normalizeRoomSummary(await client.callEndpoint<unknown>('chat/rooms/join', { roomId })),
    leave: (roomId: string) => client.callEndpoint('chat/rooms/leave', { roomId }),
    create: async (params: RoomCreateParams) => normalizeRoomSummary(await client.callEndpoint<unknown>('chat/rooms/create', params)),
    update: (roomId: string, params: RoomUpdateParams) =>
      client.callEndpoint<unknown>('chat/rooms/update', { roomId, ...params }).then(normalizeRoomSummary),
    delete: (roomId: string) => client.callEndpoint('chat/rooms/delete', { roomId }),
    mute: (roomId: string) => client.callEndpoint('chat/rooms/mute', { roomId }),
    members: (roomId: string, params: PaginationParams = {}) =>
      client.callEndpoint<UserSummary[]>('chat/rooms/members', { roomId, ...params }),
  };
}
