import type { AppConfig, Env } from '../env';
import { HhhlApiClient } from '../hhhl/apiClient';
import { createHhhlChatApi } from '../hhhl/chatApi';
import type { HhhlRoom, HhhlUser } from '../hhhl/types';
import { redactSensitiveText } from '../security/redact';
import { createKeys } from '../state/keys';
import { KvStateStore } from '../state/kvStore';
import type { BindingState, RealtimeStatusState } from '../state/schemas';
import type { BotCommand } from '../telegram/commands';

export type BridgeCommand = Extract<
  BotCommand,
  { type: 'bind' | 'unbind' | 'rename' | 'list' | 'status' }
>;

export interface BridgeUserObject {
  start(telegramUserId: string): Promise<void>;
  stop(telegramUserId: string): Promise<void>;
}

interface CommandContext {
  config: AppConfig;
  env: Env;
  telegramUserId: string;
}

const NO_BINDING_REPLY = '当前没有绑定聊天室。';

function redactionSecrets(config: AppConfig): string[] {
  return [config.botToken, config.botWebhookSecret, config.hhhlToken, config.hhhlOrigin, config.hhhlApiBaseUrl];
}

function logCommandFailure(error: unknown, config: AppConfig): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('command failed', redactSensitiveText(message, redactionSecrets(config)));
}

function commandFailureReply(command: BridgeCommand): string {
  if (command.type === 'bind') return '绑定失败，请稍后再试。';
  if (command.type === 'unbind') return '解绑失败，请稍后再试。';
  if (command.type === 'rename') return '重命名失败，请稍后再试。';
  return '查询失败，请稍后再试。';
}

function createStore(context: CommandContext): KvStateStore {
  return new KvStateStore(context.env.XBOT_STATE, createKeys(context.config.kvKeyPrefix));
}

function bridgeUserObject(env: Env, telegramUserId: string): BridgeUserObject {
  return env.BRIDGE.getByName(`telegram:${telegramUserId}`) as unknown as BridgeUserObject;
}

function normalizeIdentity(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized == null || normalized === '' ? null : normalized;
}

function isCurrentUserMember(currentUser: HhhlUser, members: HhhlUser[]): boolean {
  const currentIdentities = new Set(
    [normalizeIdentity(currentUser.id), normalizeIdentity(currentUser.username)].filter(
      (identity): identity is string => identity != null,
    ),
  );

  return members.some((member) => {
    const memberId = normalizeIdentity(member.id);
    const memberUsername = normalizeIdentity(member.username);
    return (memberId != null && currentIdentities.has(memberId)) || (memberUsername != null && currentIdentities.has(memberUsername));
  });
}

async function validateBindingTarget(context: CommandContext, roomId: string): Promise<
  | { ok: true; room: HhhlRoom }
  | { ok: false; reply: string }
> {
  const api = createHhhlChatApi(
    new HhhlApiClient({
      baseUrl: context.config.hhhlApiBaseUrl,
      token: context.config.hhhlToken,
    }),
  );

  let currentUser: HhhlUser;
  let room: HhhlRoom;
  let members: HhhlUser[];
  try {
    currentUser = await api.me();
    room = await api.showRoom(roomId);
    members = await api.members(roomId);
  } catch {
    return { ok: false, reply: '绑定失败：无法验证 HHHL 账号或聊天室。' };
  }

  if (!isCurrentUserMember(currentUser, members)) {
    return { ok: false, reply: '绑定失败：当前 HHHL 账号不在该聊天室。' };
  }
  if (room.id.trim() === '' && room.name.trim() === '') {
    return { ok: false, reply: '绑定失败：无法验证 HHHL 账号或聊天室。' };
  }

  return { ok: true, room };
}

function effectiveRoomName(displayName: string | null, room: HhhlRoom, roomId: string): string {
  const manualName = displayName?.trim();
  if (manualName != null && manualName !== '') return manualName;

  const roomName = room.name.trim();
  return roomName === '' ? roomId : roomName;
}

function bindingFrom(
  telegramUserId: string,
  roomId: string,
  room: HhhlRoom,
  displayName: string | null,
): BindingState {
  return {
    version: 1,
    telegramUserId,
    roomId,
    roomName: effectiveRoomName(displayName, room, roomId),
    boundAt: new Date().toISOString(),
    lastSeenMessageId: null,
  };
}

async function bind(command: Extract<BridgeCommand, { type: 'bind' }>, context: CommandContext): Promise<string> {
  const store = createStore(context);
  const existing = await store.getBinding(context.telegramUserId);
  if (existing != null) {
    return `已经绑定：${existing.roomName}（房间 ID：${existing.roomId}）。请先 /unbind。`;
  }

  const validation = await validateBindingTarget(context, command.roomId);
  if (!validation.ok) return validation.reply;

  await store.setBinding(bindingFrom(context.telegramUserId, command.roomId, validation.room, command.roomName));
  try {
    await bridgeUserObject(context.env, context.telegramUserId).start(context.telegramUserId);
  } catch (error) {
    await store.clearBinding(context.telegramUserId).catch(() => undefined);
    throw error;
  }

  const binding = await store.getBinding(context.telegramUserId);
  const roomName = binding?.roomName ?? effectiveRoomName(command.roomName, validation.room, command.roomId);
  return `已绑定：${roomName}（房间 ID：${command.roomId}）。`;
}

async function unbind(context: CommandContext): Promise<string> {
  const store = createStore(context);
  const binding = await store.getBinding(context.telegramUserId);
  if (binding == null) return NO_BINDING_REPLY;

  await bridgeUserObject(context.env, context.telegramUserId).stop(context.telegramUserId);
  await store.clearRoomMaps(context.telegramUserId, binding.roomId);
  await store.clearBinding(context.telegramUserId);

  return `已解绑：${binding.roomName}（房间 ID：${binding.roomId}）。`;
}

async function rename(command: Extract<BridgeCommand, { type: 'rename' }>, context: CommandContext): Promise<string> {
  const store = createStore(context);
  const binding = await store.getBinding(context.telegramUserId);
  if (binding == null) return NO_BINDING_REPLY;

  await store.setBinding({ ...binding, roomName: command.roomName });

  return `已重命名：${command.roomName}（房间 ID：${binding.roomId}）。`;
}

function formatLastSeen(binding: BindingState): string {
  return binding.lastSeenMessageId ?? '无';
}

async function list(context: CommandContext): Promise<string> {
  const binding = await createStore(context).getBinding(context.telegramUserId);
  if (binding == null) return NO_BINDING_REPLY;

  return [
    '当前绑定：',
    `显示名：${binding.roomName}`,
    `房间 ID：${binding.roomId}`,
    `lastSeen：${formatLastSeen(binding)}`,
  ].join('\n');
}

function defaultStatus(): RealtimeStatusState {
  return {
    version: 1,
    state: 'stopped',
    connectedAt: null,
    lastError: null,
    nextReconnectAt: null,
  };
}

function formatNullableStatusValue(value: string | null): string {
  return value ?? '无';
}

async function status(context: CommandContext): Promise<string> {
  const realtimeStatus = (await createStore(context).getStatus(context.telegramUserId)) ?? defaultStatus();

  return [
    '实时状态：',
    `state：${realtimeStatus.state}`,
    `connectedAt：${formatNullableStatusValue(realtimeStatus.connectedAt)}`,
    `lastError：${formatNullableStatusValue(realtimeStatus.lastError)}`,
    `nextReconnectAt：${formatNullableStatusValue(realtimeStatus.nextReconnectAt)}`,
  ].join('\n');
}

async function execute(command: BridgeCommand, context: CommandContext): Promise<string> {
  switch (command.type) {
    case 'bind':
      return bind(command, context);
    case 'unbind':
      return unbind(context);
    case 'rename':
      return rename(command, context);
    case 'list':
      return list(context);
    case 'status':
      return status(context);
  }
}

export async function executeBridgeCommand(command: BridgeCommand, context: CommandContext): Promise<string> {
  try {
    return await execute(command, context);
  } catch (error) {
    logCommandFailure(error, context.config);
    return commandFailureReply(command);
  }
}
