import { defineStore } from 'pinia';
import { ApiClient } from '@/api/apiClient';
import { API_BASE_URL, DEFAULT_PAGE_SIZE } from '@/shared/config';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { PaginationParams, RoomSummary, UserSummary } from '@/shared/types';
import type { StartParam } from '@/telegram/startParam';
import { createRoomApi, type RoomCreateParams, type RoomUpdateParams } from './roomApi';
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
  create: (params: RoomCreateParams) => Promise<RoomSummary>;
  update: (roomId: string, params: RoomUpdateParams) => Promise<RoomSummary>;
  delete: (roomId: string) => Promise<unknown>;
  mute: (roomId: string) => Promise<unknown>;
  members: (roomId: string, params?: PaginationParams) => Promise<UserSummary[]>;
  createInvitation: (roomId: string) => Promise<RoomInvitation>;
  invitationsOutbox: (roomId: string, params?: PaginationParams) => Promise<RoomInvitation[]>;
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
  membersByRoomId: Record<string, UserSummary[]>;
  outboxInvitations: RoomInvitation[];
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

function mergeMembers(current: UserSummary[], incoming: UserSummary[]): UserSummary[] {
  const byId = new Map(current.map((member) => [member.id, member]));

  for (const member of incoming) {
    if (!byId.has(member.id)) {
      byId.set(member.id, member);
    }
  }

  return [...byId.values()];
}

function mergeInvitations(current: RoomInvitation[], incoming: RoomInvitation[]): RoomInvitation[] {
  const byId = new Map(current.map((invitation) => [invitation.id, invitation]));

  for (const invitation of incoming) {
    if (!byId.has(invitation.id)) {
      byId.set(invitation.id, invitation);
    }
  }

  return [...byId.values()];
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
    membersByRoomId: {},
    outboxInvitations: [],
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

    async ensureRoomVisible(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      const existing = this.rooms.find((entry) => entry.room.id === roomId)?.room;
      if (existing != null) {
        return existing;
      }

      const room = await api.show(roomId);
      this.deepLinkedRoom = room;
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
      try {
        await api.leave(roomId);
        this.manualRooms = this.manualRooms.filter((room) => room.id !== roomId);
        this.rooms = this.rooms.filter((entry) => entry.room.id !== roomId);
        if (this.activeRoomId === roomId) {
          this.activeRoomId = null;
        }
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    async createRoom(params: RoomCreateParams, api: RoomApiLike = createDefaultRoomApi()) {
      try {
        const room = await api.create(params);
        this.manualRooms = mergeRoomSources([{ source: 'manual', rooms: [...this.manualRooms, room] }]).map((entry) => entry.room);
        this.activeRoomId = room.id;
        this.rebuildRooms();
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    async updateRoom(roomId: string, params: RoomUpdateParams, api: RoomApiLike = createDefaultRoomApi()) {
      try {
        const updated = await api.update(roomId, params);
        this.manualRooms = this.manualRooms.map((room) => room.id === roomId ? updated : room);
        this.deepLinkedRoom = this.deepLinkedRoom?.id === roomId ? updated : this.deepLinkedRoom;
        this.rooms = this.rooms.map((entry) => entry.room.id === roomId ? { ...entry, room: updated } : entry);
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    async deleteRoom(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      try {
        await api.delete(roomId);
        this.rooms = this.rooms.filter((entry) => entry.room.id !== roomId);
        this.manualRooms = this.manualRooms.filter((room) => room.id !== roomId);
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    async muteRoom(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      try {
        await api.mute(roomId);
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    async loadMembers(roomId: string, api: RoomApiLike = createDefaultRoomApi(), params: PaginationParams = {}) {
      try {
        const members = await api.members(roomId, { limit: DEFAULT_PAGE_SIZE, ...params });
        this.membersByRoomId = {
          ...this.membersByRoomId,
          [roomId]: mergeMembers(this.membersByRoomId[roomId] ?? [], members),
        };
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    async loadInvitationOutbox(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      try {
        this.outboxInvitations = await api.invitationsOutbox(roomId, { limit: DEFAULT_PAGE_SIZE });
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    async createInvitation(roomId: string, api: RoomApiLike = createDefaultRoomApi()) {
      try {
        const invitation = await api.createInvitation(roomId);
        this.outboxInvitations = mergeInvitations(this.outboxInvitations, [invitation]);
      } catch (error) {
        this.error = messageFromError(error);
      }
    },

    clearRoomError() {
      this.error = null;
    },
  },
});
