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
  return [...entries].sort((a, b) => {
    const byTime = Date.parse(a.message.createdAt) - Date.parse(b.message.createdAt);
    return byTime === 0 ? a.message.id.localeCompare(b.message.id) : byTime;
  });
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

export function replacePendingMessage(current: Array<ChatMessage | TimelineEntry>, localId: string, serverMessage: ChatMessage): TimelineEntry[] {
  const withoutPending = current.map(toEntry).filter((entry) => entry.kind !== 'pending' || entry.localId !== localId);
  return mergeTimeline(withoutPending, [serverMessage]);
}

export function removeTimelineMessage(current: TimelineEntry[], messageId: string): TimelineEntry[] {
  return current.filter((entry) => entry.message.id !== messageId);
}
