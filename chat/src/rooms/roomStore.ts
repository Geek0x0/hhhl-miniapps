import { defineStore } from 'pinia';
import { ApiClient } from '@/api/apiClient';
import { API_BASE_URL, DEFAULT_PAGE_SIZE } from '@/shared/config';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { PaginationParams, RoomSummary } from '@/shared/types';
import type { StartParam } from '@/telegram/startParam';
import { createRoomApi } from './roomApi';
import { mergeRoomSources, type MergedRoom } from './roomMerge';

export interface RoomInvitation {
  id: string;
  room?: RoomSummary | null;
  roomId?: string;
}

export interface RoomApiLike {
  joining: (params?: PaginationParams) => Promise<RoomSummary[]>;
  owned: (params?: PaginationParams) => Promise<RoomSummary[]>;
  invitationsInbox: (params?: PaginationParams) => Promise<RoomInvitation[]>;
  show: (roomId: string) => Promise<RoomSummary>;
  join: (roomId: string) => Promise<RoomSummary>;
  ignoreInvitation: (invitationId: string) => Promise<unknown>;
  leave: (roomId: string) => Promise<unknown>;
}

export interface RoomState {
  loading: boolean;
  error: string | null;
  rooms: MergedRoom[];
  invitations: RoomInvitation[];
  manualRooms: RoomSummary[];
  deepLinkedRoom: RoomSummary | null;
  pendingStartRoomId: string | null;
  activeRoomId: string | null;
}

function createDefaultRoomApi(): RoomApiLike {
  const storage = createLocalStorageAdapter();
  const client = new ApiClient({
    baseUrl: API_BASE_URL,
    tokenProvider: () => storage.getToken(),
  });

  return createRoomApi(client) as RoomApiLike;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function invitationRooms(invitations: RoomInvitation[]): RoomSummary[] {
  return invitations.flatMap((invitation) => invitation.room == null ? [] : [invitation.room]);
}

export const useRoomStore = defineStore('rooms', {
  state: (): RoomState => ({
    loading: false,
    error: null,
    rooms: [],
    invitations: [],
    manualRooms: [],
    deepLinkedRoom: null,
    pendingStartRoomId: null,
    activeRoomId: null,
  }),
  actions: {
    rebuildRooms(joined: RoomSummary[] = [], owned: RoomSummary[] = []) {
      this.rooms = mergeRoomSources([
        { source: 'deep-link', rooms: this.deepLinkedRoom == null ? [] : [this.deepLinkedRoom] },
        { source: 'invited', rooms: invitationRooms(this.invitations) },
        { source: 'joined', rooms: joined },
        { source: 'manual', rooms: this.manualRooms },
        { source: 'owned', rooms: owned },
      ]);
    },

    preserveStartTarget(startParam: StartParam) {
      if (startParam.type === 'room') {
        this.pendingStartRoomId = startParam.roomId;
      }
    },

    async loadRooms(api: RoomApiLike = createDefaultRoomApi()) {
      this.loading = true;
      this.error = null;

      try {
        const [joined, owned, invitations] = await Promise.all([
          api.joining({ limit: DEFAULT_PAGE_SIZE }),
          api.owned({ limit: DEFAULT_PAGE_SIZE }),
          api.invitationsInbox({ limit: DEFAULT_PAGE_SIZE }),
        ]);

        this.invitations = invitations;
        if (this.pendingStartRoomId != null) {
          this.deepLinkedRoom = await api.show(this.pendingStartRoomId);
        }
        this.rebuildRooms(joined, owned);
      } catch (error) {
        this.error = messageFromError(error);
      } finally {
        this.loading = false;
      }
    },

    async joinRoomById(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      const normalizedRoomId = roomId.trim();
      if (normalizedRoomId === '') {
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const room = await api.join(normalizedRoomId);
        this.manualRooms = mergeRoomSources([{ source: 'manual', rooms: [...this.manualRooms, room] }]).map((entry) => entry.room);
        this.activeRoomId = room.id;
        this.rebuildRooms();
      } catch (error) {
        this.error = messageFromError(error);
      } finally {
        this.loading = false;
      }
    },

    async openDeepLinkedRoom(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      this.pendingStartRoomId = roomId;
      const room = await api.show(roomId);
      this.deepLinkedRoom = room;
      this.activeRoomId = room.id;
      this.rebuildRooms();
      return room;
    },

    async acceptInvitation(invitationId: string, roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      const room = await api.join(roomId);
      this.manualRooms = mergeRoomSources([{ source: 'manual', rooms: [...this.manualRooms, room] }]).map((entry) => entry.room);
      this.invitations = this.invitations.filter((invitation) => invitation.id !== invitationId);
      this.activeRoomId = room.id;
      this.rebuildRooms();
    },

    async ignoreInvitation(invitationId: string, api: RoomApiLike = createDefaultRoomApi()) {
      await api.ignoreInvitation(invitationId);
      this.invitations = this.invitations.filter((invitation) => invitation.id !== invitationId);
      this.rebuildRooms();
    },

    async leaveRoom(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      await api.leave(roomId);
      this.manualRooms = this.manualRooms.filter((room) => room.id !== roomId);
      this.rooms = this.rooms.filter((entry) => entry.room.id !== roomId);
      if (this.activeRoomId === roomId) {
        this.activeRoomId = null;
      }
    },

    clearRoomError() {
      this.error = null;
    },
  },
});
