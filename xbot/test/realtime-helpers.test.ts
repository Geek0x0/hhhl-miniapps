import {
  createRoomSubscribeMessage,
  createRoomUnsubscribeMessage,
  createStreamConnectMessage,
  createStreamingUrl,
  normalizeRealtimeEvent,
} from '../src/hhhl/realtime';

describe('HHHL realtime helpers', () => {
  it('builds streaming URLs and realtime control messages from the runtime contract values', () => {
    expect(createStreamingUrl('https://dc.hhhl.cc', 'tok en')).toBe('wss://dc.hhhl.cc/streaming?i=tok%20en');
    expect(createStreamingUrl('http://dc.hhhl.cc/', 'a/b?c')).toBe('ws://dc.hhhl.cc/streaming?i=a%2Fb%3Fc');
    expect(createStreamingUrl('https://dc.hhhl.cc///', 'plain')).toBe('wss://dc.hhhl.cc/streaming?i=plain');

    expect(createStreamConnectMessage()).toEqual({
      type: 'connect',
      body: { channel: 'main', id: 'test-main', params: {}, pong: true },
    });
    expect(createRoomSubscribeMessage('room-1')).toEqual({
      type: 'ch',
      body: { id: 'test-main:room-1', type: 'connect', body: { roomId: 'room-1' } },
    });
    expect(createRoomUnsubscribeMessage('room-1')).toEqual({
      type: 'ch',
      body: { id: 'test-main:room-1', type: 'disconnect', body: { roomId: 'room-1' } },
    });
  });

  it('normalizes message events using the nested message room id and chat message normalization', () => {
    const normalized = normalizeRealtimeEvent(
      {
        type: 'ch',
        body: {
          id: 'test-main:room-1',
          type: 'message',
          body: {
            message: {
              message: {
                messageId: 'msg-1',
                toRoomId: 'room-1',
                body: 'hello realtime',
              },
            },
          },
        },
      },
      new Set(['room-1']),
    );

    expect(normalized).toMatchObject({
      type: 'message',
      roomId: 'room-1',
      message: {
        id: 'msg-1',
        roomId: 'room-1',
        text: 'hello realtime',
      },
    });
  });

  it('normalizes delete and reaction events for subscribed rooms', () => {
    const subscribedRooms = new Set(['room-1']);

    expect(
      normalizeRealtimeEvent(
        {
          type: 'ch',
          body: {
            id: 'test-main:room-1',
            type: 'delete',
            body: { roomId: 'room-1', messageId: 'msg-1' },
          },
        },
        subscribedRooms,
      ),
    ).toEqual({ type: 'delete', roomId: 'room-1', messageId: 'msg-1' });

    expect(
      normalizeRealtimeEvent(
        {
          type: 'ch',
          body: {
            id: 'test-main:room-1',
            type: 'reaction',
            body: { roomId: 'room-1', messageId: 'msg-1', reaction: 'heart' },
          },
        },
        subscribedRooms,
      ),
    ).toEqual({ type: 'reaction', roomId: 'room-1', messageId: 'msg-1', reaction: 'heart' });

    expect(
      normalizeRealtimeEvent(
        {
          type: 'ch',
          body: {
            id: 'test-main:room-1',
            type: 'reaction',
            body: { roomId: 'room-1', messageId: 'msg-1', reaction: null },
          },
        },
        subscribedRooms,
      ),
    ).toEqual({ type: 'reaction', roomId: 'room-1', messageId: 'msg-1', reaction: null });
  });

  it('ignores unrelated rooms and malformed envelopes', () => {
    const subscribedRooms = new Set(['room-1']);

    expect(
      normalizeRealtimeEvent(
        {
          type: 'ch',
          body: {
            id: 'test-main:room-2',
            type: 'message',
            body: { message: { id: 'msg-2', roomId: 'room-2', text: 'ignore me' } },
          },
        },
        subscribedRooms,
      ),
    ).toBeNull();

    expect(normalizeRealtimeEvent({ type: 'connect', body: {} }, subscribedRooms)).toBeNull();
    expect(normalizeRealtimeEvent({ type: 'ch', body: { type: 'message' } }, subscribedRooms)).toBeNull();
    expect(normalizeRealtimeEvent({ type: 'ch', body: { type: 'message', body: { message: { messageId: 'msg-3' } } } }, subscribedRooms)).toBeNull();
    expect(normalizeRealtimeEvent(null, subscribedRooms)).toBeNull();
  });
});
