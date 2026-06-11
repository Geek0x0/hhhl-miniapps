import { describe, expect, it } from 'vitest';
import type { LocalStorageAdapter } from '@/shared/storage';
import { addRoomDraftChangeListener, clearRoomDraft, DRAFTS_KEY, readRoomDraft, saveRoomDraft } from './drafts';

function createStorage(initial: Record<string, unknown> = {}): LocalStorageAdapter & { raw: Map<string, unknown> } {
  const raw = new Map<string, unknown>(Object.entries(initial));

  return {
    raw,
    getToken: () => null,
    setToken: () => undefined,
    clearAuth: () => undefined,
    getJson: <T>(key: string, fallback: T) => raw.has(key) ? raw.get(key) as T : fallback,
    setJson: <T>(key: string, value: T) => { raw.set(key, value); },
    remove: (key: string) => { raw.delete(key); },
  };
}

describe('drafts', () => {
  it('saves, reads, and clears text drafts by room id', () => {
    const storage = createStorage();

    saveRoomDraft(storage, 'room-1', 'hello draft');
    saveRoomDraft(storage, 'room-2', 'other draft');

    expect(readRoomDraft(storage, 'room-1')).toBe('hello draft');
    expect(readRoomDraft(storage, 'room-2')).toBe('other draft');

    clearRoomDraft(storage, 'room-1');

    expect(readRoomDraft(storage, 'room-1')).toBe('');
    expect(readRoomDraft(storage, 'room-2')).toBe('other draft');
  });

  it('removes empty drafts and deletes the storage key when no drafts remain', () => {
    const storage = createStorage();

    saveRoomDraft(storage, 'room-1', 'hello');
    saveRoomDraft(storage, 'room-1', '');

    expect(readRoomDraft(storage, 'room-1')).toBe('');
    expect(storage.raw.has(DRAFTS_KEY)).toBe(false);
  });

  it('ignores malformed draft records and blank room ids', () => {
    const storage = createStorage({ [DRAFTS_KEY]: { 'room-1': 'hello', 'room-2': 42, '': 'bad' } });

    expect(readRoomDraft(storage, 'room-1')).toBe('hello');
    expect(readRoomDraft(storage, 'room-2')).toBe('');
    expect(readRoomDraft(storage, '')).toBe('');

    saveRoomDraft(storage, '', 'ignored');

    expect(readRoomDraft(storage, '')).toBe('');
  });

  it('notifies same-page listeners when a room draft changes', () => {
    const storage = createStorage();
    const events: Array<{ roomId: string; text: string }> = [];
    const unsubscribe = addRoomDraftChangeListener((event) => {
      events.push(event);
    });

    saveRoomDraft(storage, ' room-1 ', 'hello draft');
    clearRoomDraft(storage, 'room-1');
    unsubscribe();
    saveRoomDraft(storage, 'room-1', 'ignored');

    expect(events).toEqual([
      { roomId: 'room-1', text: 'hello draft' },
      { roomId: 'room-1', text: '' },
    ]);
  });
});
