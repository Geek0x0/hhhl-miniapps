import { getRuntimeContracts } from '@/api/endpointContracts';
import { createLogger, type Logger } from '@/shared/logger';
import { redactSensitiveText } from '@/shared/errors';
import type { ChatMessage } from '@/shared/types';

export interface WebSocketLike {
  onopen: ((event?: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  send: (data: string) => void;
  close: () => void;
}

export interface WebSocketConstructorLike {
  new (url: string): WebSocketLike;
}

export type RealtimeEvent =
  | { type: 'message'; roomId: string; message: ChatMessage }
  | { type: 'delete'; roomId: string; messageId: string }
  | { type: 'reaction'; roomId: string; messageId: string; reaction: string | null };

export interface RealtimeClientOptions {
  tokenProvider: () => string | null | undefined;
  WebSocketImpl?: WebSocketConstructorLike | typeof WebSocket;
  logger?: Pick<Logger, 'warn'>;
}

export interface RealtimeClient {
  connect: () => void;
  subscribeRoom: (roomId: string) => void;
  unsubscribeRoom: (roomId: string) => void;
  onEvent: (callback: (event: RealtimeEvent) => void) => () => void;
  disconnect: () => void;
}

function createUrl(token: string): string {
  return getRuntimeContracts().streamingUrlPattern.replace('{token}', encodeURIComponent(token));
}

function channelId(roomId: string): string {
  return `${getRuntimeContracts().streamChannelEnvelope.body.id}:${roomId}`;
}

function normalizeEvent(raw: unknown, subscribedRooms: Set<string>): RealtimeEvent | null {
  const envelope = raw as { type?: string; body?: { type?: string; body?: Record<string, unknown> } };
  if (envelope.type !== 'ch' || envelope.body?.body == null) {
    return null;
  }

  const body = envelope.body.body;
  const eventType = envelope.body.type;
  const message = body.message as ChatMessage | undefined;
  const roomId = typeof body.roomId === 'string' ? body.roomId : message?.roomId;

  if (roomId == null || !subscribedRooms.has(roomId)) {
    return null;
  }

  if (eventType === 'message' && message != null) {
    return { type: 'message', roomId, message };
  }

  if (eventType === 'delete' && typeof body.messageId === 'string') {
    return { type: 'delete', roomId, messageId: body.messageId };
  }

  if (eventType === 'reaction' && typeof body.messageId === 'string') {
    return { type: 'reaction', roomId, messageId: body.messageId, reaction: typeof body.reaction === 'string' ? body.reaction : null };
  }

  return null;
}

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const WebSocketImpl = (options.WebSocketImpl ?? WebSocket) as WebSocketConstructorLike;
  const logger = options.logger ?? createLogger(console);
  const listeners = new Set<(event: RealtimeEvent) => void>();
  const subscribedRooms = new Set<string>();
  let socket: WebSocketLike | null = null;
  let socketUrl = '';
  let socketOpen = false;
  let pendingSends: string[] = [];

  function send(value: unknown): void {
    const message = JSON.stringify(value);
    if (socket == null) {
      return;
    }

    if (!socketOpen) {
      pendingSends.push(message);
      return;
    }

    socket.send(message);
  }

  return {
    connect: () => {
      const token = options.tokenProvider();
      if (token == null || token === '') {
        return;
      }

      socketUrl = createUrl(token);
      const nextSocket = new WebSocketImpl(socketUrl);
      socket = nextSocket;
      socketOpen = false;
      pendingSends = [];
      nextSocket.onopen = () => {
        socketOpen = true;
        nextSocket.send(JSON.stringify(getRuntimeContracts().streamConnectMessage));
        for (const message of pendingSends) {
          nextSocket.send(message);
        }
        pendingSends = [];
      };
      nextSocket.onmessage = (event) => {
        const parsed = JSON.parse(event.data) as unknown;
        const normalized = normalizeEvent(parsed, subscribedRooms);
        if (normalized != null) {
          for (const listener of listeners) {
            listener(normalized);
          }
        }
      };
      nextSocket.onerror = () => logger.warn(`Realtime socket error for ${redactSensitiveText(socketUrl)}`);
      nextSocket.onclose = () => {
        socketOpen = false;
      };
    },
    subscribeRoom: (roomId) => {
      subscribedRooms.add(roomId);
      send({
        type: getRuntimeContracts().streamChannelEnvelope.type,
        body: { id: channelId(roomId), type: 'connect', body: { roomId } },
      });
    },
    unsubscribeRoom: (roomId) => {
      subscribedRooms.delete(roomId);
      send({
        type: getRuntimeContracts().streamChannelEnvelope.type,
        body: { id: channelId(roomId), type: 'disconnect', body: { roomId } },
      });
    },
    onEvent: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    disconnect: () => {
      socket?.close();
      socket = null;
      socketOpen = false;
      pendingSends = [];
      subscribedRooms.clear();
    },
  };
}
