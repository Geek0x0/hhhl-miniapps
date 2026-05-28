import type { ChatMessage } from '@/shared/types';
import type { CreateRoomMessageParams } from './chatApi';

export type OutgoingStatus = 'pending' | 'sent' | 'failed';

export interface CreatePendingMessageOptions {
  localId: string;
  roomId: string;
  text?: string;
  fileId?: string;
  replyId?: string;
  quoteId?: string;
  createdAt: string;
}

export interface OutgoingMessage {
  localId: string;
  status: OutgoingStatus;
  payload: CreateRoomMessageParams;
  localMessage: ChatMessage;
  serverId?: string;
  error?: string | null;
}

export function createPendingMessage(options: CreatePendingMessageOptions): OutgoingMessage {
  const payload: CreateRoomMessageParams = {
    toRoomId: options.roomId,
    text: options.text,
    fileId: options.fileId,
    replyId: options.replyId,
    quoteId: options.quoteId,
  };

  return {
    localId: options.localId,
    status: 'pending',
    payload,
    localMessage: {
      id: options.localId,
      roomId: options.roomId,
      createdAt: options.createdAt,
      text: options.text,
      file: options.fileId == null ? null : { id: options.fileId, name: options.fileId },
      replyId: options.replyId,
      quoteId: options.quoteId,
    },
    error: null,
  };
}

function mapOutgoing(queue: OutgoingMessage[], localId: string, mapper: (item: OutgoingMessage) => OutgoingMessage): OutgoingMessage[] {
  return queue.map((item) => item.localId === localId ? mapper(item) : item);
}

export function failPendingMessage(queue: OutgoingMessage[], localId: string, error: string): OutgoingMessage[] {
  return mapOutgoing(queue, localId, (item) => ({ ...item, status: 'failed', error }));
}

export function retryPendingMessage(queue: OutgoingMessage[], localId: string): OutgoingMessage[] {
  return mapOutgoing(queue, localId, (item) => ({ ...item, status: 'pending', error: null }));
}

export function sendPendingMessage(queue: OutgoingMessage[], localId: string, serverId: string): OutgoingMessage[] {
  return mapOutgoing(queue, localId, (item) => ({ ...item, status: 'sent', serverId, error: null }));
}

export function removePendingMessage(queue: OutgoingMessage[], localId: string): OutgoingMessage[] {
  return queue.filter((item) => item.localId !== localId);
}
