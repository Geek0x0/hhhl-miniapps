import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/shared/types';
import { mergeTimeline, replacePendingMessage, type TimelineEntry } from './timelineMerge';

function message(id: string, createdAt: string, text = id): ChatMessage {
  return { id, roomId: 'room-1', createdAt, text };
}

function pending(localId: string, createdAt: string, text = localId): TimelineEntry {
  return { kind: 'pending', localId, message: message(localId, createdAt, text), status: 'pending' };
}

describe('mergeTimeline', () => {
  it('loads, prepends, appends, deduplicates server IDs, and keeps chronological order', () => {
    const initial = mergeTimeline([], [message('m2', '2026-01-01T00:02:00.000Z'), message('m3', '2026-01-01T00:03:00.000Z')]);
    const withOlder = mergeTimeline(initial, [message('m1', '2026-01-01T00:01:00.000Z'), message('m2', '2026-01-01T00:02:00.000Z', 'duplicate')]);
    const withNewer = mergeTimeline(withOlder, [message('m4', '2026-01-01T00:04:00.000Z')]);

    expect(withNewer.map((entry) => entry.message.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(withNewer.find((entry) => entry.message.id === 'm2')?.message.text).toBe('m2');
  });

  it('replaces pending local IDs with confirmed server IDs', () => {
    const timeline = [message('m1', '2026-01-01T00:01:00.000Z'), pending('local-1', '2026-01-01T00:02:00.000Z', 'hello')];
    const replaced = replacePendingMessage(timeline, 'local-1', message('m2', '2026-01-01T00:02:30.000Z', 'hello'));

    expect(replaced).toEqual([
      { kind: 'server', message: message('m1', '2026-01-01T00:01:00.000Z') },
      { kind: 'server', message: message('m2', '2026-01-01T00:02:30.000Z', 'hello') },
    ] satisfies TimelineEntry[]);
  });
});
