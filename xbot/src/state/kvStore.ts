import type { StateKeys } from './keys';
import {
  parseBindingState,
  parseMessageMapState,
  parseRealtimeStatusState,
  type BindingState,
  type MessageMapState,
  type RealtimeStatusState,
} from './schemas';

async function readJson(kv: KVNamespace, key: string): Promise<unknown | null> {
  const raw = await kv.get(key);
  if (raw == null) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function listKeyNames(kv: KVNamespace, prefix: string): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const page = await kv.list({ prefix, cursor });
    names.push(...page.keys.map((key) => key.name));

    if (page.list_complete) {
      return names;
    }

    if (page.cursor == null || page.cursor === '') {
      throw new Error(`KV list for prefix ${prefix} returned an incomplete page without a cursor`);
    }
    cursor = page.cursor;
  }
}

export class KvStateStore {
  constructor(
    private readonly kv: KVNamespace,
    private readonly keys: StateKeys,
  ) {}

  async getBinding(telegramUserId: string): Promise<BindingState | null> {
    return parseBindingState(await readJson(this.kv, this.keys.binding(telegramUserId)));
  }

  async setBinding(binding: BindingState): Promise<void> {
    await this.kv.put(this.keys.binding(binding.telegramUserId), JSON.stringify(binding));
  }

  async clearBinding(telegramUserId: string): Promise<void> {
    await this.kv.delete(this.keys.binding(telegramUserId));
  }

  async updateLastSeen(telegramUserId: string, messageId: string): Promise<void> {
    const binding = await this.getBinding(telegramUserId);
    if (binding == null) return;

    await this.setBinding({ ...binding, lastSeenMessageId: messageId });
  }

  async putMessageMap(map: MessageMapState): Promise<void> {
    const value = JSON.stringify(map);

    await Promise.all([
      this.kv.put(this.keys.telegramMap(map.telegramUserId, map.telegramMessageId), value),
      this.kv.put(this.keys.hhhlMap(map.roomId, map.hhhlMessageId), value),
    ]);
  }

  async getMessageMapByTelegram(
    telegramUserId: string,
    telegramMessageId: number,
  ): Promise<MessageMapState | null> {
    return parseMessageMapState(await readJson(this.kv, this.keys.telegramMap(telegramUserId, telegramMessageId)));
  }

  async getMessageMapByHhhl(roomId: string, hhhlMessageId: string): Promise<MessageMapState | null> {
    return parseMessageMapState(await readJson(this.kv, this.keys.hhhlMap(roomId, hhhlMessageId)));
  }

  async clearRoomMaps(telegramUserId: string, roomId: string): Promise<void> {
    const [telegramMapKeys, hhhlMapKeys] = await Promise.all([
      listKeyNames(this.kv, this.keys.telegramMapPrefix(telegramUserId)),
      listKeyNames(this.kv, this.keys.hhhlMapPrefix(roomId)),
    ]);
    const keyNames = [...new Set([...telegramMapKeys, ...hhhlMapKeys])];

    await Promise.all(keyNames.map((keyName) => this.kv.delete(keyName)));
  }

  async setStatus(telegramUserId: string, status: RealtimeStatusState): Promise<void> {
    await this.kv.put(this.keys.status(telegramUserId), JSON.stringify(status));
  }

  async getStatus(telegramUserId: string): Promise<RealtimeStatusState | null> {
    return parseRealtimeStatusState(await readJson(this.kv, this.keys.status(telegramUserId)));
  }
}
