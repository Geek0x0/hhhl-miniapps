import { DEFAULT_PAGE_SIZE } from '@/shared/config';
import type { ChatMessage, PaginationParams } from '@/shared/types';

export type RealtimeStatus = 'connected' | 'degraded';

export interface PollingFallbackOptions {
  roomTimeline: (roomId: string, params?: PaginationParams) => Promise<ChatMessage[]>;
  intervalMs?: number;
  maxIntervalMs?: number;
  onMessages?: (roomId: string, messages: ChatMessage[]) => void;
  onStatus?: (status: RealtimeStatus) => void;
}

export interface PollingFallback {
  start: (roomId: string, lastSeenId?: string | null) => void;
  stop: () => void;
  recordSocketFailure: () => void;
  currentIntervalMs: () => number;
}

export function createPollingFallback(options: PollingFallbackOptions): PollingFallback {
  const baseIntervalMs = options.intervalMs ?? 5000;
  const maxIntervalMs = options.maxIntervalMs ?? 30000;
  let timer: ReturnType<typeof window.setTimeout> | null = null;
  let roomId: string | null = null;
  let lastSeenId: string | null = null;
  let intervalMs = baseIntervalMs;
  let socketFailures = 0;

  function clearTimer(): void {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(): void {
    clearTimer();
    if (roomId == null) {
      return;
    }

    timer = window.setTimeout(async () => {
      if (roomId == null) {
        return;
      }

      try {
        const messages = await options.roomTimeline(roomId, { limit: DEFAULT_PAGE_SIZE, sinceId: lastSeenId ?? undefined });
        if (messages.length > 0) {
          lastSeenId = messages[messages.length - 1]?.id ?? lastSeenId;
          options.onMessages?.(roomId, messages);
        }
        intervalMs = baseIntervalMs;
      } catch {
        intervalMs = Math.min(intervalMs * 2, maxIntervalMs);
      } finally {
        schedule();
      }
    }, intervalMs);
  }

  return {
    start: (nextRoomId, nextLastSeenId) => {
      roomId = nextRoomId;
      lastSeenId = nextLastSeenId ?? null;
      schedule();
    },
    stop: () => {
      clearTimer();
      roomId = null;
    },
    recordSocketFailure: () => {
      socketFailures += 1;
      if (socketFailures >= 3) {
        options.onStatus?.('degraded');
      }
    },
    currentIntervalMs: () => intervalMs,
  };
}
