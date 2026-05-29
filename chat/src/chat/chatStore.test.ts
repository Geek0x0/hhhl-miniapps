import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ChatMessage } from '@/shared/types';
import { useChatStore, type ChatApiLike } from './chatStore';

function message(id: string, createdAt = `2026-01-01T00:00:${id.slice(1).padStart(2, '0')}.000Z`): ChatMessage {
  return { id, roomId: 'room-1', createdAt, text: id };
}

function createApi(overrides: Partial<ChatApiLike> = {}): ChatApiLike {
  return {
    roomTimeline: vi.fn(async () => [message('m1'), message('m2')]),
    createToRoom: vi.fn(async (params) => ({ id: 'm3', roomId: params.toRoomId, createdAt: '2026-01-01T00:00:03.000Z', text: params.text ?? null, replyId: params.replyId, quoteId: params.quoteId })),
    delete: vi.fn(async () => undefined),
    react: vi.fn(async () => undefined),
    unreact: vi.fn(async () => undefined),
    search: vi.fn(async () => [message('m2')]),
    ...overrides,
  };
}

describe('chatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('loads initial and older timeline messages', async () => {
    const api = createApi({
      roomTimeline: vi.fn(async (_roomId, params) => params?.untilId === 'm1' ? [message('m0', '2025-12-31T23:59:59.000Z')] : [message('m1'), message('m2')]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', api);
    await store.loadOlder(api);

    expect(api.roomTimeline).toHaveBeenCalledWith('room-1', { limit: 30 });
    expect(api.roomTimeline).toHaveBeenCalledWith('room-1', { limit: 30, untilId: 'm1' });
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m0', 'm1', 'm2']);
  });

  it('loads newer messages with sinceId and guards concurrent refreshes', async () => {
    let releaseNewer: () => void = () => {
      throw new Error('newer request did not start');
    };
    let newerStarted = false;
    const api = createApi({
      roomTimeline: vi.fn(async (_roomId, params) => {
        if (params?.sinceId === 'm2') {
          newerStarted = true;
          await new Promise<void>((resolve) => { releaseNewer = resolve; });
          return [message('m3')];
        }

        return [message('m1'), message('m2')];
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', api);
    const firstLoad = store.loadNewer(api);
    const secondLoad = store.loadNewer(api);

    expect(newerStarted).toBe(true);
    releaseNewer();
    await Promise.all([firstLoad, secondLoad]);

    expect(api.roomTimeline).toHaveBeenCalledWith('room-1', { limit: 30, sinceId: 'm2' });
    expect(api.roomTimeline).toHaveBeenCalledTimes(2);
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('tracks older loading state and stops when the server has no older page', async () => {
    const api = createApi({
      roomTimeline: vi.fn(async (_roomId, params) => params?.untilId === 'm1' ? [] : [message('m1'), message('m2')]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', api);
    await store.loadOlder(api);
    await store.loadOlder(api);

    expect(api.roomTimeline).toHaveBeenCalledTimes(2);
    expect(store.hasMoreOlder).toBe(false);
    expect(store.olderLoading).toBe(false);
  });

  it('sends text and replaces the pending local message on success', async () => {
    const api = createApi();
    const store = useChatStore();

    await store.loadInitial('room-1', api);
    await store.sendText('hello', api, { idFactory: () => 'local-1', now: () => '2026-01-01T00:00:03.000Z' });

    expect(api.createToRoom).toHaveBeenCalledWith({ toRoomId: 'room-1', text: 'hello' });
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m1', 'm2', 'm3']);
    expect(store.outgoing[0]).toMatchObject({ localId: 'local-1', status: 'sent', serverId: 'm3' });
  });

  it('uploads a file before sending and preserves fileId when sending fails', async () => {
    const api = createApi({
      createToRoom: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const uploadFile = vi.fn(async () => ({ id: 'file-1', name: 'hello.txt' }));
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.sendFile(new File(['hello'], 'hello.txt', { type: 'text/plain' }), { uploadFile }, api, {
      idFactory: () => 'local-file-1',
      now: () => '2026-01-01T00:00:03.000Z',
    });

    expect(uploadFile).toHaveBeenCalled();
    expect(api.createToRoom).toHaveBeenCalledWith({ toRoomId: 'room-1', fileId: 'file-1' });
    expect(store.outgoing[0]).toMatchObject({
      localId: 'local-file-1',
      status: 'failed',
      payload: { toRoomId: 'room-1', fileId: 'file-1' },
    });
  });

  it('marks failed sends and retries them', async () => {
    const failingApi = createApi({
      createToRoom: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const successApi = createApi();
    const store = useChatStore();

    await store.loadInitial('room-1', successApi);
    await store.sendText('hello', failingApi, { idFactory: () => 'local-1', now: () => '2026-01-01T00:00:03.000Z' });
    await store.retryMessage('local-1', successApi);

    expect(store.outgoing[0]).toMatchObject({ localId: 'local-1', status: 'sent', serverId: 'm3' });
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('rolls back optimistic deletion when the API fails', async () => {
    const api = createApi({
      delete: vi.fn(async () => {
        throw new Error('delete failed');
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.deleteMessage('m1', api);

    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m1', 'm2']);
    expect(store.error).toBe('delete failed');
  });

  it('rolls back optimistic reactions when the API fails', async () => {
    const api = createApi({
      react: vi.fn(async () => {
        throw new Error('react failed');
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.react('m1', '👍', api);

    expect(store.reactionsByMessageId.m1).toBeUndefined();
    expect(store.error).toBe('react failed');
  });

  it('tracks reply and quote targets and clears composer context on room switch', async () => {
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    store.setReplyTarget(message('m1'));
    store.setQuoteTarget(message('m2'));
    expect(store.replyTarget?.id).toBe('m1');
    expect(store.quoteTarget?.id).toBe('m2');

    await store.loadInitial('room-2', createApi());
    expect(store.replyTarget).toBeNull();
    expect(store.quoteTarget).toBeNull();
  });

  it('searches messages with room, query, user, and pagination params', async () => {
    const api = createApi();
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: 'hello', userId: 'user-1' }, api);
    await store.searchMessages({ query: 'hello', untilId: 'm2' }, api);

    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'hello', userId: 'user-1', limit: 30 });
    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'hello', untilId: 'm2', limit: 30 });
    expect(store.searchResults.map((item) => item.id)).toEqual(['m2', 'm2']);
  });

  it('exposes search permission failure states', async () => {
    const api = createApi({
      search: vi.fn(async () => {
        throw new Error('permission denied');
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: 'hello' }, api);

    expect(store.searchError).toBe('permission denied');
  });
});
