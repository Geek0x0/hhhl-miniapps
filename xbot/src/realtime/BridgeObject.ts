import { DurableObject } from 'cloudflare:workers';
import type { BridgeUserObject } from '../bridge/commands';
import { forwardHhhlMessageToTelegram } from '../bridge/outbound';
import { readConfig } from '../config';
import type { Env } from '../env';
import { HhhlApiClient } from '../hhhl/apiClient';
import { createHhhlChatApi } from '../hhhl/chatApi';
import { createKeys } from '../state/keys';
import { KvStateStore } from '../state/kvStore';
import type { RealtimeStatusState } from '../state/schemas';
import { TelegramApi } from '../telegram/api';
import { BridgeRuntime } from './bridgeRuntime';

const STORAGE_TELEGRAM_USER_ID = 'telegramUserId';
const STORAGE_RECONNECT_FAILURE_COUNT = 'reconnectFailureCount';

type StorageWithOptionalAlarm = DurableObjectStorage & {
  deleteAlarm?: () => Promise<void>;
};

export class BridgeObject extends DurableObject<Env> implements BridgeUserObject {
  private lifecycleGeneration = 0;
  private runtime: BridgeRuntime | null = null;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async start(telegramUserId: string): Promise<void> {
    const generation = this.beginLifecycleGeneration();

    const configResult = readConfig(this.env);
    if (!configResult.ok) {
      throw new Error(`invalid xbot config: ${configResult.error}`);
    }
    const config = configResult.value;
    const store = new KvStateStore(this.env.XBOT_STATE, createKeys(config.kvKeyPrefix));
    const binding = await store.getBinding(telegramUserId);
    if (!this.isCurrentLifecycle(generation)) return;

    if (binding == null) {
      await this.stopRuntime();
      await store.setStatus(telegramUserId, stoppedStatus());
      await this.clearPersistedStartState();
      return;
    }

    const hhhlClient = new HhhlApiClient({
      baseUrl: config.hhhlApiBaseUrl,
      token: config.hhhlToken,
    });
    const chatApi = createHhhlChatApi(hhhlClient);
    const me = await chatApi.me();
    if (!this.isCurrentLifecycle(generation)) return;

    await this.ctx.storage.put(STORAGE_TELEGRAM_USER_ID, telegramUserId);
    if (!this.isCurrentLifecycle(generation)) return;

    const initialFailureCount = await this.readReconnectFailureCount();
    if (!this.isCurrentLifecycle(generation)) return;

    await this.stopRuntime();
    if (!this.isCurrentLifecycle(generation)) return;

    const runtime = new BridgeRuntime({
      telegramUserId,
      chatId: telegramUserId,
      hhhlOrigin: config.hhhlOrigin,
      hhhlToken: config.hhhlToken,
      hhhlBotUserId: me.id,
      state: store,
      chatApi,
      outbound: (message) =>
        forwardHhhlMessageToTelegram({
          message,
          telegramUserId,
          chatId: telegramUserId,
          state: store,
          telegram: new TelegramApi(config.botToken),
          hhhlBotUserId: me.id,
        }),
      scheduleReconnect: (delayMs) => this.ctx.storage.setAlarm(Date.now() + delayMs),
      persistFailureCount: (failureCount) => this.persistReconnectFailureCount(failureCount),
      initialFailureCount,
      reconnectBaseDelayMs: config.reconnectBaseDelayMs,
      reconnectMaxDelayMs: config.reconnectMaxDelayMs,
      initialHistoryLimit: config.initialHistoryLimit,
    });

    this.runtime = runtime;
    await runtime.start();
    if (!this.isCurrentLifecycle(generation) && this.runtime === runtime) {
      await runtime.stop();
      this.runtime = null;
    }
  }

  async stop(_telegramUserId: string): Promise<void> {
    this.beginLifecycleGeneration();
    await this.stopRuntime();
    await this.clearPersistedStartState();
  }

  async alarm(): Promise<void> {
    const telegramUserId = await this.ctx.storage.get<string>(STORAGE_TELEGRAM_USER_ID);
    if (typeof telegramUserId !== 'string' || telegramUserId.trim() === '') {
      return;
    }

    await this.start(telegramUserId);
  }

  private beginLifecycleGeneration(): number {
    this.lifecycleGeneration += 1;
    return this.lifecycleGeneration;
  }

  private isCurrentLifecycle(generation: number): boolean {
    return this.lifecycleGeneration === generation;
  }

  private async stopRuntime(): Promise<void> {
    await this.runtime?.stop();
    this.runtime = null;
  }

  private async clearPersistedStartState(): Promise<void> {
    await (this.ctx.storage as StorageWithOptionalAlarm).deleteAlarm?.();
    await Promise.all([
      this.ctx.storage.delete(STORAGE_TELEGRAM_USER_ID),
      this.ctx.storage.delete(STORAGE_RECONNECT_FAILURE_COUNT),
    ]);
  }

  private async readReconnectFailureCount(): Promise<number> {
    const value = await this.ctx.storage.get<number>(STORAGE_RECONNECT_FAILURE_COUNT);
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
  }

  private async persistReconnectFailureCount(failureCount: number): Promise<void> {
    if (failureCount <= 0) {
      await this.ctx.storage.delete(STORAGE_RECONNECT_FAILURE_COUNT);
      return;
    }

    await this.ctx.storage.put(STORAGE_RECONNECT_FAILURE_COUNT, failureCount);
  }
}

function stoppedStatus(): RealtimeStatusState {
  return {
    version: 1,
    state: 'stopped',
    connectedAt: null,
    lastError: null,
    nextReconnectAt: null,
  };
}
