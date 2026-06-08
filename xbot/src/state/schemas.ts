export interface BindingState {
  version: 1;
  telegramUserId: string;
  roomId: string;
  roomName: string;
  boundAt: string;
  lastSeenMessageId: string | null;
}

export interface MessageMapState {
  version: 1;
  roomId: string;
  hhhlMessageId: string;
  telegramUserId: string;
  telegramMessageId: number;
  createdAt: string;
}

export interface RealtimeStatusState {
  version: 1;
  state: 'stopped' | 'connecting' | 'connected' | 'backing_off';
  connectedAt: string | null;
  lastError: string | null;
  nextReconnectAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function nullableStringField(value: unknown): string | null | undefined {
  if (value === null) return null;
  return stringField(value) ?? undefined;
}

function telegramMessageIdField(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function realtimeStateField(value: unknown): RealtimeStatusState['state'] | null {
  if (value === 'stopped' || value === 'connecting' || value === 'connected' || value === 'backing_off') {
    return value;
  }

  return null;
}

export function parseBindingState(value: unknown): BindingState | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const telegramUserId = stringField(value.telegramUserId);
  const roomId = stringField(value.roomId);
  const roomName = stringField(value.roomName);
  const boundAt = stringField(value.boundAt);
  const lastSeenMessageId = nullableStringField(value.lastSeenMessageId);

  if (
    telegramUserId == null ||
    roomId == null ||
    roomName == null ||
    boundAt == null ||
    lastSeenMessageId === undefined
  ) {
    return null;
  }

  return { version: 1, telegramUserId, roomId, roomName, boundAt, lastSeenMessageId };
}

export function parseMessageMapState(value: unknown): MessageMapState | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const roomId = stringField(value.roomId);
  const hhhlMessageId = stringField(value.hhhlMessageId);
  const telegramUserId = stringField(value.telegramUserId);
  const telegramMessageId = telegramMessageIdField(value.telegramMessageId);
  const createdAt = stringField(value.createdAt);

  if (
    roomId == null ||
    hhhlMessageId == null ||
    telegramUserId == null ||
    telegramMessageId == null ||
    createdAt == null
  ) {
    return null;
  }

  return { version: 1, roomId, hhhlMessageId, telegramUserId, telegramMessageId, createdAt };
}

export function parseRealtimeStatusState(value: unknown): RealtimeStatusState | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const state = realtimeStateField(value.state);
  const connectedAt = nullableStringField(value.connectedAt);
  const lastError = nullableStringField(value.lastError);
  const nextReconnectAt = nullableStringField(value.nextReconnectAt);

  if (state == null || connectedAt === undefined || lastError === undefined || nextReconnectAt === undefined) {
    return null;
  }

  return { version: 1, state, connectedAt, lastError, nextReconnectAt };
}
