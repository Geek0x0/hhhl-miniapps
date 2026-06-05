import { DC_HHHL_ORIGIN } from '@/shared/config';
import { redactSensitiveText } from '@/shared/errors';

const NOT_SET = 'not-set';
const NONE = 'none';
const REDACTED = '[redacted]';
const MIN_PARTIAL_IDENTIFIER_REDACTION_LENGTH = 4;

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
  const userId = optionalText(auth.userId);
  const username = optionalText(auth.username);

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
      hasUser: auth.hasUser ?? (userId != null || username != null),
      userId,
      username,
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
  const lines = [
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
    `authError=${freeFormDiagnosticValue(snapshot.errors.auth, snapshot)}`,
    `roomsError=${freeFormDiagnosticValue(snapshot.errors.rooms, snapshot)}`,
    `chatError=${freeFormDiagnosticValue(snapshot.errors.chat, snapshot)}`,
    `searchError=${freeFormDiagnosticValue(snapshot.errors.search, snapshot)}`,
    `keySearchError=${freeFormDiagnosticValue(snapshot.errors.keySearch, snapshot)}`,
  ];

  if (snapshot.errors.raw != null) {
    lines.push('', '[raw]', freeFormDiagnosticValue(snapshot.errors.raw, snapshot));
  }

  return redactSensitiveText(lines.join('\n'));
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

function freeFormDiagnosticValue(value: string | null, snapshot: DiagnosticsSnapshot): string {
  if (value == null) {
    return NONE;
  }

  return sanitizeFreeformValue(value, snapshot);
}

function sanitizeFreeformValue(value: string, snapshot: DiagnosticsSnapshot): string {
  const tokenRedacted = redactSensitiveText(value);

  if (looksLikeTelegramInitData(tokenRedacted)) {
    return REDACTED;
  }

  if (looksLikeFileUrlOrMessageIdList(tokenRedacted)) {
    return REDACTED;
  }

  return redactKnownIdentifiersInFreeform(tokenRedacted, snapshot);
}

function looksLikeTelegramInitData(value: string): boolean {
  return /(?:^|[?&#])(?:query_id|auth_date|hash|signature|user)=/i.test(value);
}

function looksLikeFileUrlOrMessageIdList(value: string): boolean {
  return (
    /(?:\/|%2f)(?:drive(?:\/|%2f))?files(?:\/|%2f)/i.test(value) ||
    /(?:\/|%2f)media(?:\/|%2f)/i.test(value) ||
    /(?:thumbnailUrl|downloadUrl|fileUrl|mediaUrl)=/i.test(value) ||
    /messageIds=/i.test(value) ||
    /messageId(?:\[\]|%5b%5d)=/i.test(value) ||
    /["']messageIds["']/i.test(value) ||
    /["']messageId["']/i.test(value)
  );
}

function redactKnownIdentifiersInFreeform(value: string, snapshot: DiagnosticsSnapshot): string {
  const identifiers = knownIdentifiers(snapshot);

  if (
    identifiers.some((identifier) =>
      knownIdentifierRedactionTerms(identifier).some(
        (term) =>
          identifier.length < MIN_PARTIAL_IDENTIFIER_REDACTION_LENGTH &&
          knownIdentifierTermRegExp(term).test(value),
      ),
    )
  ) {
    return REDACTED;
  }

  return identifiers
    .filter((identifier) => identifier.length >= MIN_PARTIAL_IDENTIFIER_REDACTION_LENGTH)
    .reduce((output, identifier) => {
      return knownIdentifierRedactionTerms(identifier).reduce((termOutput, term) => {
        return termOutput.replace(knownIdentifierTermRegExp(term), REDACTED);
      }, output);
    }, value);
}

interface KnownIdentifierRedactionTerm {
  value: string;
  caseInsensitive: boolean;
}

function knownIdentifierRedactionTerms(identifier: string): KnownIdentifierRedactionTerm[] {
  const terms: KnownIdentifierRedactionTerm[] = [{ value: identifier, caseInsensitive: false }];

  try {
    const encoded = encodeURIComponent(identifier);
    const formEncoded = encoded.replace(/%20/g, '+');

    if (encoded !== identifier) {
      terms.push({ value: encoded, caseInsensitive: true });
    }

    if (formEncoded !== encoded && formEncoded !== identifier) {
      terms.push({ value: formEncoded, caseInsensitive: true });
    }
  } catch {
    // A malformed surrogate should not prevent plain identifier redaction.
  }

  return uniqueRedactionTerms(terms);
}

function uniqueRedactionTerms(terms: KnownIdentifierRedactionTerm[]): KnownIdentifierRedactionTerm[] {
  const seen = new Set<string>();

  return terms.filter((term) => {
    const key = `${term.caseInsensitive}:${term.value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return term.value.length > 0;
  });
}

function knownIdentifierTermRegExp(term: KnownIdentifierRedactionTerm): RegExp {
  return new RegExp(escapeRegExp(term.value), term.caseInsensitive ? 'gi' : 'g');
}

function knownIdentifiers(snapshot: DiagnosticsSnapshot): string[] {
  const identifiers = [
    snapshot.auth.userId,
    snapshot.auth.username,
    roomIdFromRoutePath(snapshot.route.path),
    snapshot.realtime.roomId,
    snapshot.rooms.activeRoomId,
    snapshot.rooms.activeRoomName,
    snapshot.rooms.pendingStartRoomId,
    snapshot.chat.roomId,
  ]
    .map((identifier) => identifier?.trim())
    .filter((identifier): identifier is string => identifier != null && identifier.length > 0);

  return [...new Set(identifiers)].sort((left, right) => right.length - left.length);
}

function roomIdFromRoutePath(path: string): string | null {
  const normalizedPath = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  const match = /^\/rooms\/([^/]+)(?:\/|$)/.exec(normalizedPath);
  const roomId = match?.[1]?.trim();

  if (roomId == null || roomId === '') {
    return null;
  }

  try {
    return decodeURIComponent(roomId);
  } catch {
    return roomId;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
