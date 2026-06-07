import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ChatMessage } from '@/shared/types';
import { useChatStore, type ChatApiLike } from './chatStore';

const defaultUploadFile = vi.hoisted(() => vi.fn());
const defaultCreateToRoom = vi.hoisted(() => vi.fn());

vi.mock('@/files/fileApi', () => ({
  createFileApi: vi.fn(() => ({ uploadFile: defaultUploadFile })),
}));

vi.mock('./chatApi', () => ({
  createChatApi: vi.fn(() => ({
    roomTimeline: vi.fn(async () => []),
    createToRoom: defaultCreateToRoom,
    delete: vi.fn(async () => undefined),
    react: vi.fn(async () => undefined),
    unreact: vi.fn(async () => undefined),
    search: vi.fn(async () => []),
  })),
}));

const KEY_SEARCH_USER = { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' };
const VALID_KEY_TEXT = 'sk-AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const SECOND_VALID_KEY_TEXT = 'sk-0123456789abcdefghijklmnopqrstuv';

function message(id: string, createdAt = `2026-01-01T00:00:${id.slice(1).padStart(2, '0')}.000Z`): ChatMessage {
  return { id, roomId: 'room-1', createdAt, text: id };
}

function textMessage(id: string, text: string): ChatMessage {
  return { ...message(id), text };
}

function userTextMessage(id: string, text: string, user: NonNullable<ChatMessage['user']> = KEY_SEARCH_USER): ChatMessage {
  return { ...textMessage(id, text), user };
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
    defaultUploadFile.mockReset();
    defaultCreateToRoom.mockReset();
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

  it('uses a fallback local id when randomUUID is unavailable', async () => {
    const originalRandomUUID = crypto.randomUUID;
    const api = createApi();
    const store = useChatStore();

    try {
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
      await store.loadInitial('room-1', api);
      await store.sendText('hello', api, { now: () => '2026-01-01T00:00:03.000Z' });
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: originalRandomUUID });
    }

    expect(store.outgoing[0]?.localId).toMatch(/^local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(store.outgoing[0]).toMatchObject({ status: 'sent', serverId: 'm3' });
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

  it('normalizes uploaded file URLs before rendering pending and sent file messages', async () => {
    let resolveStarted: () => void = () => {
      throw new Error('create request did not start');
    };
    let resolveCreate: (message: ChatMessage) => void = () => {
      throw new Error('create response was not awaited');
    };
    const createStarted = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const createResponse = new Promise<ChatMessage>((resolve) => {
      resolveCreate = resolve;
    });
    const api = createApi({
      createToRoom: vi.fn(async () => {
        resolveStarted();
        return createResponse;
      }),
    });
    const uploadFile = vi.fn(async () => ({
      id: 'file-1',
      name: 'photo.png',
      type: 'image/png',
      url: '/files/photo.png',
      thumbnailUrl: '/files/photo-thumb.png',
    }));
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const send = store.sendFile(new File(['photo'], 'photo.png', { type: 'image/png' }), { uploadFile }, api, {
      idFactory: () => 'local-file-1',
      now: () => '2026-01-01T00:00:03.000Z',
    });
    await createStarted;

    const pending = store.timeline.find((entry) => entry.kind === 'pending');
    expect(pending?.message.file).toMatchObject({
      url: 'https://dc.hhhl.cc/files/photo.png',
      thumbnailUrl: 'https://dc.hhhl.cc/files/photo-thumb.png',
    });

    resolveCreate({
      id: 'm3',
      roomId: 'room-1',
      createdAt: '2026-01-01T00:00:03.000Z',
      text: null,
      file: { id: 'file-1', name: 'photo.png', type: 'image/png' },
    });
    await send;

    const sent = store.timeline.find((entry) => entry.message.id === 'm3');
    expect(sent?.message.file).toMatchObject({
      url: 'https://dc.hhhl.cc/files/photo.png',
      thumbnailUrl: 'https://dc.hhhl.cc/files/photo-thumb.png',
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

  it('shows optimistic reactions in the timeline before the API responds', async () => {
    let resolveReaction: () => void = () => {
      throw new Error('reaction request did not start');
    };
    const api = createApi({
      react: vi.fn(async () => {
        await new Promise<void>((resolve) => { resolveReaction = resolve; });
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const reactionRequest = store.react('m1', '👍', api);

    expect(store.timeline[0]?.message.reactions).toEqual([{ reaction: '👍', count: 1, reacted: true }]);

    resolveReaction();
    await reactionRequest;
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

  it('replaces search results for new queries and appends explicit continuations', async () => {
    const api = createApi({
      search: vi.fn(async (params) => params.query === 'bye' ? [message('m4')] : [message(params.untilId === 'm2' ? 'm3' : 'm2')]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: 'hello' }, api);
    expect(store.searchResults.map((item) => item.id)).toEqual(['m2']);
    await store.searchMessages({ query: 'hello', untilId: 'm2' }, api);
    expect(store.searchResults.map((item) => item.id)).toEqual(['m2', 'm3']);
    await store.searchMessages({ query: 'hello', userId: 'user-2', untilId: 'm3' }, api);
    expect(store.searchResults.map((item) => item.id)).toEqual(['m2']);
    await store.searchMessages({ query: 'bye' }, api);

    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'hello', limit: 30 });
    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'hello', untilId: 'm2', limit: 30 });
    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'hello', userId: 'user-2', untilId: 'm3', limit: 30 });
    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'bye', limit: 30 });
    expect(store.searchQuery).toBe('bye');
    expect(store.searchResults.map((item) => item.id)).toEqual(['m4']);
  });

  it('tracks search pagination and appends load-more results without duplicates', async () => {
    const api = createApi({
      search: vi.fn(async (params) => {
        if (params.untilId === 'm30') {
          return [message('m2'), message('m3')];
        }
        return Array.from({ length: 30 }, (_value, index) => message(`m${index + 1}`));
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: 'hello' }, api);
    await store.loadMoreSearchResults(api);

    expect(store.searchHasMore).toBe(false);
    expect(store.searchResults.map((item) => item.id).filter((id) => id === 'm2')).toHaveLength(1);
    expect(store.searchResults.at(-1)?.id).toBe('m3');
  });

  it('searches all messages for a selected member and preserves the member filter when loading more', async () => {
    const api = createApi({
      roomTimeline: vi.fn(async (_roomId, params) => {
        if (params?.untilId === 'm30') {
          return [
            userTextMessage('m31', 'from alice', { id: 'user-1', username: 'alice', name: 'Alice' }),
            userTextMessage('m32', 'from bob', { id: 'user-2', username: 'bob', name: 'Bob' }),
          ];
        }

        return Array.from({ length: 30 }, (_value, index) => {
          const id = `m${index + 1}`;
          return userTextMessage(
            id,
            id,
            index % 2 === 0
              ? { id: 'user-2', username: 'bob', name: 'Bob' }
              : { id: 'user-1', username: 'alice', name: 'Alice' },
          );
        });
      }),
      search: vi.fn(async () => {
        throw new Error('member-only search should not call chat/messages/search');
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: '   ', userId: ' user-2 ' }, api);
    await store.loadMoreSearchResults(api);

    expect(api.search).not.toHaveBeenCalled();
    expect(api.roomTimeline).toHaveBeenCalledWith('room-1', { limit: 30 });
    expect(api.roomTimeline).toHaveBeenCalledWith('room-1', { limit: 30, untilId: 'm30' });
    expect(store.searchQuery).toBe('');
    expect(store.searchUserId).toBe('user-2');
    expect(store.searchResults.map((item) => item.id)).toEqual([
      ...Array.from({ length: 15 }, (_value, index) => `m${index * 2 + 1}`),
      'm32',
    ]);
  });

  it('ignores stale search results after switching away and back while search is pending', async () => {
    let resolveSearch: (messages: ChatMessage[]) => void = () => {
      throw new Error('search resolver was not set');
    };
    const searchResponse = new Promise<ChatMessage[]>((resolve) => {
      resolveSearch = resolve;
    });
    const searchApi = createApi({
      search: vi.fn(async () => searchResponse),
    });
    const room2Api = createApi({
      roomTimeline: vi.fn(async () => [{ ...message('m8'), roomId: 'room-2' }]),
    });
    const room1AgainApi = createApi({
      roomTimeline: vi.fn(async () => [{ ...message('m9'), roomId: 'room-1' }]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const search = store.searchMessages({ query: 'hello' }, searchApi);
    expect(store.searchLoading).toBe(true);

    await store.loadInitial('room-2', room2Api);
    await store.loadInitial('room-1', room1AgainApi);
    resolveSearch([{ ...message('m1'), roomId: 'room-1', text: 'stale hello' }]);
    await search;

    expect(searchApi.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'hello', limit: 30 });
    expect(store.roomId).toBe('room-1');
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m9']);
    expect(store.searchQuery).toBeNull();
    expect(store.searchResults).toEqual([]);
    expect(store.searchHasMore).toBe(false);
    expect(store.searchError).toBeNull();
    expect(store.searchLoading).toBe(false);
  });

  it('loads message context before jumping to a search result outside the current timeline', async () => {
    const context = vi.fn(async () => [message('m0', '2025-12-31T23:59:59.000Z'), message('m9', '2026-01-01T00:00:09.000Z')]);
    const api = { ...createApi(), context } as ChatApiLike & { context: (messageId: string) => Promise<ChatMessage[]> };
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const loaded = await store.ensureMessageVisible('m9', api);

    expect(loaded).toBe(true);
    expect(context).toHaveBeenCalledWith('m9');
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m0', 'm1', 'm2', 'm9']);
  });

  it('keeps key search results separate from normal message search', async () => {
    const api = createApi({
      search: vi.fn(async (params) => params.query === 'sk-' ? [userTextMessage('key-1', VALID_KEY_TEXT)] : [message('m2')]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: 'hello' }, api);
    await store.searchKeyMessages(api);

    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'hello', limit: 30 });
    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'sk-', userId: 'amk1v51gkh1u0001', limit: 30 });
    expect(store.searchResults.map((item) => item.id)).toEqual(['m2']);
    expect(store.keySearchResults.map((item) => item.id)).toEqual(['key-1']);
  });

  it('only shows key search results whose full text is an exact key token', async () => {
    const api = createApi({
      search: vi.fn(async () => [
        userTextMessage('key-1', VALID_KEY_TEXT),
        userTextMessage('key-2', `${VALID_KEY_TEXT} extra`),
        userTextMessage('key-3', `prefix ${VALID_KEY_TEXT}`),
        userTextMessage('key-4', ` ${VALID_KEY_TEXT}`),
        userTextMessage('key-5', 'sk-test-secret'),
      ]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchKeyMessages(api);

    expect(store.keySearchResults.map((item) => item.id)).toEqual(['key-1']);
  });

  it('verifies direct key search results without sender details', async () => {
    const api = {
      ...createApi({
        search: vi.fn(async (params) => params.userId === 'amk1v51gkh1u0001' ? [textMessage('key-1', VALID_KEY_TEXT)] : []),
      }),
      show: vi.fn(async () => userTextMessage('key-1', VALID_KEY_TEXT)),
    } as ChatApiLike & { show: (messageId: string) => Promise<ChatMessage> };
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchKeyMessages(api);

    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'sk-', userId: 'amk1v51gkh1u0001', limit: 30 });
    expect(api.show).toHaveBeenCalledWith('key-1');
    expect(store.keySearchResults.map((item) => item.id)).toEqual(['key-1']);
  });

  it('does not show key results without a verified target sender', async () => {
    const api = createApi({
      search: vi.fn(async () => [
        userTextMessage('key-1', VALID_KEY_TEXT),
        userTextMessage('key-2', SECOND_VALID_KEY_TEXT, { id: 'user-2', username: 'alice', name: 'Alice' }),
        textMessage('key-3', VALID_KEY_TEXT),
      ]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchKeyMessages(api);

    expect(api.search).toHaveBeenCalledOnce();
    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'sk-', userId: 'amk1v51gkh1u0001', limit: 30 });
    expect(store.keySearchResults.map((item) => item.id)).toEqual(['key-1']);
  });

  it('verifies query-only key search fallback before showing results', async () => {
    const api = {
      ...createApi({
      search: vi.fn(async (params) => params.userId == null
        ? [
          userTextMessage('key-1', VALID_KEY_TEXT),
          userTextMessage('key-2', SECOND_VALID_KEY_TEXT, { id: 'user-2', username: 'alice', name: 'Alice' }),
          textMessage('key-3', SECOND_VALID_KEY_TEXT),
        ]
        : []),
      }),
      show: vi.fn(async () => userTextMessage('key-3', SECOND_VALID_KEY_TEXT)),
    } as ChatApiLike & { show: (messageId: string) => Promise<ChatMessage> };
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchKeyMessages(api);

    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'sk-', userId: 'amk1v51gkh1u0001', limit: 30 });
    expect(api.search).toHaveBeenCalledWith({ roomId: 'room-1', query: 'sk-', limit: 30 });
    expect(api.show).toHaveBeenCalledWith('key-3');
    expect(store.keySearchResults.map((item) => item.id)).toEqual(['key-1', 'key-3']);
  });

  it('does not show query-only key results when sender details cannot be verified', async () => {
    const api = {
      ...createApi({
        search: vi.fn(async (params) => params.userId == null ? [textMessage('key-1', VALID_KEY_TEXT)] : []),
      }),
      show: vi.fn(async () => textMessage('key-1', VALID_KEY_TEXT)),
    } as ChatApiLike & { show: (messageId: string) => Promise<ChatMessage> };
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchKeyMessages(api);

    expect(store.keySearchResults).toEqual([]);
  });

  it('clears stale search state when switching rooms', async () => {
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: 'hello' }, createApi());
    await store.searchKeyMessages(createApi({ search: vi.fn(async () => [userTextMessage('key-1', VALID_KEY_TEXT)]) }));
    expect(store.searchResults).toHaveLength(1);
    expect(store.keySearchResults).toHaveLength(1);

    await store.loadInitial('room-2', createApi());

    expect(store.searchQuery).toBeNull();
    expect(store.searchResults).toEqual([]);
    expect(store.keySearchResults).toEqual([]);
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

  it('returns structured text send results for success and failure', async () => {
    const successApi = createApi();
    const failingApi = createApi({
      createToRoom: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', successApi);

    const success = await store.sendText('hello', successApi, {
      idFactory: () => 'local-success',
      now: () => '2026-01-01T00:00:03.000Z',
    });
    const failure = await store.sendText('bye', failingApi, {
      idFactory: () => 'local-failure',
      now: () => '2026-01-01T00:00:04.000Z',
    });

    expect(success).toEqual({ ok: true, localId: 'local-success', serverId: 'm3' });
    expect(failure).toEqual({ ok: false, localId: 'local-failure', stage: 'send', error: 'send failed' });
  });

  it('returns upload-stage and send-stage file results separately', async () => {
    const uploadFailure = vi.fn(async () => {
      throw new Error('upload failed');
    });
    const sendFailureApi = createApi({
      createToRoom: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const uploadSuccess = vi.fn(async (_file: File, onProgress?: (progress: number) => void) => {
      onProgress?.(0.5);
      return { id: 'file-1', name: 'hello.txt' };
    });
    const progress = vi.fn();
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());

    const uploadResult = await store.sendFile(
      new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      { uploadFile: uploadFailure },
      createApi(),
      { idFactory: () => 'local-upload', now: () => '2026-01-01T00:00:03.000Z' },
      progress,
    );
    const sendResult = await store.sendFile(
      new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      { uploadFile: uploadSuccess },
      sendFailureApi,
      { idFactory: () => 'local-send', now: () => '2026-01-01T00:00:04.000Z' },
      progress,
    );

    expect(uploadResult).toEqual({ ok: false, stage: 'upload', error: 'upload failed' });
    expect(sendResult).toEqual({ ok: false, localId: 'local-send', stage: 'send', error: 'send failed' });
    expect(progress).toHaveBeenCalledWith(0.5);
  });

  it('ignores stale initial responses after the active room changes', async () => {
    let resolveRoom1: (messages: ChatMessage[]) => void = () => {
      throw new Error('room-1 resolver was not set');
    };
    const room1Response = new Promise<ChatMessage[]>((resolve) => {
      resolveRoom1 = resolve;
    });
    const api = createApi({
      roomTimeline: vi.fn(async (roomId) => {
        if (roomId === 'room-1') {
          return room1Response;
        }
        return [{ ...message('m8'), roomId: 'room-2' }];
      }),
    });
    const store = useChatStore();

    const firstLoad = store.loadInitial('room-1', api);
    await store.loadInitial('room-2', api);
    resolveRoom1([{ ...message('m1'), roomId: 'room-1' }]);
    await firstLoad;

    expect(store.roomId).toBe('room-2');
    expect(store.timeline.map((entry) => entry.message.roomId)).toEqual(['room-2']);
  });

  it('ignores stale initial responses after returning to the same room', async () => {
    let resolveFirstRoom1: (messages: ChatMessage[]) => void = () => {
      throw new Error('first room-1 resolver was not set');
    };
    const firstRoom1Response = new Promise<ChatMessage[]>((resolve) => {
      resolveFirstRoom1 = resolve;
    });
    let room1Calls = 0;
    const api = createApi({
      roomTimeline: vi.fn(async (roomId) => {
        if (roomId === 'room-1') {
          room1Calls += 1;
          if (room1Calls === 1) {
            return firstRoom1Response;
          }
          return [{ ...message('m9'), roomId: 'room-1' }];
        }
        return [{ ...message('m8'), roomId: 'room-2' }];
      }),
    });
    const store = useChatStore();

    const firstLoad = store.loadInitial('room-1', api);
    await store.loadInitial('room-2', api);
    await store.loadInitial('room-1', api);
    resolveFirstRoom1([{ ...message('m1'), roomId: 'room-1' }]);
    await firstLoad;

    expect(store.roomId).toBe('room-1');
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m9']);
  });

  it('ignores stale pagination responses after returning to the same room', async () => {
    let resolveOlder: (messages: ChatMessage[]) => void = () => {
      throw new Error('older resolver was not set');
    };
    let resolveNewer: (messages: ChatMessage[]) => void = () => {
      throw new Error('newer resolver was not set');
    };
    const olderResponse = new Promise<ChatMessage[]>((resolve) => {
      resolveOlder = resolve;
    });
    const newerResponse = new Promise<ChatMessage[]>((resolve) => {
      resolveNewer = resolve;
    });
    let room1InitialCalls = 0;
    const api = createApi({
      roomTimeline: vi.fn(async (roomId, params) => {
        if (params?.untilId === 'm1') {
          return olderResponse;
        }
        if (params?.sinceId === 'm2') {
          return newerResponse;
        }
        if (roomId === 'room-1') {
          room1InitialCalls += 1;
          return room1InitialCalls === 1 ? [message('m1'), message('m2')] : [{ ...message('m9'), roomId: 'room-1' }];
        }
        return [{ ...message('m8'), roomId: 'room-2' }];
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', api);
    const olderLoad = store.loadOlder(api);
    const newerLoad = store.loadNewer(api);
    await store.loadInitial('room-2', api);
    await store.loadInitial('room-1', api);
    resolveOlder([{ ...message('m0'), roomId: 'room-1' }]);
    resolveNewer([{ ...message('m3'), roomId: 'room-1' }]);
    await Promise.all([olderLoad, newerLoad]);

    expect(store.roomId).toBe('room-1');
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m9']);
  });

  it('does not let stale text send completion mutate a later same-room session', async () => {
    let resolveFirstSend: (message: ChatMessage) => void = () => {
      throw new Error('first send resolver was not set');
    };
    let resolveSecondSend: (message: ChatMessage) => void = () => {
      throw new Error('second send resolver was not set');
    };
    const firstSendResponse = new Promise<ChatMessage>((resolve) => {
      resolveFirstSend = resolve;
    });
    const secondSendResponse = new Promise<ChatMessage>((resolve) => {
      resolveSecondSend = resolve;
    });
    const firstSendApi = createApi({
      createToRoom: vi.fn(async () => firstSendResponse),
    });
    const secondSendApi = createApi({
      createToRoom: vi.fn(async () => secondSendResponse),
    });
    const room2Api = createApi({
      roomTimeline: vi.fn(async () => [{ ...message('m8'), roomId: 'room-2' }]),
    });
    const room1AgainApi = createApi({
      roomTimeline: vi.fn(async () => [{ ...message('m9'), roomId: 'room-1' }]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const firstSend = store.sendText('first', firstSendApi, {
      idFactory: () => 'local-repeat',
      now: () => '2026-01-01T00:00:03.000Z',
    });
    await store.loadInitial('room-2', room2Api);
    await store.loadInitial('room-1', room1AgainApi);
    const secondSend = store.sendText('second', secondSendApi, {
      idFactory: () => 'local-repeat',
      now: () => '2026-01-01T00:00:10.000Z',
    });

    resolveFirstSend({ id: 'm-first', roomId: 'room-1', createdAt: '2026-01-01T00:00:03.000Z', text: 'first' });
    const firstResult = await firstSend;

    const pending = store.timeline.find((entry) => entry.kind === 'pending' && entry.localId === 'local-repeat');
    expect(firstResult).toEqual({ ok: true, localId: 'local-repeat', serverId: 'm-first' });
    expect(pending?.message.text).toBe('second');
    expect(store.outgoing[0]).toMatchObject({ localId: 'local-repeat', status: 'pending' });

    resolveSecondSend({ id: 'm-second', roomId: 'room-1', createdAt: '2026-01-01T00:00:10.000Z', text: 'second' });
    await secondSend;
  });

  it('supports sendFile(file, onProgress) with default transports', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const progress = vi.fn();
    defaultUploadFile.mockImplementation(async (_file: File, onProgress?: (progress: number) => void) => {
      onProgress?.(0.75);
      return { id: 'file-default', name: 'hello.txt' };
    });
    defaultCreateToRoom.mockImplementation(async (params) => ({
      id: 'm-default',
      roomId: params.toRoomId,
      createdAt: '2026-01-01T00:00:03.000Z',
      text: null,
    }));
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const result = await store.sendFile(file, progress);

    expect(defaultUploadFile).toHaveBeenCalledWith(file, progress);
    expect(defaultCreateToRoom).toHaveBeenCalledWith({ toRoomId: 'room-1', fileId: 'file-default' });
    expect(progress).toHaveBeenCalledWith(0.75);
    expect(result).toMatchObject({ ok: true, serverId: 'm-default' });
    if (result.ok) {
      expect(result.localId).toMatch(/^local-/);
    }
  });

  it('does not enqueue or send stale files after the active room changes during upload', async () => {
    let resolveUpload: (file: { id: string; name: string }) => void = () => {
      throw new Error('upload resolver was not set');
    };
    const uploadResponse = new Promise<{ id: string; name: string }>((resolve) => {
      resolveUpload = resolve;
    });
    const uploadFile = vi.fn(async () => uploadResponse);
    const sendApi = createApi();
    const room2Api = createApi({
      roomTimeline: vi.fn(async () => [{ ...message('m8'), roomId: 'room-2' }]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const send = store.sendFile(
      new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      { uploadFile },
      sendApi,
      { idFactory: () => 'local-stale-file', now: () => '2026-01-01T00:00:03.000Z' },
    );
    await store.loadInitial('room-2', room2Api);
    resolveUpload({ id: 'file-1', name: 'hello.txt' });

    const result = await send;

    expect(result).toEqual({ ok: false, stage: 'send', error: 'Room changed before file could be sent' });
    expect(sendApi.createToRoom).not.toHaveBeenCalled();
    expect(store.roomId).toBe('room-2');
    expect(store.error).toBeNull();
    expect(store.outgoing).toEqual([]);
    expect(store.timeline.map((entry) => entry.message.roomId)).toEqual(['room-2']);
  });

  it('does not set the new room error when upload fails after the active room changes', async () => {
    let rejectUpload: (error: unknown) => void = () => {
      throw new Error('upload rejecter was not set');
    };
    const uploadResponse = new Promise<{ id: string; name: string }>((_resolve, reject) => {
      rejectUpload = reject;
    });
    const uploadFile = vi.fn(async () => uploadResponse);
    const room2Api = createApi({
      roomTimeline: vi.fn(async () => [{ ...message('m8'), roomId: 'room-2' }]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    const send = store.sendFile(
      new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      { uploadFile },
      createApi(),
      { idFactory: () => 'local-stale-upload', now: () => '2026-01-01T00:00:03.000Z' },
    );
    await store.loadInitial('room-2', room2Api);
    rejectUpload(new Error('upload failed'));

    const result = await send;

    expect(result).toEqual({ ok: false, stage: 'upload', error: 'upload failed' });
    expect(store.roomId).toBe('room-2');
    expect(store.error).toBeNull();
    expect(store.outgoing).toEqual([]);
    expect(store.timeline.map((entry) => entry.message.roomId)).toEqual(['room-2']);
  });

  it('resets pagination loading flags when switching rooms during pagination', async () => {
    let resolveOlder: (messages: ChatMessage[]) => void = () => {
      throw new Error('older resolver was not set');
    };
    let resolveNewer: (messages: ChatMessage[]) => void = () => {
      throw new Error('newer resolver was not set');
    };
    const olderResponse = new Promise<ChatMessage[]>((resolve) => {
      resolveOlder = resolve;
    });
    const newerResponse = new Promise<ChatMessage[]>((resolve) => {
      resolveNewer = resolve;
    });
    const paginationApi = createApi({
      roomTimeline: vi.fn(async (_roomId, params) => {
        if (params?.untilId === 'm1') {
          return olderResponse;
        }
        if (params?.sinceId === 'm2') {
          return newerResponse;
        }
        return [message('m1'), message('m2')];
      }),
    });
    const room2Api = createApi({
      roomTimeline: vi.fn(async () => [{ ...message('m8'), roomId: 'room-2' }]),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', paginationApi);
    const olderLoad = store.loadOlder(paginationApi);
    const newerLoad = store.loadNewer(paginationApi);
    expect(store.olderLoading).toBe(true);
    expect(store.newerLoading).toBe(true);

    await store.loadInitial('room-2', room2Api);

    expect(store.olderLoading).toBe(false);
    expect(store.newerLoading).toBe(false);

    resolveOlder([{ ...message('m0'), roomId: 'room-1' }]);
    resolveNewer([{ ...message('m3'), roomId: 'room-1' }]);
    await Promise.all([olderLoad, newerLoad]);

    expect(store.olderLoading).toBe(false);
    expect(store.newerLoading).toBe(false);
    expect(store.timeline.map((entry) => entry.message.roomId)).toEqual(['room-2']);
  });
});
