import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { RoomSummary } from '@/shared/types';
import { useRoomStore, type RoomApiLike } from './roomStore';

function room(id: string, name = id): RoomSummary {
  return { id, name };
}

function createRoomApi(overrides: Partial<RoomApiLike> = {}): RoomApiLike {
  return {
    joining: vi.fn(async () => [room('joined-1'), room('shared', 'Joined shared')]),
    owned: vi.fn(async () => [room('owned-1'), room('shared', 'Owned shared')]),
    invitationsInbox: vi.fn(async () => [{ id: 'invite-1', room: room('invited-1') }]),
    show: vi.fn(async (roomId: string) => room(roomId, `Room ${roomId}`)),
    join: vi.fn(async (roomId: string) => room(roomId, `Room ${roomId}`)),
    ignoreInvitation: vi.fn(async () => undefined),
    leave: vi.fn(async () => undefined),
    create: vi.fn(async (params) => room('created-1', params.name)),
    update: vi.fn(async (roomId, params) => room(roomId, params.name ?? roomId)),
    delete: vi.fn(async () => undefined),
    mute: vi.fn(async () => undefined),
    members: vi.fn(async () => [{ id: 'user-1', username: 'alice', name: 'Alice' }]),
    createInvitation: vi.fn(async () => ({ id: 'invite-2', roomId: 'room-1' })),
    invitationsOutbox: vi.fn(async () => [{ id: 'invite-2', roomId: 'room-1' }]),
    ...overrides,
  };
}

describe('roomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('loads joined, owned, invitation, and deep-linked rooms in order', async () => {
    const api = createRoomApi();
    const store = useRoomStore();

    store.preserveStartTarget({ type: 'room', roomId: 'deep-1' });
    await store.loadRooms(api);

    expect(api.joining).toHaveBeenCalledWith({ limit: 30 });
    expect(api.owned).toHaveBeenCalledWith({ limit: 30 });
    expect(api.invitationsInbox).toHaveBeenCalledWith({ limit: 30 });
    expect(api.show).toHaveBeenCalledWith('deep-1');
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.rooms.map((entry) => [entry.room.id, entry.sources])).toEqual([
      ['deep-1', ['deep-link']],
      ['invited-1', ['invited']],
      ['joined-1', ['joined']],
      ['owned-1', ['owned']],
      ['shared', ['joined', 'owned']],
    ]);
  });

  it('sets error state when room loading fails', async () => {
    const api = createRoomApi({
      joining: vi.fn(async () => {
        throw new Error('load failed');
      }),
    });
    const store = useRoomStore();

    await store.loadRooms(api);

    expect(store.loading).toBe(false);
    expect(store.error).toBe('load failed');
  });

  it('joins a manually entered room and records the manual source', async () => {
    const api = createRoomApi();
    const store = useRoomStore();

    await store.joinRoomById(' manual-1 ', api);

    expect(api.join).toHaveBeenCalledWith('manual-1');
    expect(store.activeRoomId).toBe('manual-1');
    expect(store.rooms).toEqual([{ room: room('manual-1', 'Room manual-1'), sources: ['manual'] }]);
  });

  it('loads a visible room summary for direct room route headers', async () => {
    const api = createRoomApi();
    const store = useRoomStore();

    await expect(store.ensureRoomVisible('room-1', api)).resolves.toEqual(room('room-1', 'Room room-1'));

    expect(api.show).toHaveBeenCalledWith('room-1');
    expect(store.rooms).toEqual([{ room: room('room-1', 'Room room-1'), sources: ['deep-link'] }]);
  });

  it('keeps the current rooms and exposes errors when direct join fails', async () => {
    const api = createRoomApi({
      join: vi.fn(async () => {
        throw new Error('join failed');
      }),
    });
    const store = useRoomStore();

    await store.joinRoomById('room-1', api);

    expect(store.error).toBe('join failed');
    expect(store.rooms).toEqual([]);
  });

  it('accepts and ignores invitations', async () => {
    const api = createRoomApi();
    const store = useRoomStore();

    await store.acceptInvitation('invite-1', 'room-1', api);
    await store.ignoreInvitation('invite-1', api);

    expect(api.join).toHaveBeenCalledWith('room-1');
    expect(api.ignoreInvitation).toHaveBeenCalledWith('invite-1');
    expect(store.invitations).toEqual([]);
  });

  it('preserves pending startapp room targets through auth', async () => {
    const store = useRoomStore();

    store.preserveStartTarget({ type: 'room', roomId: 'deep-1' });

    expect(store.pendingStartRoomId).toBe('deep-1');
  });

  it('creates, updates, deletes, leaves, and mutes rooms', async () => {
    const api = createRoomApi();
    const store = useRoomStore();

    await store.createRoom({ name: 'Created', description: 'Desc', joinMode: 'public' }, api);
    await store.updateRoom('created-1', { name: 'Renamed' }, api);
    await store.muteRoom('created-1', api);
    await store.leaveRoom('created-1', api);
    await store.deleteRoom('created-1', api);

    expect(api.create).toHaveBeenCalledWith({ name: 'Created', description: 'Desc', joinMode: 'public' });
    expect(api.update).toHaveBeenCalledWith('created-1', { name: 'Renamed' });
    expect(api.mute).toHaveBeenCalledWith('created-1');
    expect(api.leave).toHaveBeenCalledWith('created-1');
    expect(api.delete).toHaveBeenCalledWith('created-1');
  });

  it('loads paginated members and invitation outbox, and creates invitations', async () => {
    const api = createRoomApi();
    const store = useRoomStore();

    await store.loadMembers('room-1', api);
    await store.loadMembers('room-1', api, { untilId: 'user-1' });
    await store.loadInvitationOutbox('room-1', api);
    await store.createInvitation('room-1', api);

    expect(api.members).toHaveBeenCalledWith('room-1', { limit: 30 });
    expect(api.members).toHaveBeenCalledWith('room-1', { limit: 30, untilId: 'user-1' });
    expect(api.invitationsOutbox).toHaveBeenCalledWith('room-1', { limit: 30 });
    expect(api.createInvitation).toHaveBeenCalledWith('room-1');
    expect(store.membersByRoomId['room-1']).toEqual([{ id: 'user-1', username: 'alice', name: 'Alice' }]);
    expect(store.outboxInvitations).toEqual([{ id: 'invite-2', roomId: 'room-1' }]);
  });

  it('auto-loads more members with untilId and stops at the end', async () => {
    const firstPage = Array.from({ length: 30 }, (_value, index) => ({
      id: `user-${index + 1}`,
      username: `user${index + 1}`,
    }));
    const api = createRoomApi({
      members: vi.fn(async (_roomId, params) => params?.untilId === 'user-30'
        ? []
        : firstPage),
    });
    const store = useRoomStore();

    await store.loadMoreMembers('room-1', api);
    await store.loadMoreMembers('room-1', api);
    await store.loadMoreMembers('room-1', api);

    expect(api.members).toHaveBeenCalledWith('room-1', { limit: 30 });
    expect(api.members).toHaveBeenCalledWith('room-1', { limit: 30, untilId: 'user-30' });
    expect(api.members).toHaveBeenCalledTimes(2);
    expect(store.membersHasMoreByRoomId['room-1']).toBe(false);
    expect(store.membersLoadingByRoomId['room-1']).toBe(false);
  });

  it('exposes permission failure states from management APIs', async () => {
    const api = createRoomApi({
      delete: vi.fn(async () => {
        throw new Error('permission denied');
      }),
    });
    const store = useRoomStore();

    await store.deleteRoom('room-1', api);

    expect(store.error).toBe('permission denied');
  });
});
