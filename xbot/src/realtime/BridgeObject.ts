import type { BridgeUserObject } from '../bridge/commands';
import { forwardHhhlMessageToTelegram } from '../bridge/outbound';
import { readConfig } from '../config';
import type { Env } from '../env';
import { HhhlApiClient } from '../hhhl/apiClient';
import { createHhhlChatApi } from '../hhhl/chatApi';
import { createKeys } from '../state/keys';
import { KvStateStore } from '../state/kvStore';
import { TelegramApi } from '../telegram/api';
import { BridgeRuntime } from './bridgeRuntime';

const STORAGE_TELEGRAM_USER_ID = 'telegramUserId';

type StorageWithOptionalAlarm = DurableObjectStorage & {
  deleteAlarm?: () => Promise<void>;
};

export class BridgeObject implements BridgeUserObject {
  private runtime: BridgeRuntime | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async start(telegramUserId: string): Promise<void> {
    await this.state.storage.put(STORAGE_TELEGRAM_USER_ID, telegramUserId);

    const configResult = readConfig(this.env);
    if (!configResult.ok) {
      throw new Error(`invalid xbot config: ${configResult.error}`);
    }
    const config = configResult.value;
    const store = new KvStateStore(this.env.XBOT_STATE, createKeys(config.kvKeyPrefix));
    const binding = await store.getBinding(telegramUserId);
    if (binding == null) {
      await this.runtime?.stop();
      this.runtime = null;
      return;
    }

    const hhhlClient = new HhhlApiClient({
      baseUrl: config.hhhlApiBaseUrl,
      token: config.hhhlToken,
    });
    const chatApi = createHhhlChatApi(hhhlClient);
    const me = await chatApi.me();

    await this.runtime?.stop();
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
      scheduleReconnect: (delayMs) => this.state.storage.setAlarm(Date.now() + delayMs),
      reconnectBaseDelayMs: config.reconnectBaseDelayMs,
      reconnectMaxDelayMs: config.reconnectMaxDelayMs,
      initialHistoryLimit: config.initialHistoryLimit,
    });

    this.runtime = runtime;
    await runtime.start();
  }

  async stop(_telegramUserId: string): Promise<void> {
    await this.runtime?.stop();
    this.runtime = null;
    await (this.state.storage as StorageWithOptionalAlarm).deleteAlarm?.();
    await this.state.storage.delete(STORAGE_TELEGRAM_USER_ID);
  }

  async alarm(): Promise<void> {
    const telegramUserId = await this.state.storage.get<string>(STORAGE_TELEGRAM_USER_ID);
    if (typeof telegramUserId !== 'string' || telegramUserId.trim() === '') {
      return;
    }

    await this.start(telegramUserId);
  }
}
