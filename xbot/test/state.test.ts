import { createFakeKV } from './fakes';
import { createKeys } from '../src/state/keys';
import { KvStateStore } from '../src/state/kvStore';
import type { BindingState, MessageMapState, RealtimeStatusState } from '../src/state/schemas';

describe('state keys', () => {
  it('builds stable scoped keys and prefixes', () => {
    const keys = createKeys('xbot');

    expect(keys.binding('42')).toBe('xbot:binding:42');
    expect(keys.telegramMap('42', 100)).toBe('xbot:map:telegram:42:100');
    expect(keys.telegramMapPrefix('42')).toBe('xbot:map:telegram:42:');
    expect(keys.hhhlMap('room-1', 'm1')).toBe('xbot:map:hhhl:room-1:m1');
    expect(keys.hhhlMapPrefix('room-1')).toBe('xbot:map:hhhl:room-1:');
    expect(keys.status('42')).toBe('xbot:status:42');
  });
});

describe('KvStateStore', () => {
  it('stores binding, message maps, and realtime status', async () => {
    const kv = createFakeKV();
    const store = new KvStateStore(kv, createKeys('xbot'));
    const binding: BindingState = {
      version: 1,
      telegramUserId: '42',
      roomId: 'room-1',
      roomName: '测试房间',
      boundAt: '2026-06-08T00:00:00.000Z',
      lastSeenMessageId: null,
    };
    const map: MessageMapState = {
      version: 1,
      roomId: 'room-1',
      hhhlMessageId: 'm1',
      telegramUserId: '42',
      telegramMessageId: 100,
      createdAt: '2026-06-08T00:00:01.000Z',
    };
    const status: RealtimeStatusState = {
      version: 1,
      state: 'connected',
      connectedAt: '2026-06-08T00:00:02.000Z',
      lastError: null,
      nextReconnectAt: null,
    };

    await store.setBinding(binding);
    await store.putMessageMap(map);
    await store.setStatus('42', status);

    await expect(store.getBinding('42')).resolves.toEqual(binding);
    await expect(store.getMessageMapByTelegram('42', 100)).resolves.toEqual(map);
    await expect(store.getMessageMapByHhhl('room-1', 'm1')).resolves.toEqual(map);
    await expect(store.getStatus('42')).resolves.toEqual(status);
  });

  it('updates the binding last seen message id', async () => {
    const kv = createFakeKV();
    const store = new KvStateStore(kv, createKeys('xbot'));

    await store.setBinding({
      version: 1,
      telegramUserId: '42',
      roomId: 'room-1',
      roomName: 'room-1',
      boundAt: '2026-06-08T00:00:00.000Z',
      lastSeenMessageId: null,
    });

    await store.updateLastSeen('42', 'm2');

    await expect(store.getBinding('42')).resolves.toMatchObject({ lastSeenMessageId: 'm2' });
  });

  it('clears binding and maps for a room', async () => {
    const kv = createFakeKV();
    const store = new KvStateStore(kv, createKeys('xbot'));

    await store.setBinding({
      version: 1,
      telegramUserId: '42',
      roomId: 'room-1',
      roomName: 'room-1',
      boundAt: '2026-06-08T00:00:00.000Z',
      lastSeenMessageId: 'm1',
    });
    await store.putMessageMap({
      version: 1,
      roomId: 'room-1',
      hhhlMessageId: 'm1',
      telegramUserId: '42',
      telegramMessageId: 100,
      createdAt: '2026-06-08T00:00:01.000Z',
    });

    await store.clearBinding('42');
    await store.clearRoomMaps('42', 'room-1');

    await expect(store.getBinding('42')).resolves.toBeNull();
    await expect(store.getMessageMapByTelegram('42', 100)).resolves.toBeNull();
    await expect(store.getMessageMapByHhhl('room-1', 'm1')).resolves.toBeNull();
  });

  it('clears room maps across all paginated KV list pages', async () => {
    const kv = createFakeKV({ pageSize: 2 });
    const store = new KvStateStore(kv, createKeys('xbot'));
    const maps: MessageMapState[] = [1, 2, 3].map((id) => ({
      version: 1,
      roomId: 'room-1',
      hhhlMessageId: `m${id}`,
      telegramUserId: '42',
      telegramMessageId: 100 + id,
      createdAt: `2026-06-08T00:00:0${id}.000Z`,
    }));

    for (const map of maps) {
      await store.putMessageMap(map);
    }

    await store.clearRoomMaps('42', 'room-1');

    for (const map of maps) {
      await expect(store.getMessageMapByTelegram('42', map.telegramMessageId)).resolves.toBeNull();
      await expect(store.getMessageMapByHhhl('room-1', map.hhhlMessageId)).resolves.toBeNull();
    }
    expect(kv.listCalls).toEqual(
      expect.arrayContaining([
        { prefix: 'xbot:map:telegram:42:', cursor: '2' },
        { prefix: 'xbot:map:hhhl:room-1:', cursor: '2' },
      ]),
    );
  });
});
