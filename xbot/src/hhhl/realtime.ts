import { normalizeChatMessage } from './chatApi';
import type { HhhlChatMessage } from './types';

const STREAMING_PATH = '/streaming';
const STREAM_CONNECT_CHANNEL = 'main';
const STREAM_CONNECT_ID = 'test-main';
const STREAM_CHANNEL_ENVELOPE_TYPE = 'ch';

export type RealtimeEvent =
  | { type: 'message'; roomId: string; message: HhhlChatMessage }
  | { type: 'delete'; roomId: string; messageId: string }
  | { type: 'reaction'; roomId: string; messageId: string; reaction: string | null };

export interface StreamConnectMessage {
  type: 'connect';
  body: {
    channel: 'main';
    id: 'test-main';
    params: Record<string, never>;
    pong: true;
  };
}

export interface RoomChannelMessage {
  type: 'ch';
  body: {
    id: string;
    type: 'connect' | 'disconnect';
    body: {
      roomId: string;
    };
  };
}

function recordField(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringLikeField(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  return null;
}

function roomChannelId(roomId: string): string {
  return `${STREAM_CONNECT_ID}:${roomId}`;
}

export function createStreamingUrl(hhhlOrigin: string, token: string): string {
  const origin = hhhlOrigin.trim().replace(/\/+$/, '');
  const websocketOrigin = origin.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${websocketOrigin}${STREAMING_PATH}?i=${encodeURIComponent(token)}`;
}

export function createStreamConnectMessage(): StreamConnectMessage {
  return {
    type: 'connect',
    body: { channel: STREAM_CONNECT_CHANNEL, id: STREAM_CONNECT_ID, params: {}, pong: true },
  };
}

export function createRoomSubscribeMessage(roomId: string): RoomChannelMessage {
  return {
    type: STREAM_CHANNEL_ENVELOPE_TYPE,
    body: { id: roomChannelId(roomId), type: 'connect', body: { roomId } },
  };
}

export function createRoomUnsubscribeMessage(roomId: string): RoomChannelMessage {
  return {
    type: STREAM_CHANNEL_ENVELOPE_TYPE,
    body: { id: roomChannelId(roomId), type: 'disconnect', body: { roomId } },
  };
}

export function normalizeRealtimeEvent(value: unknown, subscribedRooms: ReadonlySet<string>): RealtimeEvent | null {
  const envelope = recordField(value);
  if (envelope?.type !== STREAM_CHANNEL_ENVELOPE_TYPE) {
    return null;
  }

  const channelEnvelope = recordField(envelope.body);
  const body = recordField(channelEnvelope?.body);
  const eventType = stringLikeField(channelEnvelope?.type);
  if (body == null || eventType == null) {
    return null;
  }

  if (eventType === 'message') {
    const messageValue = body.message;
    if (messageValue == null) {
      return null;
    }

    const message = normalizeChatMessage(messageValue);
    const roomId = stringLikeField(body.roomId) ?? message.roomId;
    if (roomId === '' || !subscribedRooms.has(roomId) || message.id === '') {
      return null;
    }

    return { type: 'message', roomId, message };
  }

  if (eventType === 'delete') {
    const roomId = stringLikeField(body.roomId);
    const messageId = stringLikeField(body.messageId);
    if (roomId == null || messageId == null || !subscribedRooms.has(roomId)) {
      return null;
    }

    return { type: 'delete', roomId, messageId };
  }

  if (eventType === 'reaction') {
    const roomId = stringLikeField(body.roomId);
    const messageId = stringLikeField(body.messageId);
    if (roomId == null || messageId == null || !subscribedRooms.has(roomId)) {
      return null;
    }

    return { type: 'reaction', roomId, messageId, reaction: typeof body.reaction === 'string' ? body.reaction : null };
  }

  return null;
}
