import type { EndpointCaller } from '@/api/endpointTypes';
import type { ChatMessage, PaginationParams } from '@/shared/types';

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

export function createChatApi(client: EndpointCaller) {
  return {
    roomTimeline: (roomId: string, params: PaginationParams = {}) =>
      client.callEndpoint<ChatMessage[]>('chat/messages/room-timeline', { roomId, ...params }),
    createToRoom: (params: CreateRoomMessageParams) =>
      client.callEndpoint<ChatMessage>('chat/messages/create-to-room', params),
    delete: (messageId: string) => client.callEndpoint('chat/messages/delete', { messageId }),
    react: (messageId: string, reaction: string) => client.callEndpoint('chat/messages/react', { messageId, reaction }),
    unreact: (messageId: string) => client.callEndpoint('chat/messages/unreact', { messageId }),
    search: (params: SearchMessagesParams) => client.callEndpoint<ChatMessage[]>('chat/messages/search', params),
    show: (messageId: string) => client.callEndpoint<ChatMessage>('chat/messages/show', { messageId }),
    context: (messageId: string) => client.callEndpoint<ChatMessage[]>('chat/messages/context', { messageId }),
  };
}
