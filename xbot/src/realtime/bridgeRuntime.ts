import {
  createRoomSubscribeMessage,
  createStreamConnectMessage,
  createStreamingUrl,
  normalizeRealtimeEvent,
} from '../hhhl/realtime';
import type { HhhlChatMessage, PaginationParams } from '../hhhl/types';
import type { KvStateStore } from '../state/kvStore';
import type { BindingState, RealtimeStatusState } from '../state/schemas';

export interface BridgeRuntimeChatApi {
  roomTimeline(roomId: string, params?: PaginationParams): Promise<HhhlChatMessage[]>;
}

export interface BridgeRuntimeWebSocket {
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => unknown): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type BridgeRuntimeWebSocketConstructor = new (url: string) => BridgeRuntimeWebSocket;
export type BridgeRuntimeSetTimeout = (callback: () => void, delayMs: number) => unknown;
export type BridgeRuntimeScheduleReconnect = (delayMs: number) => void | Promise<void>;
export type BridgeRuntimePersistFailureCount = (failureCount: number) => void | Promise<void>;
export type BridgeRuntimeNow = () => Date;
export type BridgeRuntimeOutbound = (message: HhhlChatMessage) => void | Promise<void>;

export interface BridgeRuntimeOptions {
  telegramUserId: string;
  chatId: string;
  hhhlOrigin: string;
  hhhlToken: string;
  hhhlBotUserId: string;
  state: KvStateStore;
  chatApi: BridgeRuntimeChatApi;
  outbound: BridgeRuntimeOutbound;
  WebSocketImpl?: BridgeRuntimeWebSocketConstructor;
  setTimeoutImpl?: BridgeRuntimeSetTimeout;
  scheduleReconnect?: BridgeRuntimeScheduleReconnect;
  persistFailureCount?: BridgeRuntimePersistFailureCount;
  initialFailureCount?: number;
  now?: BridgeRuntimeNow;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  initialHistoryLimit: number;
}

function defaultWebSocketImpl(): BridgeRuntimeWebSocketConstructor {
  const webSocketImpl = globalThis.WebSocket as unknown as BridgeRuntimeWebSocketConstructor | undefined;
  if (webSocketImpl == null) {
    throw new Error('WebSocket is not available');
  }

  return webSocketImpl;
}

function defaultSetTimeoutImpl(callback: () => void, delayMs: number): unknown {
  return globalThis.setTimeout(callback, delayMs);
}

function messageEventData(event: unknown): string | null {
  if (event != null && typeof event === 'object' && 'data' in event) {
    const data = (event as { data?: unknown }).data;
    return typeof data === 'string' ? data : null;
  }

  return typeof event === 'string' ? event : null;
}

function compareMessageCreatedAt(left: HhhlChatMessage, right: HhhlChatMessage): number {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

export class BridgeRuntime {
  private static readonly MAX_FORWARDED_KEYS = 5000;
  private activeBackfill: { generation: number; promise: Promise<void> } | null = null;
  private currentGeneration = 0;
  private failureCount: number;
  private failureHandledGeneration: number | null = null;
  private forwardedMessageKeys = new Set<string>();
  private roomId: string | null = null;
  private socket: BridgeRuntimeWebSocket | null = null;
  private subscribedRooms = new Set<string>();

  constructor(private readonly options: BridgeRuntimeOptions) {
    this.failureCount = normalizeFailureCount(options.initialFailureCount);
  }

  async start(): Promise<void> {
    const generation = this.beginNewGeneration();
    const binding = await this.options.state.getBinding(this.options.telegramUserId);
    if (!this.isCurrent(generation)) return;

    if (binding == null) {
      this.clearSubscription();
      await this.writeStatus(generation, stoppedStatus());
      return;
    }

    this.roomId = binding.roomId;
    this.subscribedRooms = new Set([binding.roomId]);
    await this.writeStatus(generation, {
      version: 1,
      state: 'connecting',
      connectedAt: null,
      lastError: null,
      nextReconnectAt: null,
    });
    if (!this.isCurrent(generation)) return;

    try {
      const socket = new (this.options.WebSocketImpl ?? defaultWebSocketImpl())(
        createStreamingUrl(this.options.hhhlOrigin, this.options.hhhlToken),
      );
      this.socket = socket;
      this.attachSocketHandlers(socket, binding, generation);
    } catch {
      await this.handleSocketFailure('websocket error', generation);
    }
  }

  async stop(): Promise<void> {
    this.currentGeneration += 1;
    this.failureCount = 0;
    this.failureHandledGeneration = null;

    const socket = this.socket;
    this.socket = null;
    this.clearSubscription();
    this.closeSocket(socket);

    await this.options.state.setStatus(this.options.telegramUserId, stoppedStatus());
  }

  private beginNewGeneration(): number {
    this.currentGeneration += 1;
    this.failureHandledGeneration = null;

    const socket = this.socket;
    this.socket = null;
    this.closeSocket(socket);

    return this.currentGeneration;
  }

  private attachSocketHandlers(socket: BridgeRuntimeWebSocket, binding: BindingState, generation: number): void {
    socket.addEventListener('open', () => this.handleSocketOpen(socket, binding, generation).catch(() => undefined));
    socket.addEventListener('message', (event) => this.handleSocketMessage(event, generation).catch(() => undefined));
    socket.addEventListener('error', () => this.handleSocketFailure('websocket error', generation).catch(() => undefined));
    socket.addEventListener('close', () => this.handleSocketFailure('websocket closed', generation).catch(() => undefined));
  }

  private async handleSocketOpen(
    socket: BridgeRuntimeWebSocket,
    binding: BindingState,
    generation: number,
  ): Promise<void> {
    if (!this.isCurrentSocket(socket, generation)) return;

    this.failureCount = 0;
    await this.persistFailureCount();
    await this.writeStatus(generation, {
      version: 1,
      state: 'connected',
      connectedAt: this.currentIsoTime(),
      lastError: null,
      nextReconnectAt: null,
    });
    if (!this.isCurrentSocket(socket, generation)) return;

    try {
      socket.send(JSON.stringify(createStreamConnectMessage()));
      socket.send(JSON.stringify(createRoomSubscribeMessage(binding.roomId)));
      const backfillPromise = this.backfill(binding, generation);
      this.activeBackfill = { generation, promise: backfillPromise };
      try {
        await backfillPromise;
      } finally {
        if (this.activeBackfill?.promise === backfillPromise) {
          this.activeBackfill = null;
        }
      }
    } catch {
      await this.handleSocketFailure('websocket error', generation);
    }
  }

  private async backfill(binding: BindingState, generation: number): Promise<void> {
    const params =
      binding.lastSeenMessageId == null
        ? { limit: this.options.initialHistoryLimit }
        : { sinceId: binding.lastSeenMessageId, limit: this.options.initialHistoryLimit };
    const messages = await this.options.chatApi.roomTimeline(binding.roomId, params);
    if (!this.isCurrent(generation)) return;

    for (const message of [...messages].sort(compareMessageCreatedAt)) {
      if (!this.isCurrent(generation)) return;
      await this.forwardOnce(message);
    }
  }

  private async handleSocketMessage(event: unknown, generation: number): Promise<void> {
    if (!this.isCurrent(generation)) return;

    const data = messageEventData(event);
    if (data == null) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      return;
    }

    const eventValue = normalizeRealtimeEvent(parsed, this.subscribedRooms);
    if (!this.isCurrent(generation) || eventValue?.type !== 'message') return;

    const activeBackfill = this.activeBackfill;
    if (activeBackfill?.generation === generation) {
      try {
        await activeBackfill.promise;
      } catch {
        return;
      }
    }
    if (!this.isCurrent(generation)) return;

    await this.forwardOnce(eventValue.message);
  }

  private async handleSocketFailure(reason: string, generation: number): Promise<void> {
    if (!this.isCurrent(generation) || this.failureHandledGeneration === generation) return;

    this.failureHandledGeneration = generation;
    const delayMs = this.nextReconnectDelayMs();
    await this.persistFailureCount();
    const nextReconnectAt = this.isoTimeAfter(delayMs);

    await this.writeStatus(generation, {
      version: 1,
      state: 'backing_off',
      connectedAt: null,
      lastError: reason,
      nextReconnectAt,
    });
    if (!this.isCurrent(generation)) return;

    await this.scheduleReconnect(delayMs, generation);
  }

  private async scheduleReconnect(delayMs: number, generation: number): Promise<void> {
    if (this.options.scheduleReconnect != null) {
      await this.options.scheduleReconnect(delayMs);
      return;
    }

    const setTimeoutImpl = this.options.setTimeoutImpl ?? defaultSetTimeoutImpl;
    setTimeoutImpl(() => {
      if (this.isCurrent(generation)) {
        void this.start();
      }
    }, delayMs);
  }

  private nextReconnectDelayMs(): number {
    const delayMs = Math.min(
      this.options.reconnectBaseDelayMs * 2 ** this.failureCount,
      this.options.reconnectMaxDelayMs,
    );
    this.failureCount += 1;
    return delayMs;
  }

  private async persistFailureCount(): Promise<void> {
    await this.options.persistFailureCount?.(this.failureCount);
  }

  private async forwardOnce(message: HhhlChatMessage): Promise<void> {
    const key = messageKey(message);
    if (this.forwardedMessageKeys.has(key)) return;

    // Cap growth to prevent unbounded memory use in long-running sessions
    if (this.forwardedMessageKeys.size >= BridgeRuntime.MAX_FORWARDED_KEYS) {
      const firstKey = this.forwardedMessageKeys.values().next().value;
      if (firstKey !== undefined) {
        this.forwardedMessageKeys.delete(firstKey);
      }
    }

    this.forwardedMessageKeys.add(key);
    try {
      await this.options.outbound(message);
    } catch (error) {
      this.forwardedMessageKeys.delete(key);
      throw error;
    }
  }

  private async writeStatus(generation: number, status: RealtimeStatusState): Promise<void> {
    if (!this.isCurrent(generation)) return;

    await this.options.state.setStatus(this.options.telegramUserId, status);
  }

  private isCurrent(generation: number): boolean {
    return this.currentGeneration === generation;
  }

  private isCurrentSocket(socket: BridgeRuntimeWebSocket, generation: number): boolean {
    return this.isCurrent(generation) && this.socket === socket;
  }

  private clearSubscription(): void {
    this.activeBackfill = null;
    this.forwardedMessageKeys = new Set();
    this.roomId = null;
    this.subscribedRooms = new Set();
  }

  private closeSocket(socket: BridgeRuntimeWebSocket | null): void {
    try {
      socket?.close();
    } catch {
      // Closing is best-effort; stale close handlers are guarded by generation checks.
    }
  }

  private currentDate(): Date {
    return this.options.now?.() ?? new Date();
  }

  private currentIsoTime(): string {
    return this.currentDate().toISOString();
  }

  private isoTimeAfter(delayMs: number): string {
    return new Date(this.currentDate().getTime() + delayMs).toISOString();
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

function normalizeFailureCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

function messageKey(message: HhhlChatMessage): string {
  return `${message.roomId}:${message.id}`;
}
