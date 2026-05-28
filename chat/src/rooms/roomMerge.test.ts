import { describe, expect, it } from 'vitest';
import type { RoomSummary } from '@/shared/types';
import { mergeRoomSources, type RoomSource } from './roomMerge';

function room(id: string, name = id): RoomSummary {
  return { id, name };
}

describe('mergeRoomSources', () => {
  it('deduplicates rooms by ID and preserves sorted source badges', () => {
    const merged = mergeRoomSources([
      { source: 'joined', rooms: [room('room-2'), room('room-1', 'Joined name')] },
      { source: 'owned', rooms: [room('room-1', 'Owned name')] },
      { source: 'invited', rooms: [room('room-3')] },
      { source: 'manual', rooms: [room('room-3', 'Manual name')] },
      { source: 'deep-link', rooms: [room('room-1')] },
    ]);

    expect(merged).toEqual([
      { room: room('room-1', 'Joined name'), sources: ['deep-link', 'joined', 'owned'] },
      { room: room('room-2'), sources: ['joined'] },
      { room: room('room-3'), sources: ['invited', 'manual'] },
    ] satisfies Array<{ room: RoomSummary; sources: RoomSource[] }>);
  });
});
