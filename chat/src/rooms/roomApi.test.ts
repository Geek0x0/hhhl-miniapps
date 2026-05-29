import { describe, expect, it } from 'vitest';
import { createRoomApi, normalizeRoomSummary } from './roomApi';

describe('roomApi', () => {
  it('normalizes room names from dc response variants', () => {
    expect(normalizeRoomSummary({ id: 'room-1', title: 'General' })).toEqual(expect.objectContaining({
      id: 'room-1',
      name: 'General',
    }));
    expect(normalizeRoomSummary({ roomId: 'room-2', room: { displayName: 'Design' } })).toEqual(expect.objectContaining({
      id: 'room-2',
      name: 'Design',
    }));
  });

  it('normalizes member response variants', async () => {
    const api = createRoomApi({
      callEndpoint: async () => [{ user: { id: 'user-1', displayName: 'Alice', avatar: '/avatar.png' } }] as never,
    });

    await expect(api.members('room-1')).resolves.toEqual([
      { id: 'user-1', username: 'Alice', name: 'Alice', avatarUrl: 'https://dc.hhhl.cc/avatar.png' },
    ]);
  });

  it('calls room endpoints with exact payloads', async () => {
    const calls: Array<{ endpoint: string; params: unknown }> = [];
    const api = createRoomApi({
      callEndpoint: async (endpoint, params) => {
        calls.push({ endpoint, params });
        return {} as never;
      },
    });

    await api.joining({ limit: 20 });
    await api.owned({ limit: 10, sinceId: 'a' });
    await api.invitationsInbox({ limit: 5 });
    await api.show('room-1');
    await api.join('room-1');
    await api.leave('room-1');
    await api.create({ name: 'New', description: 'Desc', joinMode: 'public' });
    await api.update('room-1', { name: 'Renamed' });
    await api.delete('room-1');
    await api.mute('room-1');
    await api.members('room-1', { limit: 30 });

    expect(calls).toEqual([
      { endpoint: 'chat/rooms/joining', params: { limit: 20 } },
      { endpoint: 'chat/rooms/owned', params: { limit: 10, sinceId: 'a' } },
      { endpoint: 'chat/rooms/invitations/inbox', params: { limit: 5 } },
      { endpoint: 'chat/rooms/show', params: { roomId: 'room-1' } },
      { endpoint: 'chat/rooms/join', params: { roomId: 'room-1' } },
      { endpoint: 'chat/rooms/leave', params: { roomId: 'room-1' } },
      { endpoint: 'chat/rooms/create', params: { name: 'New', description: 'Desc', joinMode: 'public' } },
      { endpoint: 'chat/rooms/update', params: { roomId: 'room-1', name: 'Renamed' } },
      { endpoint: 'chat/rooms/delete', params: { roomId: 'room-1' } },
      { endpoint: 'chat/rooms/mute', params: { roomId: 'room-1' } },
      { endpoint: 'chat/rooms/members', params: { roomId: 'room-1', limit: 30 } },
    ]);
  });
});
