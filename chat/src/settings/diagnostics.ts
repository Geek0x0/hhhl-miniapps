import { DC_HHHL_ORIGIN } from '@/shared/config';
import { redactSensitiveText } from '@/shared/errors';

const NOT_SET = 'not-set';
const NONE = 'none';
const REDACTED = '[redacted]';
const MIN_PARTIAL_IDENTIFIER_REDACTION_LENGTH = 4;
const MAX_PERCENT_DECODE_ROUNDS = 3;
const SENSITIVE_URL_FIELD_PATTERN =
  /(?:^|[^\w])["']?(?:thumbnailUrl|downloadUrl|fileUrl|mediaUrl|previewUrl|webUrl|webpublicUrl|url|src|thumbnail)["']?\s*[:=]/i;
const TOKEN_FIELD_MARKER_PATTERN =
  /(?:^|[^\w])["']?(?:(?:access|refresh|id)_token|(?:auth|bot)Token|token|i)["']?\s*[:=]\s*["']?(?!\[redacted\]["']?(?:[\s,}&\]]|$))[^\s"',}&\]]+/i;
const BEARER_TOKEN_MARKER_PATTERN =
  /\b(?:Authorization\s*:\s*)?Bearer\s+(?!\[redacted\](?:[\s,}&\]]|$))[A-Za-z0-9._~+/=-]{6,}/i;
const MESSAGE_ID_FIELD_MARKER_PATTERN =
  /(?:^|[^\w])["']?(?:messageIds?|message_id|chatMessageId|sinceId|untilId|lastSeenId|replyId|replyToId|replyMessageId|quoteId|quoteMessageId|localId|serverId)["']?(?:\[\]|%5b%5d)?\s*[:=]/i;
const MESSAGE_TEXT_FIELD_MARKER_PATTERN =
  /(?:^|[^\w])["']?(?:text|body|content|message)["']?\s*[:=]/i;
const MESSAGE_SHAPE_FIELD_MARKER_PATTERN =
  /(?:^|[^\w])["']?(?:roomId|toRoomId|createdAt|created_at|created|user|file|reply|quote|reactions)["']?\s*[:=]/i;
const CANONICAL_ID_FIELD_MARKER_PATTERN =
  /(?:^|[^\w])["']?id["']?\s*[:=]/i;

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
  olderLoading?: boolean;
  newerLoading?: boolean;
  hasMoreOlder?: boolean;
  timelineCount?: number;
  serverTimelineCount?: number;
  pendingTimelineCount?: number;
  lastServerMessageAt?: string | null;
  lastTimelineEntryKind?: string | null;
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

export interface DiagnosticsRedactionIdentifierInput {
  value?: string | null;
  caseInsensitive?: boolean;
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
  redactionIdentifiers?: DiagnosticsRedactionIdentifierInput[];
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
  olderLoading: boolean;
  newerLoading: boolean;
  hasMoreOlder: boolean;
  timelineCount: number;
  serverTimelineCount: number;
  pendingTimelineCount: number;
  lastServerMessageAt: string | null;
  lastTimelineEntryKind: string | null;
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

export interface DiagnosticsRedactionIdentifierSnapshot {
  value: string;
  caseInsensitive: boolean;
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
  redactionIdentifiers: DiagnosticsRedactionIdentifierSnapshot[];
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
      olderLoading: chat.olderLoading ?? false,
      newerLoading: chat.newerLoading ?? false,
      hasMoreOlder: chat.hasMoreOlder ?? false,
      timelineCount: chat.timelineCount ?? 0,
      serverTimelineCount: chat.serverTimelineCount ?? 0,
      pendingTimelineCount: chat.pendingTimelineCount ?? 0,
      lastServerMessageAt: optionalText(chat.lastServerMessageAt),
      lastTimelineEntryKind: optionalText(chat.lastTimelineEntryKind),
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
    redactionIdentifiers: normalizeRedactionIdentifiers(input.redactionIdentifiers ?? []),
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
    `chatOlderLoading=${snapshot.chat.olderLoading}`,
    `chatNewerLoading=${snapshot.chat.newerLoading}`,
    `chatHasMoreOlder=${snapshot.chat.hasMoreOlder}`,
    `timelineCount=${snapshot.chat.timelineCount}`,
    `serverTimelineCount=${snapshot.chat.serverTimelineCount}`,
    `pendingTimelineCount=${snapshot.chat.pendingTimelineCount}`,
    `lastServerMessageAt=${diagnosticValue(snapshot.chat.lastServerMessageAt)}`,
    `lastTimelineEntryKind=${diagnosticValue(snapshot.chat.lastTimelineEntryKind)}`,
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
    `userId=${detailDiagnosticValue(snapshot.auth.userId)}`,
    `username=${detailDiagnosticValue(snapshot.auth.username)}`,
    `realtimeRoomId=${detailDiagnosticValue(snapshot.realtime.roomId)}`,
    `activeRoomId=${detailDiagnosticValue(snapshot.rooms.activeRoomId)}`,
    `activeRoomName=${detailDiagnosticValue(snapshot.rooms.activeRoomName)}`,
    `pendingStartRoomId=${detailDiagnosticValue(snapshot.rooms.pendingStartRoomId)}`,
    `chatRoomId=${detailDiagnosticValue(snapshot.chat.roomId)}`,
    `memberCount=${detailDiagnosticValue(snapshot.rooms.memberCount)}`,
    `outboxInvitationCount=${detailDiagnosticValue(snapshot.rooms.outboxInvitationCount)}`,
    `chatOlderLoading=${snapshot.chat.olderLoading}`,
    `chatNewerLoading=${snapshot.chat.newerLoading}`,
    `chatHasMoreOlder=${snapshot.chat.hasMoreOlder}`,
    `serverTimelineCount=${snapshot.chat.serverTimelineCount}`,
    `pendingTimelineCount=${snapshot.chat.pendingTimelineCount}`,
    `lastServerMessageAt=${detailDiagnosticValue(snapshot.chat.lastServerMessageAt)}`,
    `lastTimelineEntryKind=${detailDiagnosticValue(snapshot.chat.lastTimelineEntryKind)}`,
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

function detailDiagnosticValue(value: string | number | null): string {
  const rendered = diagnosticValue(value);

  if (rendered === NONE) {
    return rendered;
  }

  if (containsForbiddenDiagnosticMarker(rendered)) {
    return REDACTED;
  }

  return redactSensitiveText(rendered);
}

function freeFormDiagnosticValue(value: string | null, snapshot: DiagnosticsSnapshot): string {
  if (value == null) {
    return NONE;
  }

  return sanitizeFreeformValue(value, snapshot);
}

function sanitizeFreeformValue(value: string, snapshot: DiagnosticsSnapshot): string {
  if (containsForbiddenDiagnosticMarker(value)) {
    return REDACTED;
  }

  const tokenRedacted = redactSensitiveText(value);

  if (containsForbiddenDiagnosticMarker(tokenRedacted)) {
    return REDACTED;
  }

  const identifierRedacted = redactKnownIdentifiersInFreeform(tokenRedacted, snapshot);

  if (decodedPercentValueContainsKnownIdentifier(identifierRedacted, snapshot)) {
    return REDACTED;
  }

  return identifierRedacted;
}

function containsForbiddenDiagnosticMarker(value: string): boolean {
  return (
    looksLikeTelegramInitData(value) ||
    looksLikeTokenLikeFreeform(value) ||
    looksLikeMessageTextOrId(value) ||
    looksLikeFileUrlOrMessageIdList(value)
  );
}

function looksLikeTelegramInitData(value: string): boolean {
  return markerDetectionValues(value).some(
    (candidate) =>
      /(?:^|[?&#])(?:query_id|auth_date|hash|signature|user)=/i.test(candidate) ||
      /(?:^|[^\w])["']?initData(?:Unsafe)?["']?\s*[:=]/i.test(candidate),
  );
}

function looksLikeTokenLikeFreeform(value: string): boolean {
  return markerDetectionValues(value).some(
    (candidate) =>
      TOKEN_FIELD_MARKER_PATTERN.test(candidate) ||
      BEARER_TOKEN_MARKER_PATTERN.test(candidate),
  );
}

function looksLikeFileUrlOrMessageIdList(value: string): boolean {
  return markerDetectionValues(value).some(
    (candidate) =>
      /(?:\/|%2f)(?:drive(?:\/|%2f))?files(?:\/|%2f)/i.test(candidate) ||
      /(?:\/|%2f)media(?:\/|%2f)/i.test(candidate) ||
      SENSITIVE_URL_FIELD_PATTERN.test(candidate) ||
      MESSAGE_ID_FIELD_MARKER_PATTERN.test(candidate),
  );
}

function looksLikeMessageTextOrId(value: string): boolean {
  return markerDetectionValues(value).some(
    (candidate) =>
      MESSAGE_TEXT_FIELD_MARKER_PATTERN.test(candidate) ||
      (
        CANONICAL_ID_FIELD_MARKER_PATTERN.test(candidate) &&
        MESSAGE_SHAPE_FIELD_MARKER_PATTERN.test(candidate)
      ),
  );
}

function markerDetectionValues(value: string): string[] {
  const values = [value];
  let decoded = value;

  for (let round = 0; round < MAX_PERCENT_DECODE_ROUNDS; round += 1) {
    const nextDecoded = decodeValidPercentEscapes(decoded);

    if (nextDecoded === decoded) {
      break;
    }

    values.push(nextDecoded);
    decoded = nextDecoded;
  }

  return uniqueStringValues(values);
}

function decodeValidPercentEscapes(value: string): string {
  return value.replace(/(?:%[0-9A-Fa-f]{2})+/g, (encodedRun) => {
    try {
      return decodeURIComponent(encodedRun);
    } catch {
      return encodedRun.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
    }
  });
}

function redactKnownIdentifiersInFreeform(value: string, snapshot: DiagnosticsSnapshot): string {
  const identifiers = knownIdentifiers(snapshot);

  if (
    identifiers.some((identifier) =>
      knownIdentifierRedactionTerms(identifier).some(
        (term) =>
          identifier.value.length < MIN_PARTIAL_IDENTIFIER_REDACTION_LENGTH &&
          knownIdentifierTermRegExp(term).test(value),
      ),
    )
  ) {
    return REDACTED;
  }

  return identifiers
    .filter((identifier) => identifier.value.length >= MIN_PARTIAL_IDENTIFIER_REDACTION_LENGTH)
    .reduce((output, identifier) => {
      return knownIdentifierRedactionTerms(identifier).reduce((termOutput, term) => {
        return termOutput.replace(knownIdentifierTermRegExp(term), REDACTED);
      }, output);
    }, value);
}

function decodedPercentValueContainsKnownIdentifier(value: string, snapshot: DiagnosticsSnapshot): boolean {
  const identifiers = knownIdentifiers(snapshot);
  let decoded = value;

  for (let round = 0; round < MAX_PERCENT_DECODE_ROUNDS; round += 1) {
    const nextDecoded = decodeValidPercentEscapes(decoded);

    if (nextDecoded === decoded) {
      return false;
    }

    decoded = nextDecoded;

    if (
      identifiers.some((identifier) =>
        knownIdentifierTermRegExp({
          value: identifier.value,
          caseInsensitive: identifier.caseInsensitive,
        }).test(decoded),
      )
    ) {
      return true;
    }
  }

  return false;
}

interface KnownIdentifier {
  value: string;
  caseInsensitive: boolean;
}

interface KnownIdentifierRedactionTerm {
  value: string;
  caseInsensitive: boolean;
}

function knownIdentifierRedactionTerms(identifier: KnownIdentifier): KnownIdentifierRedactionTerm[] {
  const terms: KnownIdentifierRedactionTerm[] = [
    { value: identifier.value, caseInsensitive: identifier.caseInsensitive },
  ];

  try {
    const encoded = encodeURIComponent(identifier.value);
    const formEncoded = encoded.replace(/%20/g, '+');

    if (encoded !== identifier.value) {
      for (const encodedVariant of percentEncodedCaseVariants(encoded)) {
        terms.push({ value: encodedVariant, caseInsensitive: identifier.caseInsensitive });
      }
    }

    if (formEncoded !== encoded && formEncoded !== identifier.value) {
      for (const formEncodedVariant of percentEncodedCaseVariants(formEncoded)) {
        terms.push({ value: formEncodedVariant, caseInsensitive: identifier.caseInsensitive });
      }
    }
  } catch {
    // A malformed surrogate should not prevent plain identifier redaction.
  }

  return uniqueRedactionTerms(terms);
}

function percentEncodedCaseVariants(value: string): string[] {
  return uniqueStringValues([
    value,
    value.replace(/%[0-9A-Fa-f]{2}/g, (match) => match.toLowerCase()),
    value.replace(/%[0-9A-Fa-f]{2}/g, (match) => match.toUpperCase()),
  ]);
}

function uniqueStringValues(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
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

function knownIdentifiers(snapshot: DiagnosticsSnapshot): KnownIdentifier[] {
  const identifiers = [
    knownIdentifier(snapshot.auth.userId, false),
    knownIdentifier(snapshot.auth.username, true),
    knownIdentifier(roomIdFromRoutePath(snapshot.route.path), false),
    knownIdentifier(snapshot.realtime.roomId, false),
    knownIdentifier(snapshot.rooms.activeRoomId, false),
    knownIdentifier(snapshot.rooms.activeRoomName, true),
    knownIdentifier(snapshot.rooms.pendingStartRoomId, false),
    knownIdentifier(snapshot.chat.roomId, false),
    ...snapshot.redactionIdentifiers,
  ]
    .filter((identifier): identifier is KnownIdentifier => identifier != null);

  return uniqueKnownIdentifiers(identifiers).sort((left, right) => right.value.length - left.value.length);
}

function knownIdentifier(value: string | null, caseInsensitive: boolean): KnownIdentifier | null {
  const normalized = value?.trim();

  if (normalized == null || normalized.length === 0) {
    return null;
  }

  return { value: normalized, caseInsensitive };
}

function normalizeRedactionIdentifiers(
  identifiers: DiagnosticsRedactionIdentifierInput[],
): DiagnosticsRedactionIdentifierSnapshot[] {
  return uniqueKnownIdentifiers(
    identifiers
      .map((identifier) =>
        knownIdentifier(optionalText(identifier.value), identifier.caseInsensitive ?? false),
      )
      .filter((identifier): identifier is KnownIdentifier => identifier != null),
  );
}

function uniqueKnownIdentifiers(identifiers: KnownIdentifier[]): KnownIdentifier[] {
  const seen = new Set<string>();

  return identifiers.filter((identifier) => {
    const normalizedValue = identifier.caseInsensitive
      ? identifier.value.toLowerCase()
      : identifier.value;
    const key = `${identifier.caseInsensitive}:${normalizedValue}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
