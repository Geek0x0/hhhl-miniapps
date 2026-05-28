import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/shared/types';
import { createPollingFallback } from './pollingFallback';

function message(id: string): ChatMessage {
  return { id, roomId: 'room-1', createdAt: `2026-01-01T00:00:${id.slice(1).padStart(2, '0')}.000Z`, text: id };
}

describe('pollingFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('polls room timeline with sinceId and stops on websocket recovery', async () => {
    const roomTimeline = vi.fn(async () => [message('m2')]);
    const onMessages = vi.fn();
    const polling = createPollingFallback({ roomTimeline, intervalMs: 1000, onMessages });

    polling.start('room-1', 'm1');
    await vi.advanceTimersByTimeAsync(1000);
    polling.stop();
    await vi.advanceTimersByTimeAsync(1000);

    expect(roomTimeline).toHaveBeenCalledTimes(1);
    expect(roomTimeline).toHaveBeenCalledWith('room-1', { limit: 30, sinceId: 'm1' });
    expect(onMessages).toHaveBeenCalledWith('room-1', [message('m2')]);
  });

  it('backs off after errors and emits degraded status after repeated websocket failures', async () => {
    const roomTimeline = vi.fn(async () => {
      throw new Error('poll failed');
    });
    const onStatus = vi.fn();
    const polling = createPollingFallback({ roomTimeline, intervalMs: 1000, maxIntervalMs: 4000, onStatus });

    polling.recordSocketFailure();
    polling.recordSocketFailure();
    polling.recordSocketFailure();
    polling.start('room-1', 'm1');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(onStatus).toHaveBeenCalledWith('degraded');
    expect(roomTimeline).toHaveBeenCalledTimes(2);
    expect(polling.currentIntervalMs()).toBe(4000);
  });
});
