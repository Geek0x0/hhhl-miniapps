# Chat Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build richer two-level chat diagnostics with a safe default summary and confirmation-gated development details.

**Architecture:** Add a pure TypeScript diagnostics module that creates a structured snapshot and renders safe/detail text. Keep Pinia responsible for storing outputs and confirmation state, and keep Vue components responsible for display, confirmation, and copy actions.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite, Vitest, Testing Library Vue, existing i18n dictionaries, existing `redactSensitiveText`.

---

## File Structure

- Create `chat/src/settings/diagnostics.ts`
  - Owns diagnostics input types, snapshot creation, route classification, safe rendering, detail rendering, token redaction, and known identifier redaction for the safe output.
  - Has no Vue or Pinia dependency.
- Create `chat/src/settings/diagnostics.test.ts`
  - Covers safe/detail output, identifier boundaries, token redaction, raw input redaction, and route classification.
- Modify `chat/src/settings/settingsStore.ts`
  - Imports the diagnostics module.
  - Stores `safeDiagnostics`, `detailedDiagnostics`, and `diagnosticsDetailConfirmed`.
  - Preserves `diagnostics` as the safe-output compatibility field.
  - Adds actions to confirm and reset development details.
- Modify `chat/src/settings/settingsStore.test.ts`
  - Covers store integration with the diagnostics renderer and confirmation reset behavior.
- Modify `chat/src/settings/components/DiagnosticsPanel.vue`
  - Accepts safe/detail diagnostics props.
  - Shows safe summary by default.
  - Requires an explicit confirmation before detail output is visible.
  - Offers separate copy buttons for safe and detailed output.
- Create `chat/src/settings/components/DiagnosticsPanel.test.ts`
  - Covers default safe-only rendering, confirmation, detail rendering, and copy actions.
- Modify `chat/src/settings/components/SettingsView.vue`
  - Collects auth, realtime, room, chat, route, app version, and Telegram environment context when diagnostics open.
  - Wires detail confirmation from the panel to the settings store.
- Create `chat/src/settings/components/SettingsView.test.ts`
  - Covers the collected diagnostics input shape and detail confirmation event wiring.
- Modify `chat/src/i18n/messages.en.ts`
  - Adds English strings for safe summary, development details, copy, confirmation, and warning text.
- Modify `chat/src/i18n/messages.zh.ts`
  - Adds Chinese strings for the same keys.
- Modify `chat/src/styles/components.css`
  - Adds small diagnostics action and warning styles only if the existing `side-panel` and `diagnostics-output` styles are not enough.
- Modify `chat/src/shared/errors.test.ts`
  - Extends redaction regression coverage for `&i=` and JSON `"token"`.

## Task 1: Add Pure Diagnostics Renderer

**Files:**
- Create: `chat/src/settings/diagnostics.ts`
- Create: `chat/src/settings/diagnostics.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Create `chat/src/settings/diagnostics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDiagnosticsOutput, routeTypeFromPath } from './diagnostics';

function richDiagnosticsInput() {
  return {
    environment: {
      appVersion: '0.3.10',
      mode: 'test',
      isDev: false,
      instanceUrl: 'https://dc.hhhl.cc',
      telegramPresent: true,
      telegramPlatform: 'android',
    },
    auth: {
      status: 'authorized',
      hasUser: true,
      userId: 'user-secret',
      username: 'alice',
      error: 'auth failed for user-secret token=auth-token',
    },
    route: {
      name: 'room-detail',
      path: '/rooms/room-secret?i=query-token',
    },
    realtime: {
      status: 'degraded',
      roomId: 'room-secret',
    },
    storage: {
      status: 'available',
    },
    rooms: {
      loading: false,
      roomCount: 3,
      invitationCount: 2,
      activeRoomId: 'room-secret',
      activeRoomName: 'Secret Room',
      pendingStartRoomId: 'room-pending',
      memberCount: 7,
      outboxInvitationCount: 4,
      error: 'room-secret Secret Room room failed &i=room-token',
    },
    chat: {
      loading: false,
      roomId: 'room-secret',
      timelineCount: 12,
      outgoingCount: 2,
      failedOutgoingCount: 1,
      searchResultCount: 5,
      keySearchResultCount: 1,
      replyTargetPresent: true,
      quoteTargetPresent: false,
      error: 'chat failed token=chat-token',
      searchError: 'search failed for alice',
      keySearchError: 'key search failed',
    },
    raw: 'token=raw-token &i=raw-query {"token":"json-token"} user-secret alice room-secret Secret Room',
  };
}

describe('diagnostics renderer', () => {
  it('renders safe diagnostics without user or room identifiers', () => {
    const { safe } = createDiagnosticsOutput(richDiagnosticsInput());

    expect(safe).toContain('[environment]');
    expect(safe).toContain('appVersion=0.3.10');
    expect(safe).toContain('mode=test');
    expect(safe).toContain('dev=false');
    expect(safe).toContain('instance=https://dc.hhhl.cc');
    expect(safe).toContain('telegramPresent=true');
    expect(safe).toContain('telegramPlatform=android');
    expect(safe).toContain('[auth]');
    expect(safe).toContain('authStatus=authorized');
    expect(safe).toContain('hasUser=true');
    expect(safe).toContain('[route]');
    expect(safe).toContain('routeName=room-detail');
    expect(safe).toContain('routeType=room');
    expect(safe).toContain('isRoomRoute=true');
    expect(safe).toContain('[realtime]');
    expect(safe).toContain('realtimeStatus=degraded');
    expect(safe).toContain('[storage]');
    expect(safe).toContain('storageStatus=available');
    expect(safe).toContain('[rooms]');
    expect(safe).toContain('roomLoading=false');
    expect(safe).toContain('roomCount=3');
    expect(safe).toContain('invitationCount=2');
    expect(safe).toContain('[chat]');
    expect(safe).toContain('chatLoading=false');
    expect(safe).toContain('timelineCount=12');
    expect(safe).toContain('outgoingCount=2');
    expect(safe).toContain('searchResultCount=5');
    expect(safe).toContain('keySearchResultCount=1');
    expect(safe).toContain('[errors]');
    expect(safe).toContain('token=[redacted]');
    expect(safe).toContain('&i=[redacted]');
    expect(safe).toContain('"token":"[redacted]"');
    expect(safe).not.toContain('user-secret');
    expect(safe).not.toContain('alice');
    expect(safe).not.toContain('room-secret');
    expect(safe).not.toContain('Secret Room');
    expect(safe).not.toContain('auth-token');
    expect(safe).not.toContain('room-token');
    expect(safe).not.toContain('chat-token');
    expect(safe).not.toContain('raw-token');
    expect(safe).not.toContain('json-token');
  });

  it('renders detail diagnostics with allowed identifiers and redacted secrets', () => {
    const { detailed } = createDiagnosticsOutput(richDiagnosticsInput());

    expect(detailed).toContain('[details]');
    expect(detailed).toContain('userId=user-secret');
    expect(detailed).toContain('username=alice');
    expect(detailed).toContain('activeRoomId=room-secret');
    expect(detailed).toContain('activeRoomName=Secret Room');
    expect(detailed).toContain('pendingStartRoomId=room-pending');
    expect(detailed).toContain('chatRoomId=room-secret');
    expect(detailed).toContain('memberCount=7');
    expect(detailed).toContain('outboxInvitationCount=4');
    expect(detailed).toContain('replyTargetPresent=true');
    expect(detailed).toContain('quoteTargetPresent=false');
    expect(detailed).toContain('failedOutgoingCount=1');
    expect(detailed).toContain('token=[redacted]');
    expect(detailed).toContain('&i=[redacted]');
    expect(detailed).toContain('"token":"[redacted]"');
    expect(detailed).not.toContain('auth-token');
    expect(detailed).not.toContain('room-token');
    expect(detailed).not.toContain('chat-token');
    expect(detailed).not.toContain('raw-token');
    expect(detailed).not.toContain('json-token');
  });

  it('classifies known route paths', () => {
    expect(routeTypeFromPath('/')).toBe('root');
    expect(routeTypeFromPath('/rooms')).toBe('rooms');
    expect(routeTypeFromPath('/rooms/room-1')).toBe('room');
    expect(routeTypeFromPath('/settings')).toBe('settings');
    expect(routeTypeFromPath('/auth/callback')).toBe('auth-callback');
    expect(routeTypeFromPath('/bot-tools')).toBe('other');
  });
});
```

- [ ] **Step 2: Run renderer tests and verify failure**

Run:

```bash
cd chat
npm run test:run -- src/settings/diagnostics.test.ts
```

Expected: FAIL because `./diagnostics` does not exist.

- [ ] **Step 3: Create diagnostics renderer**

Create `chat/src/settings/diagnostics.ts`:

```ts
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { redactSensitiveText } from '@/shared/errors';

const NOT_SET = 'not-set';
const NONE = 'none';

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
  memberCount?: number;
  outboxInvitationCount?: number;
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

export interface DiagnosticsSnapshot {
  environment: Required<DiagnosticsEnvironmentInput>;
  auth: Required<Omit<DiagnosticsAuthInput, 'userId' | 'username' | 'error'>> & {
    userId: string;
    username: string;
  };
  route: {
    name: string;
    path: string;
    type: DiagnosticsRouteType;
  };
  realtime: {
    status: string;
    roomId: string;
  };
  storage: {
    status: string;
  };
  rooms: Required<Omit<DiagnosticsRoomsInput, 'activeRoomId' | 'activeRoomName' | 'pendingStartRoomId' | 'error'>> & {
    activeRoomId: string;
    activeRoomName: string;
    pendingStartRoomId: string;
  };
  chat: Required<Omit<DiagnosticsChatInput, 'roomId' | 'error' | 'searchError' | 'keySearchError'>> & {
    roomId: string;
  };
  errors: {
    auth: string;
    rooms: string;
    chat: string;
    search: string;
    keySearch: string;
  };
  raw: string;
}

export interface DiagnosticsOutput {
  snapshot: DiagnosticsSnapshot;
  safe: string;
  detailed: string;
}

function text(value: string | null | undefined, fallback = NOT_SET): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed === '' ? fallback : trimmed;
}

function errorText(value: string | null | undefined): string {
  return text(value, NONE);
}

function count(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function bool(value: boolean | undefined): boolean {
  return value === true;
}

function formatBool(value: boolean): string {
  return value ? 'true' : 'false';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function routeTypeFromPath(path: string | undefined): DiagnosticsRouteType {
  const cleanPath = path?.split('?')[0] ?? '';

  if (cleanPath === '/') {
    return 'root';
  }

  if (cleanPath === '/rooms') {
    return 'rooms';
  }

  if (cleanPath.startsWith('/rooms/')) {
    return 'room';
  }

  if (cleanPath === '/settings') {
    return 'settings';
  }

  if (cleanPath === '/auth/callback') {
    return 'auth-callback';
  }

  return 'other';
}

export function createDiagnosticsSnapshot(input: DiagnosticsInput = {}): DiagnosticsSnapshot {
  const routePath = text(input.route?.path);

  return {
    environment: {
      appVersion: text(input.environment?.appVersion),
      mode: text(input.environment?.mode),
      isDev: bool(input.environment?.isDev),
      instanceUrl: text(input.environment?.instanceUrl ?? input.instanceUrl ?? DC_HHHL_ORIGIN),
      telegramPresent: bool(input.environment?.telegramPresent),
      telegramPlatform: text(input.environment?.telegramPlatform),
    },
    auth: {
      status: text(input.auth?.status),
      hasUser: bool(input.auth?.hasUser),
      userId: text(input.auth?.userId),
      username: text(input.auth?.username),
    },
    route: {
      name: text(input.route?.name),
      path: routePath,
      type: routeTypeFromPath(routePath),
    },
    realtime: {
      status: text(input.realtime?.status ?? input.realtimeStatus),
      roomId: text(input.realtime?.roomId),
    },
    storage: {
      status: text(input.storage?.status ?? input.storageStatus),
    },
    rooms: {
      loading: bool(input.rooms?.loading),
      roomCount: count(input.rooms?.roomCount),
      invitationCount: count(input.rooms?.invitationCount),
      activeRoomId: text(input.rooms?.activeRoomId),
      activeRoomName: text(input.rooms?.activeRoomName),
      pendingStartRoomId: text(input.rooms?.pendingStartRoomId),
      memberCount: count(input.rooms?.memberCount),
      outboxInvitationCount: count(input.rooms?.outboxInvitationCount),
    },
    chat: {
      loading: bool(input.chat?.loading),
      roomId: text(input.chat?.roomId),
      timelineCount: count(input.chat?.timelineCount),
      outgoingCount: count(input.chat?.outgoingCount),
      failedOutgoingCount: count(input.chat?.failedOutgoingCount),
      searchResultCount: count(input.chat?.searchResultCount),
      keySearchResultCount: count(input.chat?.keySearchResultCount),
      replyTargetPresent: bool(input.chat?.replyTargetPresent),
      quoteTargetPresent: bool(input.chat?.quoteTargetPresent),
    },
    errors: {
      auth: errorText(input.errors?.auth ?? input.auth?.error),
      rooms: errorText(input.errors?.rooms ?? input.rooms?.error),
      chat: errorText(input.errors?.chat ?? input.chat?.error),
      search: errorText(input.errors?.search ?? input.chat?.searchError),
      keySearch: errorText(input.errors?.keySearch ?? input.chat?.keySearchError),
    },
    raw: text(input.raw, ''),
  };
}

function knownIdentifiers(snapshot: DiagnosticsSnapshot): string[] {
  return unique([
    snapshot.auth.userId,
    snapshot.auth.username,
    snapshot.realtime.roomId,
    snapshot.rooms.activeRoomId,
    snapshot.rooms.activeRoomName,
    snapshot.rooms.pendingStartRoomId,
    snapshot.chat.roomId,
  ].filter((value) => value !== NOT_SET && value !== ''));
}

function redactKnownIdentifiers(value: string, snapshot: DiagnosticsSnapshot): string {
  return knownIdentifiers(snapshot).reduce((next, identifier) => {
    return next.replace(new RegExp(escapeRegExp(identifier), 'g'), '[redacted]');
  }, value);
}

export function renderSafeDiagnostics(snapshot: DiagnosticsSnapshot): string {
  const lines = [
    '[environment]',
    `appVersion=${snapshot.environment.appVersion}`,
    `mode=${snapshot.environment.mode}`,
    `dev=${formatBool(snapshot.environment.isDev)}`,
    `instance=${snapshot.environment.instanceUrl}`,
    `telegramPresent=${formatBool(snapshot.environment.telegramPresent)}`,
    `telegramPlatform=${snapshot.environment.telegramPlatform}`,
    '[auth]',
    `authStatus=${snapshot.auth.status}`,
    `hasUser=${formatBool(snapshot.auth.hasUser)}`,
    '[route]',
    `routeName=${snapshot.route.name}`,
    `routeType=${snapshot.route.type}`,
    `isRoomRoute=${formatBool(snapshot.route.type === 'room')}`,
    '[realtime]',
    `realtimeStatus=${snapshot.realtime.status}`,
    '[storage]',
    `storageStatus=${snapshot.storage.status}`,
    '[rooms]',
    `roomLoading=${formatBool(snapshot.rooms.loading)}`,
    `roomCount=${snapshot.rooms.roomCount}`,
    `invitationCount=${snapshot.rooms.invitationCount}`,
    '[chat]',
    `chatLoading=${formatBool(snapshot.chat.loading)}`,
    `timelineCount=${snapshot.chat.timelineCount}`,
    `outgoingCount=${snapshot.chat.outgoingCount}`,
    `searchResultCount=${snapshot.chat.searchResultCount}`,
    `keySearchResultCount=${snapshot.chat.keySearchResultCount}`,
    '[errors]',
    `authError=${snapshot.errors.auth}`,
    `roomsError=${snapshot.errors.rooms}`,
    `chatError=${snapshot.errors.chat}`,
    `searchError=${snapshot.errors.search}`,
    `keySearchError=${snapshot.errors.keySearch}`,
  ];

  if (snapshot.raw !== '') {
    lines.push('[raw]', snapshot.raw);
  }

  return redactKnownIdentifiers(redactSensitiveText(lines.join('\n')), snapshot);
}

export function renderDetailedDiagnostics(snapshot: DiagnosticsSnapshot): string {
  // The safe section stays identifier-redacted inside detailed diagnostics.
  // Allowed identifiers are exposed only in the explicit details section below.
  const lines = [
    renderSafeDiagnostics(snapshot),
    '[details]',
    `userId=${snapshot.auth.userId}`,
    `username=${snapshot.auth.username}`,
    `activeRoomId=${snapshot.rooms.activeRoomId}`,
    `activeRoomName=${snapshot.rooms.activeRoomName}`,
    `pendingStartRoomId=${snapshot.rooms.pendingStartRoomId}`,
    `chatRoomId=${snapshot.chat.roomId}`,
    `memberCount=${snapshot.rooms.memberCount}`,
    `outboxInvitationCount=${snapshot.rooms.outboxInvitationCount}`,
    `replyTargetPresent=${formatBool(snapshot.chat.replyTargetPresent)}`,
    `quoteTargetPresent=${formatBool(snapshot.chat.quoteTargetPresent)}`,
    `failedOutgoingCount=${snapshot.chat.failedOutgoingCount}`,
  ];

  return redactSensitiveText(lines.join('\n'));
}

export function createDiagnosticsOutput(input: DiagnosticsInput = {}): DiagnosticsOutput {
  const snapshot = createDiagnosticsSnapshot(input);

  return {
    snapshot,
    safe: renderSafeDiagnostics(snapshot),
    detailed: renderDetailedDiagnostics(snapshot),
  };
}
```

- [ ] **Step 4: Run renderer tests and verify pass**

Run:

```bash
cd chat
npm run test:run -- src/settings/diagnostics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit renderer module**

Run:

```bash
git add chat/src/settings/diagnostics.ts chat/src/settings/diagnostics.test.ts
git commit -m "feat(chat): add diagnostics renderer"
```

## Task 2: Store Diagnostics Outputs And Confirmation State

**Files:**
- Modify: `chat/src/settings/settingsStore.ts`
- Modify: `chat/src/settings/settingsStore.test.ts`

- [ ] **Step 1: Write failing settings store tests**

In `chat/src/settings/settingsStore.test.ts`, replace the existing `redacts token-like strings from diagnostics` test with these two tests:

```ts
  it('collects safe and detailed diagnostics while keeping the compatibility diagnostics field safe', () => {
    const store = useSettingsStore();

    store.collectDiagnostics({
      environment: {
        appVersion: '0.3.10',
        mode: 'test',
        isDev: false,
        instanceUrl: 'https://dc.hhhl.cc',
        telegramPresent: true,
        telegramPlatform: 'ios',
      },
      auth: {
        status: 'authorized',
        hasUser: true,
        userId: 'user-secret',
        username: 'alice',
      },
      route: {
        name: 'room-detail',
        path: '/rooms/room-secret',
      },
      realtime: {
        status: 'degraded',
        roomId: 'room-secret',
      },
      storage: {
        status: 'available',
      },
      rooms: {
        loading: false,
        roomCount: 2,
        invitationCount: 1,
        activeRoomId: 'room-secret',
        activeRoomName: 'Secret Room',
        pendingStartRoomId: 'room-pending',
        memberCount: 5,
        outboxInvitationCount: 3,
        error: 'room-secret failed &i=secret-room-token',
      },
      chat: {
        loading: false,
        roomId: 'room-secret',
        timelineCount: 9,
        outgoingCount: 2,
        failedOutgoingCount: 1,
        searchResultCount: 4,
        keySearchResultCount: 1,
        replyTargetPresent: true,
        quoteTargetPresent: false,
        error: 'token=secret-chat-token',
      },
      raw: 'token=secret &i=secret2 {"token":"secret3"} user-secret alice room-secret Secret Room',
    });

    expect(store.safeDiagnostics).toContain('appVersion=0.3.10');
    expect(store.safeDiagnostics).toContain('authStatus=authorized');
    expect(store.safeDiagnostics).toContain('roomCount=2');
    expect(store.safeDiagnostics).toContain('timelineCount=9');
    expect(store.safeDiagnostics).toContain('token=[redacted]');
    expect(store.safeDiagnostics).toContain('&i=[redacted]');
    expect(store.safeDiagnostics).toContain('"token":"[redacted]"');
    expect(store.safeDiagnostics).not.toContain('user-secret');
    expect(store.safeDiagnostics).not.toContain('alice');
    expect(store.safeDiagnostics).not.toContain('room-secret');
    expect(store.safeDiagnostics).not.toContain('Secret Room');
    expect(store.detailedDiagnostics).toContain('userId=user-secret');
    expect(store.detailedDiagnostics).toContain('username=alice');
    expect(store.detailedDiagnostics).toContain('activeRoomId=room-secret');
    expect(store.detailedDiagnostics).toContain('activeRoomName=Secret Room');
    expect(store.detailedDiagnostics).not.toContain('secret3');
    expect(store.diagnostics).toBe(store.safeDiagnostics);
    expect(store.diagnosticsDetailConfirmed).toBe(false);
  });

  it('resets diagnostics detail confirmation when diagnostics refresh or the panel closes', () => {
    const store = useSettingsStore();

    store.collectDiagnostics({ storage: { status: 'available' } });
    store.confirmDiagnosticsDetail();
    expect(store.diagnosticsDetailConfirmed).toBe(true);

    store.collectDiagnostics({ storage: { status: 'available' } });
    expect(store.diagnosticsDetailConfirmed).toBe(false);

    store.confirmDiagnosticsDetail();
    store.debugOpen = true;
    store.toggleDebug();
    expect(store.debugOpen).toBe(false);
    expect(store.diagnosticsDetailConfirmed).toBe(false);
  });
```

- [ ] **Step 2: Run settings store tests and verify failure**

Run:

```bash
cd chat
npm run test:run -- src/settings/settingsStore.test.ts
```

Expected: FAIL because `safeDiagnostics`, `detailedDiagnostics`, `diagnosticsDetailConfirmed`, and `confirmDiagnosticsDetail` do not exist.

- [ ] **Step 3: Update settings store imports, types, state, and actions**

In `chat/src/settings/settingsStore.ts`, add this import near the existing imports:

```ts
import { createDiagnosticsOutput, type DiagnosticsInput } from './diagnostics';
```

Replace the current `DiagnosticsInput` interface with the imported type. Keep the current `storageStatus()` helper.

Update `SettingsState`:

```ts
export interface SettingsState {
  language: Locale;
  themeMode: ThemeMode;
  favoriteUserIds: string[];
  debugOpen: boolean;
  diagnostics: string;
  safeDiagnostics: string;
  detailedDiagnostics: string;
  diagnosticsDetailConfirmed: boolean;
  lastAction: 'settings.clearLocalDataDone' | null;
}
```

Update the initial state:

```ts
  state: (): SettingsState => ({
    language: 'en',
    themeMode: 'system',
    favoriteUserIds: [],
    debugOpen: false,
    diagnostics: '',
    safeDiagnostics: '',
    detailedDiagnostics: '',
    diagnosticsDetailConfirmed: false,
    lastAction: null,
  }),
```

Replace `toggleDebug()` and `collectDiagnostics()` with:

```ts
    toggleDebug() {
      this.debugOpen = !this.debugOpen;
      if (!this.debugOpen) {
        this.resetDiagnosticsDetail();
      }
    },

    collectDiagnostics(input: DiagnosticsInput = {}) {
      const output = createDiagnosticsOutput({
        ...input,
        environment: {
          ...input.environment,
          instanceUrl: input.environment?.instanceUrl ?? input.instanceUrl ?? DC_HHHL_ORIGIN,
        },
        realtime: {
          ...input.realtime,
          status: input.realtime?.status ?? input.realtimeStatus,
        },
        storage: {
          ...input.storage,
          status: input.storage?.status ?? input.storageStatus ?? storageStatus(createLocalStorageAdapter()),
        },
      });

      this.safeDiagnostics = output.safe;
      this.detailedDiagnostics = output.detailed;
      this.diagnostics = output.safe;
      this.resetDiagnosticsDetail();
    },

    confirmDiagnosticsDetail() {
      this.diagnosticsDetailConfirmed = true;
    },

    resetDiagnosticsDetail() {
      this.diagnosticsDetailConfirmed = false;
    },
```

- [ ] **Step 4: Run settings store tests and verify pass**

Run:

```bash
cd chat
npm run test:run -- src/settings/settingsStore.test.ts src/settings/diagnostics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit store integration**

Run:

```bash
git add chat/src/settings/settingsStore.ts chat/src/settings/settingsStore.test.ts
git commit -m "feat(chat): store two-level diagnostics"
```

## Task 3: Build Confirmation-Gated Diagnostics Panel

**Files:**
- Modify: `chat/src/settings/components/DiagnosticsPanel.vue`
- Create: `chat/src/settings/components/DiagnosticsPanel.test.ts`
- Modify: `chat/src/i18n/messages.en.ts`
- Modify: `chat/src/i18n/messages.zh.ts`
- Modify: `chat/src/styles/components.css`

- [ ] **Step 1: Add i18n strings**

In `chat/src/i18n/messages.en.ts`, add these keys after `settings.diagnostics`:

```ts
  'settings.diagnosticsSafeSummary': 'Safe summary',
  'settings.diagnosticsDevelopmentDetails': 'Development details',
  'settings.diagnosticsCopySafe': 'Copy safe summary',
  'settings.diagnosticsCopyDetailed': 'Copy development details',
  'settings.diagnosticsShowDetails': 'Show development details',
  'settings.diagnosticsConfirmDetails': 'Show details',
  'settings.diagnosticsDetailsNotice': 'Development details may include user and room identifiers. They do not include message text or tokens.',
```

In `chat/src/i18n/messages.zh.ts`, add these keys after `settings.diagnostics`:

```ts
  'settings.diagnosticsSafeSummary': '安全摘要',
  'settings.diagnosticsDevelopmentDetails': '开发详情',
  'settings.diagnosticsCopySafe': '复制安全摘要',
  'settings.diagnosticsCopyDetailed': '复制开发详情',
  'settings.diagnosticsShowDetails': '显示开发详情',
  'settings.diagnosticsConfirmDetails': '显示详情',
  'settings.diagnosticsDetailsNotice': '开发详情可能包含用户和房间标识，但不包含消息正文或 token。',
```

- [ ] **Step 2: Write failing panel tests**

Create `chat/src/settings/components/DiagnosticsPanel.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DiagnosticsPanel from './DiagnosticsPanel.vue';

describe('DiagnosticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => undefined) },
      configurable: true,
    });
  });

  it('shows only the safe summary by default', () => {
    render(DiagnosticsPanel, {
      props: {
        safeDiagnostics: 'safe output',
        detailedDiagnostics: 'detail output',
        detailConfirmed: false,
      },
    });

    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Safe summary' })).toBeInTheDocument();
    expect(screen.getByText('safe output')).toBeInTheDocument();
    expect(screen.queryByText('detail output')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show development details' })).toBeInTheDocument();
  });

  it('asks for confirmation before emitting the detail confirmation event', async () => {
    const { emitted } = render(DiagnosticsPanel, {
      props: {
        safeDiagnostics: 'safe output',
        detailedDiagnostics: 'detail output',
        detailConfirmed: false,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Show development details' }));
    expect(screen.getByText('Development details may include user and room identifiers. They do not include message text or tokens.')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(emitted()['confirm-detail']).toHaveLength(1);
  });

  it('shows and copies detailed diagnostics after confirmation', async () => {
    render(DiagnosticsPanel, {
      props: {
        safeDiagnostics: 'safe output',
        detailedDiagnostics: 'detail output',
        detailConfirmed: true,
      },
    });

    expect(screen.getByRole('heading', { name: 'Development details' })).toBeInTheDocument();
    expect(screen.getByText('detail output')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Copy safe summary' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('safe output');

    await fireEvent.click(screen.getByRole('button', { name: 'Copy development details' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('detail output');
  });
});
```

- [ ] **Step 3: Run panel tests and verify failure**

Run:

```bash
cd chat
npm run test:run -- src/settings/components/DiagnosticsPanel.test.ts
```

Expected: FAIL because `DiagnosticsPanel.vue` still accepts a single `diagnostics` prop.

- [ ] **Step 4: Update DiagnosticsPanel component**

Replace `chat/src/settings/components/DiagnosticsPanel.vue` with:

```vue
<template>
  <section class="side-panel">
    <h2>{{ i18n.t('settings.diagnostics') }}</h2>

    <div class="diagnostics-section">
      <div class="diagnostics-section__header">
        <h3>{{ i18n.t('settings.diagnosticsSafeSummary') }}</h3>
        <button
          class="app-button app-button-secondary"
          type="button"
          @click="copyDiagnostics(safeDiagnostics)"
        >
          {{ i18n.t('settings.diagnosticsCopySafe') }}
        </button>
      </div>
      <pre class="diagnostics-output">{{ safeDiagnostics }}</pre>
    </div>

    <div
      v-if="detailConfirmed"
      class="diagnostics-section"
    >
      <div class="diagnostics-section__header">
        <h3>{{ i18n.t('settings.diagnosticsDevelopmentDetails') }}</h3>
        <button
          class="app-button app-button-secondary"
          type="button"
          @click="copyDiagnostics(detailedDiagnostics)"
        >
          {{ i18n.t('settings.diagnosticsCopyDetailed') }}
        </button>
      </div>
      <pre class="diagnostics-output">{{ detailedDiagnostics }}</pre>
    </div>

    <div
      v-else
      class="diagnostics-detail-gate"
    >
      <p
        v-if="confirmingDetail"
        class="app-copy"
      >
        {{ i18n.t('settings.diagnosticsDetailsNotice') }}
      </p>
      <button
        v-if="confirmingDetail"
        class="app-button app-button-secondary"
        type="button"
        @click="confirmDetail"
      >
        {{ i18n.t('settings.diagnosticsConfirmDetails') }}
      </button>
      <button
        v-else
        class="app-button app-button-secondary"
        type="button"
        @click="confirmingDetail = true"
      >
        {{ i18n.t('settings.diagnosticsShowDetails') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { i18n } from '@/i18n';

const props = defineProps<{
  safeDiagnostics: string;
  detailedDiagnostics: string;
  detailConfirmed: boolean;
}>();

const emit = defineEmits<{
  'confirm-detail': [];
}>();

const confirmingDetail = ref(false);

async function copyDiagnostics(value: string): Promise<void> {
  await navigator.clipboard?.writeText(value);
}

function confirmDetail(): void {
  confirmingDetail.value = false;
  emit('confirm-detail');
}

watch(() => props.detailConfirmed, (confirmed) => {
  if (!confirmed) {
    confirmingDetail.value = false;
  }
});
</script>
```

- [ ] **Step 5: Add diagnostics panel styles**

In `chat/src/styles/components.css`, add after the existing `.diagnostics-output` rule:

```css
.diagnostics-section {
  display: grid;
  gap: 0.5rem;
}

.diagnostics-section__header {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
}

.diagnostics-section__header h3 {
  font-size: 0.95rem;
  margin: 0;
}

.diagnostics-detail-gate {
  display: grid;
  gap: 0.75rem;
}
```

- [ ] **Step 6: Run panel tests and verify pass**

Run:

```bash
cd chat
npm run test:run -- src/settings/components/DiagnosticsPanel.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit panel UI**

Run:

```bash
git add chat/src/settings/components/DiagnosticsPanel.vue chat/src/settings/components/DiagnosticsPanel.test.ts chat/src/i18n/messages.en.ts chat/src/i18n/messages.zh.ts chat/src/styles/components.css
git commit -m "feat(chat): gate diagnostics development details"
```

## Task 4: Collect Live Settings Context

**Files:**
- Modify: `chat/src/settings/components/SettingsView.vue`
- Create: `chat/src/settings/components/SettingsView.test.ts`

- [ ] **Step 1: Write failing SettingsView integration tests**

Create `chat/src/settings/components/SettingsView.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/i18n';
import SettingsView from './SettingsView.vue';

const mocks = vi.hoisted(() => ({
  route: {
    name: 'room-detail',
    path: '/rooms/room-secret',
  },
  router: {
    push: vi.fn(),
  },
  auth: {
    status: 'authorized',
    user: {
      id: 'user-secret',
      username: 'alice',
      name: 'Alice',
    },
    logout: vi.fn(),
  },
  realtimeStore: {
    status: 'degraded',
    roomId: 'room-secret',
  },
  roomStore: {
    loading: false,
    error: 'room failed',
    rooms: [
      {
        room: {
          id: 'room-secret',
          name: 'Secret Room',
        },
        sources: ['joined'],
      },
    ],
    invitations: [{ id: 'invitation-1' }],
    deepLinkedRoom: null,
    pendingStartRoomId: 'room-pending',
    activeRoomId: 'room-secret',
    membersByRoomId: {
      'room-secret': [
        { id: 'member-1', username: 'member1' },
        { id: 'member-2', username: 'member2' },
      ],
    },
    outboxInvitations: [{ id: 'outbox-1' }],
  },
  chatStore: {
    loading: false,
    error: 'chat failed',
    roomId: 'room-secret',
    timeline: [{ kind: 'server', message: { id: 'message-1' } }],
    outgoing: [
      { localId: 'local-1', status: 'failed' },
      { localId: 'local-2', status: 'pending' },
    ],
    searchResults: [{ id: 'search-1' }],
    keySearchResults: [{ id: 'key-1' }],
    replyTarget: { id: 'reply-1' },
    quoteTarget: null,
    searchError: 'search failed',
    keySearchError: 'key failed',
  },
  settings: {
    language: 'en',
    themeMode: 'system',
    debugOpen: false,
    safeDiagnostics: 'safe output',
    detailedDiagnostics: 'detail output',
    diagnosticsDetailConfirmed: false,
    lastAction: null,
    init: vi.fn(),
    setLanguage: vi.fn(),
    setThemeMode: vi.fn(),
    clearLocalData: vi.fn(),
    collectDiagnostics: vi.fn(),
    confirmDiagnosticsDetail: vi.fn(),
    logout: vi.fn(),
    toggleDebug: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));

vi.mock('@/auth/authStore', () => ({
  createAuthDependencies: vi.fn(() => ({ storage: {} })),
  useAuthStore: () => mocks.auth,
}));

vi.mock('@/realtime/realtimeStore', () => ({
  useRealtimeStore: () => mocks.realtimeStore,
}));

vi.mock('@/rooms/roomStore', () => ({
  useRoomStore: () => mocks.roomStore,
}));

vi.mock('@/chat/chatStore', () => ({
  useChatStore: () => mocks.chatStore,
}));

vi.mock('@/telegram/telegram', () => ({
  getTelegramLaunchContext: () => ({
    platform: 'android',
    startParam: { type: 'room', roomId: 'room-secret' },
    themeParams: {},
  }),
  isTelegramEnvironment: () => true,
}));

vi.mock('../settingsStore', () => ({
  useSettingsStore: () => mocks.settings,
}));

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.setLocale('en');
    mocks.settings.debugOpen = false;
    mocks.settings.diagnosticsDetailConfirmed = false;
  });

  it('collects diagnostics with auth, route, realtime, room, chat, app, and Telegram context when opened', async () => {
    mocks.settings.toggleDebug.mockImplementation(() => {
      mocks.settings.debugOpen = true;
    });

    render(SettingsView);

    await fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));

    expect(mocks.settings.collectDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      environment: expect.objectContaining({
        appVersion: expect.any(String),
        mode: expect.any(String),
        isDev: expect.any(Boolean),
        instanceUrl: 'https://dc.hhhl.cc',
        telegramPresent: true,
        telegramPlatform: 'android',
      }),
      auth: expect.objectContaining({
        status: 'authorized',
        hasUser: true,
        userId: 'user-secret',
        username: 'alice',
      }),
      route: {
        name: 'room-detail',
        path: '/rooms/room-secret',
      },
      realtime: {
        status: 'degraded',
        roomId: 'room-secret',
      },
      rooms: expect.objectContaining({
        loading: false,
        roomCount: 1,
        invitationCount: 1,
        activeRoomId: 'room-secret',
        activeRoomName: 'Secret Room',
        pendingStartRoomId: 'room-pending',
        memberCount: 2,
        outboxInvitationCount: 1,
        error: 'room failed',
      }),
      chat: expect.objectContaining({
        loading: false,
        roomId: 'room-secret',
        timelineCount: 1,
        outgoingCount: 2,
        failedOutgoingCount: 1,
        searchResultCount: 1,
        keySearchResultCount: 1,
        replyTargetPresent: true,
        quoteTargetPresent: false,
        error: 'chat failed',
        searchError: 'search failed',
        keySearchError: 'key failed',
      }),
    }));
  });

  it('wires development detail confirmation from the panel to the settings store', async () => {
    mocks.settings.debugOpen = true;

    render(SettingsView);

    await fireEvent.click(screen.getByRole('button', { name: 'Show development details' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Show details' }));

    expect(mocks.settings.confirmDiagnosticsDetail).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run SettingsView tests and verify failure**

Run:

```bash
cd chat
npm run test:run -- src/settings/components/SettingsView.test.ts
```

Expected: FAIL because `SettingsView.vue` does not import room/chat stores, route, Telegram helpers, or pass the new panel props.

- [ ] **Step 3: Update SettingsView template**

In `chat/src/settings/components/SettingsView.vue`, replace the current `DiagnosticsPanel` usage:

```vue
    <DiagnosticsPanel
      v-if="settings.debugOpen"
      :safe-diagnostics="settings.safeDiagnostics"
      :detailed-diagnostics="settings.detailedDiagnostics"
      :detail-confirmed="settings.diagnosticsDetailConfirmed"
      @confirm-detail="settings.confirmDiagnosticsDetail"
    />
```

- [ ] **Step 4: Update SettingsView script imports and setup**

In `chat/src/settings/components/SettingsView.vue`, update the script imports:

```ts
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Monitor, Moon, Sun } from '@lucide/vue';
import { createAuthDependencies, useAuthStore } from '@/auth/authStore';
import { useChatStore } from '@/chat/chatStore';
import { i18n, type MessageKey } from '@/i18n';
import { useRealtimeStore } from '@/realtime/realtimeStore';
import { useRoomStore } from '@/rooms/roomStore';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { getTelegramLaunchContext, isTelegramEnvironment } from '@/telegram/telegram';
import { useSettingsStore, type ThemeMode } from '../settingsStore';
import DiagnosticsPanel from './DiagnosticsPanel.vue';
```

Replace the current store/context constants with:

```ts
const route = useRoute();
const auth = useAuthStore();
const settings = useSettingsStore();
const realtimeStore = useRealtimeStore();
const roomStore = useRoomStore();
const chatStore = useChatStore();
const telegramLaunchContext = getTelegramLaunchContext();
```

Keep the existing `router`, `appVersion`, and `themeOptions` constants.

- [ ] **Step 5: Add SettingsView diagnostics helpers**

In `chat/src/settings/components/SettingsView.vue`, add these helpers before `toggleDiagnostics()`:

```ts
function routeName(): string | null {
  if (typeof route.name === 'string') {
    return route.name;
  }

  return route.name == null ? null : String(route.name);
}

function currentRoomId(): string | null {
  return roomStore.activeRoomId ?? chatStore.roomId ?? realtimeStore.roomId ?? null;
}

function currentRoomName(): string | null {
  const roomId = currentRoomId();
  if (roomId == null) {
    return null;
  }

  return roomStore.rooms.find((entry) => entry.room.id === roomId)?.room.name ?? roomStore.deepLinkedRoom?.name ?? null;
}

function currentMemberCount(): number {
  const roomId = currentRoomId();
  if (roomId == null) {
    return 0;
  }

  return roomStore.membersByRoomId[roomId]?.length ?? 0;
}

function failedOutgoingCount(): number {
  return chatStore.outgoing.filter((item) => item.status === 'failed').length;
}

function collectSettingsDiagnostics(): void {
  settings.collectDiagnostics({
    environment: {
      appVersion,
      mode: import.meta.env.MODE,
      isDev: import.meta.env.DEV,
      instanceUrl: DC_HHHL_ORIGIN,
      telegramPresent: isTelegramEnvironment(),
      telegramPlatform: telegramLaunchContext.platform,
    },
    auth: {
      status: auth.status,
      hasUser: auth.user != null,
      userId: auth.user?.id ?? null,
      username: auth.user?.username ?? auth.user?.name ?? null,
      error: auth.error,
    },
    route: {
      name: routeName(),
      path: route.path,
    },
    realtime: {
      status: realtimeStore.status,
      roomId: realtimeStore.roomId,
    },
    rooms: {
      loading: roomStore.loading,
      roomCount: roomStore.rooms.length,
      invitationCount: roomStore.invitations.length,
      activeRoomId: currentRoomId(),
      activeRoomName: currentRoomName(),
      pendingStartRoomId: roomStore.pendingStartRoomId,
      memberCount: currentMemberCount(),
      outboxInvitationCount: roomStore.outboxInvitations.length,
      error: roomStore.error,
    },
    chat: {
      loading: chatStore.loading,
      roomId: chatStore.roomId,
      timelineCount: chatStore.timeline.length,
      outgoingCount: chatStore.outgoing.length,
      failedOutgoingCount: failedOutgoingCount(),
      searchResultCount: chatStore.searchResults.length,
      keySearchResultCount: chatStore.keySearchResults.length,
      replyTargetPresent: chatStore.replyTarget != null,
      quoteTargetPresent: chatStore.quoteTarget != null,
      error: chatStore.error,
      searchError: chatStore.searchError,
      keySearchError: chatStore.keySearchError,
    },
  });
}
```

- [ ] **Step 6: Update SettingsView diagnostics toggle**

Replace `toggleDiagnostics()` with:

```ts
function toggleDiagnostics(): void {
  settings.toggleDebug();
  if (settings.debugOpen) {
    collectSettingsDiagnostics();
  }
}
```

- [ ] **Step 7: Run SettingsView tests and verify pass**

Run:

```bash
cd chat
npm run test:run -- src/settings/components/SettingsView.test.ts src/settings/components/DiagnosticsPanel.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit SettingsView integration**

Run:

```bash
git add chat/src/settings/components/SettingsView.vue chat/src/settings/components/SettingsView.test.ts
git commit -m "feat(chat): collect diagnostics context from settings"
```

## Task 5: Strengthen Shared Redaction Coverage

**Files:**
- Modify: `chat/src/shared/errors.test.ts`

- [ ] **Step 1: Extend redaction regression test**

In `chat/src/shared/errors.test.ts`, replace the `redacts token query strings and JSON token fields` test with:

```ts
  it('redacts token query strings and JSON token fields', () => {
    const raw = [
      'https://dc.hhhl.cc/streaming?i=secret-token',
      'https://dc.hhhl.cc/api?room=1&i=query-token&safe=1',
      'token=form-token',
      '{"i":"json-i-token"}',
      '{"token":"json-token"}',
    ].join(' ');

    expect(redactSensitiveText(raw)).toBe([
      'https://dc.hhhl.cc/streaming?i=[redacted]',
      'https://dc.hhhl.cc/api?room=1&i=[redacted]&safe=1',
      'token=[redacted]',
      '{"i":"[redacted]"}',
      '{"token":"[redacted]"}',
    ].join(' '));
  });
```

- [ ] **Step 2: Run shared error tests**

Run:

```bash
cd chat
npm run test:run -- src/shared/errors.test.ts
```

Expected: PASS with the existing `redactSensitiveText` implementation.

- [ ] **Step 3: Commit redaction coverage**

Run:

```bash
git add chat/src/shared/errors.test.ts
git commit -m "test(chat): cover diagnostics redaction patterns"
```

## Task 6: Final Verification

**Files:**
- Read: `docs/superpowers/specs/2026-06-05-chat-diagnostics-design.md`
- Verify: all modified `chat/src/settings`, `chat/src/shared`, i18n, and style files

- [ ] **Step 1: Run targeted diagnostics tests**

Run:

```bash
cd chat
npm run test:run -- src/settings src/shared
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
cd chat
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
cd chat
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: no uncommitted changes.

- [ ] **Step 5: Confirm spec coverage**

Compare the implementation against `docs/superpowers/specs/2026-06-05-chat-diagnostics-design.md`:

- Safe summary contains environment, auth, route, realtime, storage, rooms, chat, and errors.
- Safe summary excludes user ID, username, room ID, and room name.
- Development details require confirmation.
- Development details include allowed user and room identifiers.
- Neither output includes token values, Telegram `initData`, message text, message ID lists, file URLs, or unredacted sensitive URL query parameters.
- Visible UI strings exist in English and Chinese.

Expected: every bullet is satisfied by tests or direct file inspection.
