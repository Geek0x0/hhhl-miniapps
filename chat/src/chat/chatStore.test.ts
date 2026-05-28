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

  it('sends text and replaces the pending local message on success', async () => {
    const api = createApi();
    const store = useChatStore();

    await store.loadInitial('room-1', api);
    await store.sendText('hello', api, { idFactory: () => 'local-1', now: () => '2026-01-01T00:00:03.000Z' });

    expect(api.createToRoom).toHaveBeenCalledWith({ toRoomId: 'room-1', text: 'hello' });
    expect(store.timeline.map((entry) => entry.message.id)).toEqual(['m1', 'm2', 'm3']);
    expect(store.outgoing[0]).toMatchObject({ localId: 'local-1', status: 'sent', serverId: 'm3' });
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
});
