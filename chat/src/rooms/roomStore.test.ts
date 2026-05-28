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
});
