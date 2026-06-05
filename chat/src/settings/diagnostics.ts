import { DC_HHHL_ORIGIN } from '@/shared/config';
import { redactSensitiveText } from '@/shared/errors';

const NOT_SET = 'not-set';
const NONE = 'none';
const MIN_REDACTABLE_IDENTIFIER_LENGTH = 5;

export type DiagnosticsRouteType = 'root' | 'rooms' | 'room' | 'settings' | 'auth-callback' | 'other';

export interface DiagnosticsEnvironmentInput {
  appVersion?: string;
  mode?: string;
  isDev?: boolean;
  instanceUrl?: string;
  telegramPresent?: boolean;
  telegramPlatform?: string;
}

export interface DiagnosticsAuthInput {
  status?: string;
  hasUser?: boolean;
  userId?: string | null;
  username?: string | null;
  error?: string | null;
}

export interface DiagnosticsRouteInput {
  name?: string | null;
  path?: string;
}

export interface DiagnosticsRealtimeInput {
  status?: string;
  roomId?: string | null;
}

export interface DiagnosticsStorageInput {
  status?: string;
}

export interface DiagnosticsRoomsInput {
  loading?: boolean;
  roomCount?: number;
  invitationCount?: number;
  activeRoomId?: string | null;
  activeRoomName?: string | null;
  pendingStartRoomId?: string | null;
  memberCount?: number | null;
  outboxInvitationCount?: number | null;
  error?: string | null;
}

export interface DiagnosticsChatInput {
  loading?: boolean;
  roomId?: string | null;
  timelineCount?: number;
  outgoingCount?: number;
  failedOutgoingCount?: number;
  searchResultCount?: number;
  keySearchResultCount?: number;
  replyTargetPresent?: boolean;
  quoteTargetPresent?: boolean;
  error?: string | null;
  searchError?: string | null;
  keySearchError?: string | null;
}

export interface DiagnosticsErrorsInput {
  auth?: string | null;
  rooms?: string | null;
  chat?: string | null;
  search?: string | null;
  keySearch?: string | null;
  raw?: string | null;
}

export interface DiagnosticsInput {
  environment?: DiagnosticsEnvironmentInput;
  auth?: DiagnosticsAuthInput;
  route?: DiagnosticsRouteInput;
  realtime?: DiagnosticsRealtimeInput;
  storage?: DiagnosticsStorageInput;
  rooms?: DiagnosticsRoomsInput;
  chat?: DiagnosticsChatInput;
  errors?: DiagnosticsErrorsInput;
  raw?: string;
  instanceUrl?: string;
  realtimeStatus?: string;
  storageStatus?: string;
}

export interface DiagnosticsEnvironmentSnapshot {
  appVersion: string;
  mode: string;
  isDev: boolean;
  instanceUrl: string;
  telegramPresent: boolean;
  telegramPlatform: string;
}

export interface DiagnosticsAuthSnapshot {
  status: string;
  hasUser: boolean;
  userId: string | null;
  username: string | null;
}

export interface DiagnosticsRouteSnapshot {
  name: string;
  path: string;
  type: DiagnosticsRouteType;
  isRoomRoute: boolean;
}

export interface DiagnosticsRealtimeSnapshot {
  status: string;
  roomId: string | null;
}

export interface DiagnosticsStorageSnapshot {
  status: string;
}

export interface DiagnosticsRoomsSnapshot {
  loading: boolean;
  roomCount: number;
  invitationCount: number;
  activeRoomId: string | null;
  activeRoomName: string | null;
  pendingStartRoomId: string | null;
  memberCount: number | null;
  outboxInvitationCount: number | null;
}

export interface DiagnosticsChatSnapshot {
  loading: boolean;
  roomId: string | null;
  timelineCount: number;
  outgoingCount: number;
  failedOutgoingCount: number;
  searchResultCount: number;
  keySearchResultCount: number;
  replyTargetPresent: boolean;
  quoteTargetPresent: boolean;
}

export interface DiagnosticsErrorsSnapshot {
  auth: string | null;
  rooms: string | null;
  chat: string | null;
  search: string | null;
  keySearch: string | null;
  raw: string | null;
}

export interface DiagnosticsSnapshot {
  environment: DiagnosticsEnvironmentSnapshot;
  auth: DiagnosticsAuthSnapshot;
  route: DiagnosticsRouteSnapshot;
  realtime: DiagnosticsRealtimeSnapshot;
  storage: DiagnosticsStorageSnapshot;
  rooms: DiagnosticsRoomsSnapshot;
  chat: DiagnosticsChatSnapshot;
  errors: DiagnosticsErrorsSnapshot;
}

export interface DiagnosticsOutput {
  snapshot: DiagnosticsSnapshot;
  safe: string;
  detailed: string;
}

export function routeTypeFromPath(path: string): DiagnosticsRouteType {
  const normalizedPath = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';

  if (normalizedPath === '/') {
    return 'root';
  }

  if (normalizedPath === '/rooms') {
    return 'rooms';
  }

  if (normalizedPath.startsWith('/rooms/')) {
    return 'room';
  }

  if (normalizedPath === '/settings') {
    return 'settings';
  }

  if (normalizedPath === '/auth/callback') {
    return 'auth-callback';
  }

  return 'other';
}

export function createDiagnosticsSnapshot(input: DiagnosticsInput = {}): DiagnosticsSnapshot {
  const environment = input.environment ?? {};
  const auth = input.auth ?? {};
  const route = input.route ?? {};
  const realtime = input.realtime ?? {};
  const storage = input.storage ?? {};
  const rooms = input.rooms ?? {};
  const chat = input.chat ?? {};
  const errors = input.errors ?? {};
  const routePath = requiredText(route.path);

  return {
    environment: {
      appVersion: requiredText(environment.appVersion),
      mode: requiredText(environment.mode),
      isDev: environment.isDev ?? false,
      instanceUrl: requiredText(environment.instanceUrl ?? input.instanceUrl, DC_HHHL_ORIGIN),
      telegramPresent: environment.telegramPresent ?? false,
      telegramPlatform: requiredText(environment.telegramPlatform, NONE),
    },
    auth: {
      status: requiredText(auth.status),
      hasUser: auth.hasUser ?? (auth.userId != null || auth.username != null),
      userId: optionalText(auth.userId),
      username: optionalText(auth.username),
    },
    route: {
      name: requiredText(route.name),
      path: routePath,
      type: routeTypeFromPath(routePath),
      isRoomRoute: routeTypeFromPath(routePath) === 'room',
    },
    realtime: {
      status: requiredText(realtime.status ?? input.realtimeStatus),
      roomId: optionalText(realtime.roomId),
    },
    storage: {
      status: requiredText(storage.status ?? input.storageStatus),
    },
    rooms: {
      loading: rooms.loading ?? false,
      roomCount: rooms.roomCount ?? 0,
      invitationCount: rooms.invitationCount ?? 0,
      activeRoomId: optionalText(rooms.activeRoomId),
      activeRoomName: optionalText(rooms.activeRoomName),
      pendingStartRoomId: optionalText(rooms.pendingStartRoomId),
      memberCount: rooms.memberCount ?? null,
      outboxInvitationCount: rooms.outboxInvitationCount ?? null,
    },
    chat: {
      loading: chat.loading ?? false,
      roomId: optionalText(chat.roomId),
      timelineCount: chat.timelineCount ?? 0,
      outgoingCount: chat.outgoingCount ?? 0,
      failedOutgoingCount: chat.failedOutgoingCount ?? 0,
      searchResultCount: chat.searchResultCount ?? 0,
      keySearchResultCount: chat.keySearchResultCount ?? 0,
      replyTargetPresent: chat.replyTargetPresent ?? false,
      quoteTargetPresent: chat.quoteTargetPresent ?? false,
    },
    errors: {
      auth: optionalText(errors.auth ?? auth.error),
      rooms: optionalText(errors.rooms ?? rooms.error),
      chat: optionalText(errors.chat ?? chat.error),
      search: optionalText(errors.search ?? chat.searchError),
      keySearch: optionalText(errors.keySearch ?? chat.keySearchError),
      raw: optionalText(errors.raw ?? input.raw),
    },
  };
}

export function renderSafeDiagnostics(snapshot: DiagnosticsSnapshot): string {
  return redactKnownIdentifiers(redactSensitiveText([
    '[environment]',
    `appVersion=${snapshot.environment.appVersion}`,
    `mode=${snapshot.environment.mode}`,
    `dev=${snapshot.environment.isDev}`,
    `instance=${snapshot.environment.instanceUrl}`,
    `telegramPresent=${snapshot.environment.telegramPresent}`,
    `telegramPlatform=${snapshot.environment.telegramPlatform}`,
    '',
    '[auth]',
    `authStatus=${snapshot.auth.status}`,
    `hasUser=${snapshot.auth.hasUser}`,
    '',
    '[route]',
    `routeName=${snapshot.route.name}`,
    `routeType=${snapshot.route.type}`,
    `isRoomRoute=${snapshot.route.isRoomRoute}`,
    '',
    '[realtime]',
    `realtimeStatus=${snapshot.realtime.status}`,
    '',
    '[storage]',
    `storageStatus=${snapshot.storage.status}`,
    '',
    '[rooms]',
    `roomLoading=${snapshot.rooms.loading}`,
    `roomCount=${snapshot.rooms.roomCount}`,
    `invitationCount=${snapshot.rooms.invitationCount}`,
    '',
    '[chat]',
    `chatLoading=${snapshot.chat.loading}`,
    `timelineCount=${snapshot.chat.timelineCount}`,
    `outgoingCount=${snapshot.chat.outgoingCount}`,
    `searchResultCount=${snapshot.chat.searchResultCount}`,
    `keySearchResultCount=${snapshot.chat.keySearchResultCount}`,
    '',
    '[errors]',
    `authError=${diagnosticValue(snapshot.errors.auth)}`,
    `roomsError=${diagnosticValue(snapshot.errors.rooms)}`,
    `chatError=${diagnosticValue(snapshot.errors.chat)}`,
    `searchError=${diagnosticValue(snapshot.errors.search)}`,
    `keySearchError=${diagnosticValue(snapshot.errors.keySearch)}`,
    `raw=${diagnosticValue(snapshot.errors.raw)}`,
  ].join('\n')), snapshot);
}

export function renderDetailedDiagnostics(snapshot: DiagnosticsSnapshot): string {
  const details = redactSensitiveText([
    '[details]',
    `userId=${diagnosticValue(snapshot.auth.userId)}`,
    `username=${diagnosticValue(snapshot.auth.username)}`,
    `realtimeRoomId=${diagnosticValue(snapshot.realtime.roomId)}`,
    `activeRoomId=${diagnosticValue(snapshot.rooms.activeRoomId)}`,
    `activeRoomName=${diagnosticValue(snapshot.rooms.activeRoomName)}`,
    `pendingStartRoomId=${diagnosticValue(snapshot.rooms.pendingStartRoomId)}`,
    `chatRoomId=${diagnosticValue(snapshot.chat.roomId)}`,
    `memberCount=${diagnosticValue(snapshot.rooms.memberCount)}`,
    `outboxInvitationCount=${diagnosticValue(snapshot.rooms.outboxInvitationCount)}`,
    `replyTargetPresent=${snapshot.chat.replyTargetPresent}`,
    `quoteTargetPresent=${snapshot.chat.quoteTargetPresent}`,
    `failedOutgoingCount=${snapshot.chat.failedOutgoingCount}`,
  ].join('\n'));

  return `${renderSafeDiagnostics(snapshot)}\n\n${details}`;
}

export function createDiagnosticsOutput(input: DiagnosticsInput = {}): DiagnosticsOutput {
  const snapshot = createDiagnosticsSnapshot(input);

  return {
    snapshot,
    safe: renderSafeDiagnostics(snapshot),
    detailed: renderDetailedDiagnostics(snapshot),
  };
}

function requiredText(value: string | null | undefined, fallback = NOT_SET): string {
  const normalized = optionalText(value);
  return normalized ?? fallback;
}

function optionalText(value: string | null | undefined): string | null {
  return value != null && value.trim() !== '' ? value : null;
}

function diagnosticValue(value: string | number | null): string {
  return value == null ? NONE : String(value);
}

function redactKnownIdentifiers(value: string, snapshot: DiagnosticsSnapshot): string {
  return knownIdentifiers(snapshot).reduce(
    (output, identifier) => output.replace(new RegExp(escapeRegExp(identifier), 'g'), '[redacted]'),
    value,
  );
}

function knownIdentifiers(snapshot: DiagnosticsSnapshot): string[] {
  return [
    snapshot.auth.userId,
    snapshot.auth.username,
    snapshot.realtime.roomId,
    snapshot.rooms.activeRoomId,
    snapshot.rooms.activeRoomName,
    snapshot.rooms.pendingStartRoomId,
    snapshot.chat.roomId,
  ]
    .filter(
      (identifier): identifier is string =>
        identifier != null && identifier.trim().length >= MIN_REDACTABLE_IDENTIFIER_LENGTH,
    )
    .sort((left, right) => right.length - left.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
