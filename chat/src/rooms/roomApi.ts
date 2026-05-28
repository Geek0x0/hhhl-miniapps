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

export function createRoomApi(client: EndpointCaller) {
  return {
    joining: (params: PaginationParams = {}) => client.callEndpoint<RoomSummary[]>('chat/rooms/joining', params),
    owned: (params: PaginationParams = {}) => client.callEndpoint<RoomSummary[]>('chat/rooms/owned', params),
    invitationsInbox: (params: PaginationParams = {}) =>
      client.callEndpoint<unknown[]>('chat/rooms/invitations/inbox', params),
    invitationsOutbox: (roomId: string, params: PaginationParams = {}) =>
      client.callEndpoint<unknown[]>('chat/rooms/invitations/outbox', { roomId, ...params }),
    createInvitation: (roomId: string) => client.callEndpoint('chat/rooms/invitations/create', { roomId }),
    ignoreInvitation: (invitationId: string) => client.callEndpoint('chat/rooms/invitations/ignore', { invitationId }),
    show: (roomId: string) => client.callEndpoint<RoomSummary>('chat/rooms/show', { roomId }),
    join: (roomId: string) => client.callEndpoint<RoomSummary>('chat/rooms/join', { roomId }),
    leave: (roomId: string) => client.callEndpoint('chat/rooms/leave', { roomId }),
    create: (params: RoomCreateParams) => client.callEndpoint<RoomSummary>('chat/rooms/create', params),
    update: (roomId: string, params: RoomUpdateParams) =>
      client.callEndpoint<RoomSummary>('chat/rooms/update', { roomId, ...params }),
    delete: (roomId: string) => client.callEndpoint('chat/rooms/delete', { roomId }),
    mute: (roomId: string) => client.callEndpoint('chat/rooms/mute', { roomId }),
    members: (roomId: string, params: PaginationParams = {}) =>
      client.callEndpoint<UserSummary[]>('chat/rooms/members', { roomId, ...params }),
  };
}
