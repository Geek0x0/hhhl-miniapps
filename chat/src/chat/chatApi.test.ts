import { describe, expect, it } from 'vitest';
import { createChatApi, normalizeChatMessage } from './chatApi';

describe('chatApi', () => {
  it('normalizes sender fields from dc response variants', () => {
    expect(normalizeChatMessage({
      messageId: 'm1',
      toRoomId: 'room-1',
      created_at: '2026-01-01T00:00:00.000Z',
      body: 'hello',
      sender: { userId: 'user-1', displayName: 'Alice', avatar: 'https://example.test/a.png' },
    })).toEqual(expect.objectContaining({
      id: 'm1',
      roomId: 'room-1',
      text: 'hello',
      user: expect.objectContaining({ id: 'user-1', username: 'Alice', name: 'Alice', avatarUrl: 'https://example.test/a.png' }),
    }));
  });

  it('normalizes rich timeline message variants', () => {
    const message = normalizeChatMessage({
      id: 'm2',
      toRoomId: 'room-1',
      createdAt: '2026-01-01T00:00:02.000Z',
      content: 'photo',
      fromUser: {
        id: 'user-2',
        username: 'bob',
        name: 'Bob',
        avatarUrl: '/avatar/bob.webp',
      },
      files: [{
        id: 'file-1',
        name: 'image.png',
        type: 'image/png',
        url: '/files/image.png',
        thumbnailUrl: '/thumbs/image.webp',
      }],
      replyId: 'm1',
      reply: {
        id: 'm1',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:01.000Z',
        text: 'original',
        user: { id: 'user-1', username: 'alice', name: 'Alice' },
      },
      quoteMessage: {
        id: 'm0',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        body: 'quoted',
        sender: { id: 'user-3', username: 'carol' },
      },
    });

    expect(message.user).toEqual(expect.objectContaining({ id: 'user-2', username: 'bob', name: 'Bob', avatarUrl: 'https://dc.hhhl.cc/avatar/bob.webp' }));
    expect(message.file).toEqual(expect.objectContaining({ id: 'file-1', name: 'image.png', type: 'image/png', url: 'https://dc.hhhl.cc/files/image.png', thumbnailUrl: 'https://dc.hhhl.cc/thumbs/image.webp' }));
    expect(message.replyId).toBe('m1');
    expect(message.reply).toEqual(expect.objectContaining({ id: 'm1', text: 'original', user: expect.objectContaining({ name: 'Alice' }) }));
    expect(message.quote).toEqual(expect.objectContaining({ id: 'm0', text: 'quoted', user: expect.objectContaining({ username: 'carol' }) }));
  });

  it('calls chat message endpoints with exact payloads', async () => {
    const calls: Array<{ endpoint: string; params: unknown }> = [];
    const api = createChatApi({
      callEndpoint: async (endpoint, params) => {
        calls.push({ endpoint, params });
        return {} as never;
      },
    });

    await api.roomTimeline('room-1', { limit: 20, sinceId: 'm1' });
    await api.createToRoom({ toRoomId: 'room-1', text: 'hello', replyId: 'r1', quoteId: 'q1', fileId: 'f1' });
    await api.delete('m1');
    await api.react('m1', '❤️');
    await api.unreact('m1');
    await api.search({ roomId: 'room-1', query: 'hello', limit: 10 });
    await api.show('m1');
    await api.context('m1');

    expect(calls).toEqual([
      { endpoint: 'chat/messages/room-timeline', params: { roomId: 'room-1', limit: 20, sinceId: 'm1' } },
      {
        endpoint: 'chat/messages/create-to-room',
        params: { toRoomId: 'room-1', text: 'hello', replyId: 'r1', quoteId: 'q1', fileId: 'f1' },
      },
      { endpoint: 'chat/messages/delete', params: { messageId: 'm1' } },
      { endpoint: 'chat/messages/react', params: { messageId: 'm1', reaction: '❤️' } },
      { endpoint: 'chat/messages/unreact', params: { messageId: 'm1' } },
      { endpoint: 'chat/messages/search', params: { roomId: 'room-1', query: 'hello', limit: 10 } },
      { endpoint: 'chat/messages/show', params: { messageId: 'm1' } },
      { endpoint: 'chat/messages/context', params: { messageId: 'm1' } },
    ]);
  });
});
