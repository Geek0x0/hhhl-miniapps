import type { ChatMessage } from '@/shared/types';

export interface ServerTimelineEntry {
  kind: 'server';
  message: ChatMessage;
}

export interface PendingTimelineEntry {
  kind: 'pending';
  localId: string;
  message: ChatMessage;
  status: 'pending' | 'failed';
  error?: string | null;
}

export type TimelineEntry = ServerTimelineEntry | PendingTimelineEntry;

function toEntry(message: ChatMessage | TimelineEntry): TimelineEntry {
  if ('kind' in message) {
    return message;
  }

  return { kind: 'server', message };
}

function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  const timestampCache = new Map<string, number>();
  function cachedTimestamp(entry: TimelineEntry): number {
    const id = entry.message.id;
    let ts = timestampCache.get(id);
    if (ts === undefined) {
      ts = Date.parse(entry.message.createdAt);
      timestampCache.set(id, ts);
    }
    return ts;
  }

  return [...entries].sort((a, b) => {
    const byTime = cachedTimestamp(a) - cachedTimestamp(b);
    return byTime === 0 ? a.message.id.localeCompare(b.message.id) : byTime;
  });
}

export function sortTimelineWithEntry(current: TimelineEntry[], newEntry: TimelineEntry): TimelineEntry[] {
  const filtered = current.filter((entry) => entry.message.id !== newEntry.message.id);
  const newTimestamp = Date.parse(newEntry.message.createdAt);

  // Find insertion index via binary search for efficiency
  let low = 0;
  let high = filtered.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const midTime = Date.parse(filtered[mid]!.message.createdAt);
    if (midTime < newTimestamp || (midTime === newTimestamp && filtered[mid]!.message.id.localeCompare(newEntry.message.id) < 0)) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const result = [...filtered];
  result.splice(low, 0, newEntry);
  return result;
}

export function mergeTimeline(current: Array<ChatMessage | TimelineEntry>, incoming: ChatMessage[]): TimelineEntry[] {
  const byServerId = new Map<string, TimelineEntry>();
  const pendingEntries: TimelineEntry[] = [];

  for (const item of current.map(toEntry)) {
    if (item.kind === 'server') {
      byServerId.set(item.message.id, item);
    } else {
      pendingEntries.push(item);
    }
  }

  for (const message of incoming) {
    if (!byServerId.has(message.id)) {
      byServerId.set(message.id, { kind: 'server', message });
    }
  }

  return sortTimeline([...byServerId.values(), ...pendingEntries]);
}

export function mergeTimelineWithUpdate(current: Array<ChatMessage | TimelineEntry>, incoming: ChatMessage[]): TimelineEntry[] {
  const byServerId = new Map<string, TimelineEntry>();
  const pendingEntries: TimelineEntry[] = [];

  for (const item of current.map(toEntry)) {
    if (item.kind === 'server') {
      byServerId.set(item.message.id, item);
    } else {
      pendingEntries.push(item);
    }
  }

  for (const message of incoming) {
    // Always use the incoming version for realtime updates (newer data)
    byServerId.set(message.id, { kind: 'server', message });
  }

  return sortTimeline([...byServerId.values(), ...pendingEntries]);
}

export function replacePendingMessage(current: Array<ChatMessage | TimelineEntry>, localId: string, serverMessage: ChatMessage): TimelineEntry[] {
  const withoutPending = current.map(toEntry).filter((entry) => entry.kind !== 'pending' || entry.localId !== localId);
  return mergeTimeline(withoutPending, [serverMessage]);
}

export function removeTimelineMessage(current: TimelineEntry[], messageId: string): TimelineEntry[] {
  return current.filter((entry) => entry.message.id !== messageId);
}
