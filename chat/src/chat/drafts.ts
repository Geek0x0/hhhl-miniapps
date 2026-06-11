import type { LocalStorageAdapter } from '@/shared/storage';

export const DRAFTS_KEY = 'hhhl-chat:drafts';
const ROOM_DRAFT_CHANGE_EVENT = 'hhhl-chat:room-draft-change';

type DraftRecord = Record<string, string>;
export interface RoomDraftChange {
  roomId: string;
  text: string;
}

function roomKey(roomId: string): string {
  return roomId.trim();
}

function normalizeDrafts(value: unknown): DraftRecord {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const drafts: DraftRecord = {};
  for (const [key, draft] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = roomKey(key);
    if (normalizedKey !== '' && typeof draft === 'string' && draft !== '') {
      drafts[normalizedKey] = draft;
    }
  }

  return drafts;
}

function readDrafts(storage: LocalStorageAdapter): DraftRecord {
  return normalizeDrafts(storage.getJson<unknown>(DRAFTS_KEY, {}));
}

function writeDrafts(storage: LocalStorageAdapter, drafts: DraftRecord): void {
  if (Object.keys(drafts).length === 0) {
    storage.remove(DRAFTS_KEY);
    return;
  }

  storage.setJson(DRAFTS_KEY, drafts);
}

function notifyRoomDraftChange(change: RoomDraftChange): void {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') {
    return;
  }

  globalThis.dispatchEvent(new CustomEvent<RoomDraftChange>(ROOM_DRAFT_CHANGE_EVENT, { detail: change }));
}

export function addRoomDraftChangeListener(listener: (change: RoomDraftChange) => void): () => void {
  if (typeof globalThis.addEventListener !== 'function' || typeof globalThis.removeEventListener !== 'function') {
    return () => undefined;
  }

  const handleEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const detail = event.detail as Partial<RoomDraftChange>;
    if (typeof detail.roomId === 'string' && typeof detail.text === 'string') {
      listener({ roomId: detail.roomId, text: detail.text });
    }
  };

  globalThis.addEventListener(ROOM_DRAFT_CHANGE_EVENT, handleEvent);
  return () => {
    globalThis.removeEventListener(ROOM_DRAFT_CHANGE_EVENT, handleEvent);
  };
}

export function readRoomDraft(storage: LocalStorageAdapter, roomId: string): string {
  const key = roomKey(roomId);
  if (key === '') {
    return '';
  }

  return readDrafts(storage)[key] ?? '';
}

export function saveRoomDraft(storage: LocalStorageAdapter, roomId: string, text: string): void {
  const key = roomKey(roomId);
  if (key === '') {
    return;
  }

  const drafts = readDrafts(storage);
  if (text === '') {
    delete drafts[key];
  } else {
    drafts[key] = text;
  }
  writeDrafts(storage, drafts);
  notifyRoomDraftChange({ roomId: key, text });
}

export function clearRoomDraft(storage: LocalStorageAdapter, roomId: string): void {
  saveRoomDraft(storage, roomId, '');
}
