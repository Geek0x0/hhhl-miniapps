import { getRuntimeContracts } from '@/api/endpointContracts';
import { createLogger, type Logger } from '@/shared/logger';
import { redactSensitiveText } from '@/shared/errors';
import type { ChatMessage } from '@/shared/types';
import { normalizeChatMessage } from '@/chat/chatApi';

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
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  maxReconnectAttempts?: number;
}

export interface RealtimeClient {
  connect: () => void;
  subscribeRoom: (roomId: string) => void;
  unsubscribeRoom: (roomId: string) => void;
  onEvent: (callback: (event: RealtimeEvent) => void) => () => void;
  onOpen: (callback: () => void) => () => void;
  onSocketFailure: (callback: () => void) => () => void;
  disconnect: () => void;
}

function createUrl(token: string): string {
  return getRuntimeContracts().streamingUrlPattern.replace('{token}', encodeURIComponent(token));
}

function channelId(roomId: string): string {
  return `${getRuntimeContracts().streamChannelEnvelope.body.id}:${roomId}`;
}

function recordField(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeEvent(raw: unknown, subscribedRooms: Set<string>): RealtimeEvent | null {
  const envelope = recordField(raw);
  if (envelope?.type !== 'ch') {
    return null;
  }

  const channelEnvelope = recordField(envelope.body);
  const body = recordField(channelEnvelope?.body);
  const eventType = stringField(channelEnvelope?.type);
  if (body == null || eventType == null) {
    return null;
  }

  if (eventType === 'message') {
    if (body.message == null) {
      return null;
    }

    const message = normalizeChatMessage(body.message);
    const envelopeRoomId = stringField(body.roomId);
    const messageRoomId = stringField(message.roomId);
    const roomId = envelopeRoomId ?? messageRoomId;
    if (roomId == null || !subscribedRooms.has(roomId) || message.id === '') {
      return null;
    }
    if (messageRoomId != null && messageRoomId !== roomId) {
      return null;
    }

    return { type: 'message', roomId, message: { ...message, roomId } };
  }

  const roomId = stringField(body.roomId);
  if (roomId == null || !subscribedRooms.has(roomId)) {
    return null;
  }

  const messageId = stringField(body.messageId);
  if (eventType === 'delete' && messageId != null) {
    return { type: 'delete', roomId, messageId };
  }

  if (eventType === 'reaction' && messageId != null) {
    return { type: 'reaction', roomId, messageId, reaction: typeof body.reaction === 'string' ? body.reaction : null };
  }

  return null;
}

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const WebSocketImpl = (options.WebSocketImpl ?? WebSocket) as WebSocketConstructorLike;
  const logger = options.logger ?? createLogger(console);
  const reconnectBaseMs = options.reconnectBaseMs ?? 1000;
  const reconnectMaxMs = options.reconnectMaxMs ?? 30000;
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  const listeners = new Set<(event: RealtimeEvent) => void>();
  const openListeners = new Set<() => void>();
  const socketFailureListeners = new Set<() => void>();
  const subscribedRooms = new Set<string>();
  let socket: WebSocketLike | null = null;
  let socketUrl = '';
  let socketOpen = false;
  let pendingSends: string[] = [];
  let disconnecting = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

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

  function notifySocketFailure(): void {
    for (const listener of socketFailureListeners) {
      listener();
    }
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer != null) {
      globalThis.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function resubscribeRooms(): void {
    for (const roomId of subscribedRooms) {
      send({
        type: getRuntimeContracts().streamChannelEnvelope.type,
        body: { id: channelId(roomId), type: 'connect', body: { roomId } },
      });
    }
  }

  function connectInternal(): void {
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
      reconnectAttempts = 0;
      for (const listener of openListeners) {
        listener();
      }
      nextSocket.send(JSON.stringify(getRuntimeContracts().streamConnectMessage));
      resubscribeRooms();
      for (const message of pendingSends) {
        nextSocket.send(message);
      }
      pendingSends = [];
    };
    nextSocket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data) as unknown;
      } catch (error) {
        logger.warn(`Ignored malformed realtime message: ${redactSensitiveText(error instanceof Error ? error.message : String(error))}`);
        return;
      }

      const normalized = normalizeEvent(parsed, subscribedRooms);
      if (normalized != null) {
        for (const listener of listeners) {
          listener(normalized);
        }
      }
    };
    nextSocket.onerror = () => {
      logger.warn(`Realtime socket error for ${redactSensitiveText(socketUrl)}`);
      notifySocketFailure();
    };
    nextSocket.onclose = () => {
      socketOpen = false;
      if (!disconnecting) {
        notifySocketFailure();
        scheduleReconnect();
      }
    };
  }

  function scheduleReconnect(): void {
    if (disconnecting || reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    clearReconnectTimer();
    const delayMs = Math.min(reconnectBaseMs * Math.pow(2, reconnectAttempts), reconnectMaxMs);
    reconnectAttempts += 1;
    reconnectTimer = globalThis.setTimeout(() => {
      reconnectTimer = null;
      if (!disconnecting) {
        connectInternal();
      }
    }, delayMs);
  }

  return {
    connect: () => {
      disconnecting = false;
      reconnectAttempts = 0;
      clearReconnectTimer();
      connectInternal();
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
    onOpen: (callback) => {
      openListeners.add(callback);
      return () => openListeners.delete(callback);
    },
    onSocketFailure: (callback) => {
      socketFailureListeners.add(callback);
      return () => socketFailureListeners.delete(callback);
    },
    disconnect: () => {
      disconnecting = true;
      clearReconnectTimer();
      socket?.close();
      socket = null;
      socketOpen = false;
      pendingSends = [];
      subscribedRooms.clear();
      reconnectAttempts = 0;
    },
  };
}
