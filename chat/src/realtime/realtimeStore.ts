import { defineStore } from 'pinia';
import type { ChatMessage } from '@/shared/types';
import type { RealtimeEvent } from './realtimeClient';

export type RealtimeConnectionStatus = 'idle' | 'connected' | 'degraded';

export interface RealtimeClientLike {
  connect: () => void;
  subscribeRoom: (roomId: string) => void;
  unsubscribeRoom: (roomId: string) => void;
  disconnect: () => void;
  onEvent: (callback: (event: RealtimeEvent) => void) => () => void;
}

export interface PollingFallbackLike {
  start: (roomId: string, lastSeenId?: string | null) => void;
  stop: () => void;
  recordSocketFailure: () => void;
}

export interface StartRoomDependencies {
  realtime: RealtimeClientLike;
  polling: PollingFallbackLike;
  lastSeenId: () => string | null | undefined;
  appendMessages: (roomId: string, messages: ChatMessage[]) => void;
  deleteMessage?: (messageId: string) => void;
  applyReaction?: (messageId: string, reaction: string | null) => void;
}

export interface RealtimeState {
  roomId: string | null;
  status: RealtimeConnectionStatus;
}

let dependencies: StartRoomDependencies | null = null;
let unsubscribeEvents: (() => void) | null = null;

export const useRealtimeStore = defineStore('realtime', {
  state: (): RealtimeState => ({
    roomId: null,
    status: 'idle',
  }),
  actions: {
    startRoom(roomId: string, nextDependencies: StartRoomDependencies) {
      this.stopRoom();
      dependencies = nextDependencies;
      this.roomId = roomId;
      this.status = 'connected';
      unsubscribeEvents = nextDependencies.realtime.onEvent((event) => {
        if (event.roomId !== this.roomId) {
          return;
        }

        if (event.type === 'message') {
          nextDependencies.appendMessages(event.roomId, [event.message]);
        } else if (event.type === 'delete') {
          nextDependencies.deleteMessage?.(event.messageId);
        } else if (event.type === 'reaction') {
          nextDependencies.applyReaction?.(event.messageId, event.reaction);
        }
      });
      nextDependencies.realtime.connect();
      nextDependencies.realtime.subscribeRoom(roomId);
    },

    markDegraded() {
      if (dependencies == null || this.roomId == null) {
        return;
      }

      this.status = 'degraded';
      dependencies.polling.start(this.roomId, dependencies.lastSeenId() ?? null);
    },

    stopRoom() {
      if (dependencies != null && this.roomId != null) {
        dependencies.realtime.unsubscribeRoom(this.roomId);
        dependencies.polling.stop();
      }
      unsubscribeEvents?.();
      unsubscribeEvents = null;
      dependencies = null;
      this.roomId = null;
      this.status = 'idle';
    },
  },
});
