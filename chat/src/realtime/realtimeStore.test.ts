import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ChatMessage } from '@/shared/types';
import { useRealtimeStore, type RealtimeClientLike, type PollingFallbackLike } from './realtimeStore';

function message(id: string, roomId = 'room-1'): ChatMessage {
  return { id, roomId, createdAt: `2026-01-01T00:00:${id.slice(1).padStart(2, '0')}.000Z`, text: id };
}

function createRealtime(): RealtimeClientLike & { emit: (event: Parameters<Parameters<RealtimeClientLike['onEvent']>[0]>[0]) => void } {
  let handler: Parameters<RealtimeClientLike['onEvent']>[0] = () => undefined;

  return {
    connect: vi.fn(),
    subscribeRoom: vi.fn(),
    unsubscribeRoom: vi.fn(),
    disconnect: vi.fn(),
    onEvent: vi.fn((callback) => {
      handler = callback;
      return () => undefined;
    }),
    emit: (event) => handler(event),
  };
}

function createPolling(): PollingFallbackLike {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    recordSocketFailure: vi.fn(),
  };
}

describe('realtimeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('connects, subscribes to a room, and appends incoming messages', () => {
    const realtime = createRealtime();
    const polling = createPolling();
    const appended: ChatMessage[][] = [];
    const store = useRealtimeStore();

    store.startRoom('room-1', { realtime, polling, lastSeenId: () => 'm1', appendMessages: (_roomId, messages) => appended.push(messages) });
    realtime.emit({ type: 'message', roomId: 'room-1', message: message('m2') });

    expect(realtime.connect).toHaveBeenCalled();
    expect(realtime.subscribeRoom).toHaveBeenCalledWith('room-1');
    expect(appended).toEqual([[message('m2')]]);
  });

  it('updates delete and reaction events and cleans up on stop', () => {
    const realtime = createRealtime();
    const polling = createPolling();
    const deleteMessage = vi.fn();
    const applyReaction = vi.fn();
    const store = useRealtimeStore();

    store.startRoom('room-1', {
      realtime,
      polling,
      lastSeenId: () => 'm1',
      appendMessages: vi.fn(),
      deleteMessage,
      applyReaction,
    });
    realtime.emit({ type: 'delete', roomId: 'room-1', messageId: 'm1' });
    realtime.emit({ type: 'reaction', roomId: 'room-1', messageId: 'm1', reaction: '👍' });
    store.stopRoom();

    expect(deleteMessage).toHaveBeenCalledWith('m1');
    expect(applyReaction).toHaveBeenCalledWith('m1', '👍');
    expect(realtime.unsubscribeRoom).toHaveBeenCalledWith('room-1');
    expect(polling.stop).toHaveBeenCalled();
  });

  it('starts polling when websocket failures degrade the connection', () => {
    const realtime = createRealtime();
    const polling = createPolling();
    const store = useRealtimeStore();

    store.startRoom('room-1', { realtime, polling, lastSeenId: () => 'm1', appendMessages: vi.fn() });
    store.markDegraded();

    expect(store.status).toBe('degraded');
    expect(polling.recordSocketFailure).not.toHaveBeenCalled();
    expect(polling.start).toHaveBeenCalledWith('room-1', 'm1');
  });
});
