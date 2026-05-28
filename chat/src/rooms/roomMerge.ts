import type { RoomSummary } from '@/shared/types';

export const ROOM_SOURCE_ORDER = ['deep-link', 'invited', 'joined', 'manual', 'owned'] as const;
export type RoomSource = (typeof ROOM_SOURCE_ORDER)[number];

export interface RoomSourceGroup {
  source: RoomSource;
  rooms: RoomSummary[];
}

export interface MergedRoom {
  room: RoomSummary;
  sources: RoomSource[];
}

function sortSources(sources: Iterable<RoomSource>): RoomSource[] {
  return [...sources].sort((a, b) => ROOM_SOURCE_ORDER.indexOf(a) - ROOM_SOURCE_ORDER.indexOf(b));
}

export function mergeRoomSources(groups: RoomSourceGroup[]): MergedRoom[] {
  const rooms = new Map<string, MergedRoom>();

  for (const group of groups) {
    for (const room of group.rooms) {
      const existing = rooms.get(room.id);

      if (existing == null) {
        rooms.set(room.id, { room, sources: [group.source] });
        continue;
      }

      existing.sources = sortSources(new Set([...existing.sources, group.source]));
    }
  }

  return [...rooms.values()].sort((a, b) => a.room.id.localeCompare(b.room.id));
}
