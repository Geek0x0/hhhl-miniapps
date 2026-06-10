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
    // Immediate first poll
    await vi.advanceTimersByTimeAsync(0);
    expect(roomTimeline).toHaveBeenCalledTimes(1);
    expect(roomTimeline).toHaveBeenCalledWith('room-1', { limit: 30, sinceId: 'm1' });
    expect(onMessages).toHaveBeenCalledWith('room-1', [message('m2')]);

    polling.stop();
    await vi.advanceTimersByTimeAsync(1000);

    // No additional calls after stop
    expect(roomTimeline).toHaveBeenCalledTimes(1);
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
    // Immediate first poll resolves (fails)
    await vi.advanceTimersByTimeAsync(0);
    // First scheduled poll fires at 1000ms (fails, intervalMs becomes 2000)
    await vi.advanceTimersByTimeAsync(1000);
    // Second scheduled poll fires at 2000ms more (fails, intervalMs becomes 4000)
    await vi.advanceTimersByTimeAsync(2000);

    expect(onStatus).toHaveBeenCalledWith('degraded');
    expect(roomTimeline).toHaveBeenCalledTimes(3);
    expect(polling.currentIntervalMs()).toBe(4000);
  });

  it('restarting the same room replaces the previous timer instead of duplicating polling', async () => {
    const roomTimeline = vi.fn(async () => []);
    const polling = createPollingFallback({ roomTimeline, intervalMs: 1000 });

    polling.start('room-1', 'm1');
    // Wait for immediate poll from first start
    await vi.advanceTimersByTimeAsync(0);
    polling.start('room-1', 'm1');
    // Wait for immediate poll from second start
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    // 1 from first start immediate + 1 from second start immediate + 1 from scheduled = 3
    // But we only care that the timer isn't duplicated (no extra scheduled calls)
    expect(roomTimeline).toHaveBeenCalledTimes(3);
  });
});
