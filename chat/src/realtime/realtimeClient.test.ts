import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/shared/types';
import { createRealtimeClient, type WebSocketLike } from './realtimeClient';

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];
  readonly sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.();
  }
}

function message(roomId: string, id = 'm1'): ChatMessage {
  return { id, roomId, createdAt: '2026-01-01T00:00:00.000Z', text: 'hello' };
}

describe('RealtimeClient', () => {
  it('builds streaming URL from runtime contracts and sends connect envelope', () => {
    FakeWebSocket.instances = [];
    const client = createRealtimeClient({ tokenProvider: () => 'secret-token', WebSocketImpl: FakeWebSocket });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.onopen?.();

    expect(socket.url).toBe('wss://dc.hhhl.cc/streaming?i=secret-token');
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: 'connect',
      body: { channel: 'main', id: 'test-main', params: {}, pong: true },
    });
  });

  it('sends subscribe and unsubscribe envelopes based on the channel contract', () => {
    FakeWebSocket.instances = [];
    const client = createRealtimeClient({ tokenProvider: () => 'secret-token', WebSocketImpl: FakeWebSocket });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.onopen?.();
    client.subscribeRoom('room-1');
    client.unsubscribeRoom('room-1');

    expect(JSON.parse(socket.sent[1])).toEqual({
      type: 'ch',
      body: { id: 'test-main:room-1', type: 'connect', body: { roomId: 'room-1' } },
    });
    expect(JSON.parse(socket.sent[2])).toEqual({
      type: 'ch',
      body: { id: 'test-main:room-1', type: 'disconnect', body: { roomId: 'room-1' } },
    });
  });

  it('normalizes room message events and ignores unrelated rooms', () => {
    FakeWebSocket.instances = [];
    const onEvent = vi.fn();
    const client = createRealtimeClient({ tokenProvider: () => 'secret-token', WebSocketImpl: FakeWebSocket });

    client.onEvent(onEvent);
    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.onopen?.();
    client.subscribeRoom('room-1');
    socket.onmessage?.({ data: JSON.stringify({ type: 'ch', body: { id: 'test-main', type: 'message', body: { message: message('room-1') } } }) });
    socket.onmessage?.({ data: JSON.stringify({ type: 'ch', body: { id: 'test-main', type: 'message', body: { message: message('room-2', 'm2') } } }) });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ type: 'message', roomId: 'room-1', message: message('room-1') });
  });

  it('redacts tokens before logging socket errors', () => {
    FakeWebSocket.instances = [];
    const warn = vi.fn();
    const client = createRealtimeClient({
      tokenProvider: () => 'secret-token',
      WebSocketImpl: FakeWebSocket,
      logger: { warn },
    });

    client.connect();
    FakeWebSocket.instances[0].onerror?.();

    expect(warn).toHaveBeenCalledWith('Realtime socket error for wss://dc.hhhl.cc/streaming?i=[redacted]');
  });
});
