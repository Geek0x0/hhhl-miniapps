# Telegram Mini App Chat Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Telegram Mini App chat client for `dc.hhhl.cc`, implemented as a standalone `chat/` sub-application that can be deployed directly to Cloudflare Workers.

**Architecture:** The repository root can host multiple future Mini Apps, so this implementation lives under `chat/`. The `chat/` app is a Vue 3 + TypeScript + Vite frontend that talks directly to `https://dc.hhhl.cc/api`, uses MiAuth for `dc.hhhl.cc` tokens, stores tokens locally, gates the full UI to Telegram WebApp, and deploys as static Workers assets with SPA fallback routing.

**Tech Stack:** Vue 3, TypeScript, Vite, Pinia, Vue Router, Vitest, Testing Library, MSW, Playwright, npm, Wrangler, GitHub Actions, Cloudflare Workers static assets.

---

## Implementation Rules

- Keep all app source, package metadata, tests, scripts, and Workers config inside `chat/` unless the file is explicitly repository-level, such as `.github/workflows/chat-ci.yml`.
- Run all Node commands from `chat/` unless a step says otherwise.
- Use TDD for domain logic, API clients, stores, and route guards: write the failing test, run it, implement, rerun it.
- Commit after every task. Do not include the untracked root `.gitignore` in any commit unless a later user request explicitly asks for it.
- Never log, snapshot, print, or commit real user tokens.
- Treat `dc.hhhl.cc` API contracts as external contracts. Lock observed shapes into fixtures before building UI against them.
- The public first release ships complete functionality, but implementation proceeds through internal milestones.

## File Structure Map

Create this structure during implementation:

```text
chat/
  README.md
  package.json
  package-lock.json
  index.html
  eslint.config.js
  vite.config.ts
  vitest.setup.ts
  tsconfig.json
  tsconfig.node.json
  wrangler.toml
  playwright.config.ts
  public/
    _redirects
    telegram-open.svg
  scripts/
    fetch-contracts.mjs
    probe-runtime-contracts.mjs
    generate-startapp-link.mjs
    verify-workers-build.mjs
  src/
    App.vue
    App.test.ts
    main.ts
    router.ts
    env.d.ts
    styles/
      base.css
      telegram.css
      components.css
    shared/
      config.ts
      errors.ts
      logger.ts
      storage.ts
      time.ts
      types.ts
    telegram/
      startParam.ts
      telegram.ts
      telegram.test.ts
      startParam.test.ts
    i18n/
      index.ts
      locales.ts
      messages.en.ts
      messages.zh.ts
      i18n.test.ts
    api/
      apiClient.ts
      apiClient.test.ts
      endpointTypes.ts
      endpointContracts.ts
      contracts.test.ts
      __fixtures__/
        endpoint-contracts.json
        runtime-contracts.json
    auth/
      authStore.ts
      authStore.test.ts
      miauth.ts
      miauth.test.ts
      permissions.ts
      components/
        LoginGate.vue
        LoginGuide.vue
        TelegramOnly.vue
    rooms/
      roomApi.ts
      roomApi.test.ts
      roomStore.ts
      roomStore.test.ts
      roomMerge.ts
      roomMerge.test.ts
      components/
        RoomListView.vue
        RoomListItem.vue
        RoomDirectJoin.vue
        RoomInvitationList.vue
        RoomErrorState.vue
        RoomCreateDialog.vue
        RoomManagementPanel.vue
    chat/
      chatApi.ts
      chatApi.test.ts
      chatStore.ts
      chatStore.test.ts
      timelineMerge.ts
      timelineMerge.test.ts
      outgoingQueue.ts
      outgoingQueue.test.ts
      components/
        ChatRoomView.vue
        ChatHeader.vue
        MessageTimeline.vue
        MessageBubble.vue
        MessageComposer.vue
        MessageActions.vue
        ReplyPreview.vue
        ReactionPicker.vue
        SearchPanel.vue
        MembersPanel.vue
    files/
      fileApi.ts
      fileApi.test.ts
      uploadQueue.ts
      uploadQueue.test.ts
      components/
        FilePickerButton.vue
        FileUploadPreview.vue
        UploadProgressList.vue
    realtime/
      realtimeClient.ts
      realtimeClient.test.ts
      pollingFallback.ts
      pollingFallback.test.ts
      realtimeStore.ts
      realtimeStore.test.ts
    settings/
      settingsStore.ts
      settingsStore.test.ts
      components/
        SettingsView.vue
        DiagnosticsPanel.vue
    bot-tools/
      linkBuilder.ts
      linkBuilder.test.ts
      README.md
    test/
      factories.ts
      mockTelegram.ts
      server.ts
      handlers.ts
      render.ts
      workersPreview.test.ts
  tests/
    e2e/
      telegram-gate.spec.ts
      auth-flow.spec.ts
      room-deeplink.spec.ts
      chat-happy-path.spec.ts
      workers-routing.spec.ts
.github/
  workflows/
    chat-ci.yml
docs/
  superpowers/
    specs/2026-05-28-telegram-mini-app-chat-design.md
    plans/2026-05-28-telegram-mini-app-chat-implementation.md
```

## API Contract Notes

Endpoint metadata has already been observed through `POST /api/endpoint`. The implementation must commit a fixture with the final observed endpoint parameter metadata for the endpoints used by the app.

Known endpoint parameter shapes:

```json
{
  "chat/messages/create-to-room": ["text", "fileId", "toRoomId", "replyId", "quoteId"],
  "chat/messages/room-timeline": ["limit", "sinceId", "untilId", "roomId"],
  "chat/rooms/show": ["roomId"],
  "chat/rooms/join": ["roomId"],
  "chat/rooms/members": ["roomId", "limit", "sinceId", "untilId"],
  "chat/messages/search": ["query", "limit", "untilId", "userId", "roomId"],
  "chat/rooms/create": ["name", "description", "joinMode"],
  "drive/files/create": ["folderId", "name", "comment", "isSensitive", "force"],
  "miauth/gen-token": ["session", "name", "description", "iconUrl", "permission", "grantees", "rank"]
}
```

Runtime behavior is locked in a separate fixture before the UI depends on it. The runtime fixture starts with these default values and is updated only if the probe records a different non-secret response from `dc.hhhl.cc`:

```json
{
  "miauthCheckPathPattern": "/api/miauth/{session}/check",
  "streamingUrlPattern": "wss://dc.hhhl.cc/streaming?i={token}",
  "streamConnectMessage": {
    "type": "connect",
    "body": {
      "channel": "main",
      "id": "test-main",
      "params": {},
      "pong": true
    }
  },
  "streamChannelEnvelope": {
    "type": "ch",
    "body": {
      "id": "test-main",
      "type": "eventName",
      "body": {}
    }
  },
  "driveUploadEndpoint": "/api/drive/files/create"
}
```

---

### Task 1: Scaffold `chat/` Vue Application And Tooling

**Files:**
- Create: `chat/package.json`
- Create: `chat/index.html`
- Create: `chat/eslint.config.js`
- Create: `chat/vite.config.ts`
- Create: `chat/vitest.setup.ts`
- Create: `chat/tsconfig.json`
- Create: `chat/tsconfig.node.json`
- Create: `chat/src/env.d.ts`
- Create: `chat/src/main.ts`
- Create: `chat/src/App.vue`
- Create: `chat/src/App.test.ts`
- Create: `chat/src/router.ts`
- Create: `chat/src/styles/base.css`
- Create: `chat/src/styles/telegram.css`
- Create: `chat/src/styles/components.css`

- [ ] **Step 1: Create the package manifest**

Create `chat/package.json` with these scripts and dependencies:

```json
{
  "name": "hhhl-chat-miniapp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint . --ext .ts,.vue --max-warnings 0",
    "contracts": "node scripts/fetch-contracts.mjs",
    "link": "node scripts/generate-startapp-link.mjs",
    "verify:workers": "node scripts/verify-workers-build.mjs",
    "e2e": "playwright test",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@vueuse/core": "latest",
    "lucide-vue-next": "latest",
    "pinia": "latest",
    "vue": "latest",
    "vue-router": "latest"
  },
  "devDependencies": {
    "@eslint/js": "latest",
    "@cloudflare/workers-types": "latest",
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/vue": "latest",
    "@types/node": "latest",
    "typescript-eslint": "latest",
    "@vitejs/plugin-vue": "latest",
    "@vitest/coverage-v8": "latest",
    "eslint": "latest",
    "eslint-plugin-vue": "latest",
    "jsdom": "latest",
    "msw": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "vue-tsc": "latest",
    "wrangler": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
cd chat
npm install
```

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 3: Add Vite and TypeScript config**

Create `chat/vite.config.ts` with aliases and test config:

```ts
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
```

Create `chat/tsconfig.json` with strict TypeScript, `moduleResolution: "Bundler"`, `jsx: "preserve"`, `allowImportingTsExtensions: true`, and `types: ["vitest/globals"]`. Create `chat/tsconfig.node.json` for Vite config files. Create `chat/eslint.config.js` using flat config with `@eslint/js`, `typescript-eslint`, and `eslint-plugin-vue`.

- [ ] **Step 4: Add the minimal Vue shell**

Create `chat/index.html`, `chat/src/main.ts`, `chat/src/App.vue`, and `chat/src/router.ts` so `/` renders a basic shell with the text `HHHL Chat Mini App`.

- [ ] **Step 5: Add a smoke test**

Create `chat/src/App.test.ts`:

```ts
import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import App from './App.vue';

describe('App', () => {
  it('renders the chat mini app shell', () => {
    render(App);
    expect(screen.getByText('HHHL Chat Mini App')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Add base styles**

Create the three CSS files listed above. Import them from `main.ts` in this order: `base.css`, `telegram.css`, `components.css`.

- [ ] **Step 7: Verify scaffold**

Run:

```bash
cd chat
npm run typecheck
npm run test:run -- src/App.test.ts
npm run build
```

Expected: all commands pass and Vitest reports one passing test.

- [ ] **Step 8: Commit**

Run from repository root:

```bash
git add chat/package.json chat/package-lock.json chat/index.html chat/eslint.config.js chat/vite.config.ts chat/vitest.setup.ts chat/tsconfig.json chat/tsconfig.node.json chat/src
git commit -m "chore(chat): scaffold mini app"
```

### Task 2: Add Telegram Environment Adapter And Route Gate

**Files:**
- Create: `chat/src/telegram/telegram.ts`
- Create: `chat/src/telegram/startParam.ts`
- Create: `chat/src/telegram/telegram.test.ts`
- Create: `chat/src/telegram/startParam.test.ts`
- Create: `chat/src/auth/components/TelegramOnly.vue`
- Modify: `chat/src/App.vue`
- Modify: `chat/src/router.ts`
- Modify: `chat/src/test/mockTelegram.ts`

- [ ] **Step 1: Write start parameter tests**

Create `chat/src/telegram/startParam.test.ts` with tests for these cases:

```ts
import { describe, expect, it } from 'vitest';
import { parseStartParam } from './startParam';

describe('parseStartParam', () => {
  it('parses room deep links', () => {
    expect(parseStartParam('room_amlc1bekzi')).toEqual({ type: 'room', roomId: 'amlc1bekzi' });
  });

  it('returns none for empty params', () => {
    expect(parseStartParam('')).toEqual({ type: 'none' });
    expect(parseStartParam(undefined)).toEqual({ type: 'none' });
  });

  it('returns invalid for malformed params', () => {
    expect(parseStartParam('room_')).toEqual({ type: 'invalid', raw: 'room_' });
    expect(parseStartParam('unknown')).toEqual({ type: 'invalid', raw: 'unknown' });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd chat
npm run test:run -- src/telegram/startParam.test.ts
```

Expected: fails because `parseStartParam` does not exist.

- [ ] **Step 3: Implement start parameter parsing**

Create `chat/src/telegram/startParam.ts` with a discriminated union and a parser that accepts only `room_<non-empty-id>`.

- [ ] **Step 4: Write Telegram adapter tests**

Create tests that cover:

- `isTelegramEnvironment()` returns false when `window.Telegram?.WebApp` is absent.
- `getTelegramLaunchContext()` returns `startParam`, `themeParams`, and `platform` from a mocked WebApp.
- `openExternalLink()` uses `Telegram.WebApp.openLink` when present and falls back to `window.open` only in tests.

- [ ] **Step 5: Implement Telegram adapter**

Create `chat/src/telegram/telegram.ts`. Define `TelegramWebApp`, `TelegramLaunchContext`, `isTelegramEnvironment`, `getTelegramLaunchContext`, `readyTelegram`, `expandTelegram`, `openExternalLink`, and safe wrappers for BackButton and MainButton.

- [ ] **Step 6: Add the Telegram-only prompt**

Create `TelegramOnly.vue` with Chinese and English text keys. It must show a short message and no auth or chat UI.

- [ ] **Step 7: Gate App rendering**

Modify `App.vue` so non-Telegram environments render `TelegramOnly.vue`, while Telegram environments render the router view.

- [ ] **Step 8: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/telegram
npm run typecheck
npm run build
```

Expected: all pass.

Commit:

```bash
git add chat/src/telegram chat/src/auth/components/TelegramOnly.vue chat/src/App.vue chat/src/router.ts chat/src/test/mockTelegram.ts
git commit -m "feat(chat): add telegram environment gate"
```

### Task 3: Lock External API Contracts Into Fixtures

**Files:**
- Create: `chat/scripts/fetch-contracts.mjs`
- Create: `chat/scripts/probe-runtime-contracts.mjs`
- Create: `chat/src/api/__fixtures__/endpoint-contracts.json`
- Create: `chat/src/api/__fixtures__/runtime-contracts.json`
- Create: `chat/src/api/endpointContracts.ts`
- Create: `chat/src/api/contracts.test.ts`
- Modify: `chat/README.md`

- [ ] **Step 1: Write contract fixture tests**

Create `contracts.test.ts` that asserts the endpoint fixture contains all endpoint names used by the app and that required params match the known shapes listed in this plan. Also assert the runtime fixture contains `miauthCheckPathPattern`, `streamingUrlPattern`, `streamConnectMessage`, `streamChannelEnvelope`, and `driveUploadEndpoint`.

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd chat
npm run test:run -- src/api/contracts.test.ts
```

Expected: fails because the fixtures and loader do not exist.

- [ ] **Step 3: Add the contract fetch script**

Create `scripts/fetch-contracts.mjs`. It must:

- call `POST https://dc.hhhl.cc/api/endpoint` for each endpoint used by the app
- write sorted JSON to `src/api/__fixtures__/endpoint-contracts.json`
- print endpoint names only, not token or user data
- exit non-zero if a required endpoint returns a non-200 response

Use this required endpoint list in the script:

```js
const requiredEndpoints = [
  'i',
  'miauth/gen-token',
  'chat/history',
  'chat/rooms/create',
  'chat/rooms/delete',
  'chat/rooms/invitations/create',
  'chat/rooms/invitations/ignore',
  'chat/rooms/invitations/inbox',
  'chat/rooms/invitations/outbox',
  'chat/rooms/join',
  'chat/rooms/joining',
  'chat/rooms/leave',
  'chat/rooms/members',
  'chat/rooms/mute',
  'chat/rooms/owned',
  'chat/rooms/show',
  'chat/rooms/update',
  'chat/messages/context',
  'chat/messages/create-to-room',
  'chat/messages/delete',
  'chat/messages/react',
  'chat/messages/room-timeline',
  'chat/messages/search',
  'chat/messages/show',
  'chat/messages/unreact',
  'drive/files/create',
];
```

- [ ] **Step 4: Run contract fetch**

Run:

```bash
cd chat
npm run contracts
```

Expected: `src/api/__fixtures__/endpoint-contracts.json` is written and contains all required endpoints.

- [ ] **Step 5: Add the runtime contract probe script**

Create `scripts/probe-runtime-contracts.mjs`. It must write `src/api/__fixtures__/runtime-contracts.json` with the default runtime contract shown in the API Contract Notes. The script may probe public, non-authenticated routes only. It must not request, read, or print user tokens. It must include this exact default object when no safe public probe can verify a more specific value:

```js
const runtimeContracts = {
  miauthCheckPathPattern: '/api/miauth/{session}/check',
  streamingUrlPattern: 'wss://dc.hhhl.cc/streaming?i={token}',
  streamConnectMessage: {
    type: 'connect',
    body: {
      channel: 'main',
      id: 'test-main',
      params: {},
      pong: true,
    },
  },
  streamChannelEnvelope: {
    type: 'ch',
    body: {
      id: 'test-main',
      type: 'eventName',
      body: {},
    },
  },
  driveUploadEndpoint: '/api/drive/files/create',
};
```

- [ ] **Step 6: Run runtime contract probe**

Run:

```bash
cd chat
node scripts/probe-runtime-contracts.mjs
```

Expected: `src/api/__fixtures__/runtime-contracts.json` is written and contains no token values.

- [ ] **Step 7: Implement fixture loader**

Create `endpointContracts.ts` that imports both JSON fixtures and exports `getEndpointContract(endpoint)`, `assertEndpointHasParams(endpoint, params)`, and `getRuntimeContracts()` for tests and diagnostics.

- [ ] **Step 8: Document live probes**

Create or update `chat/README.md` with a section named `External Contract Verification` explaining how to run `npm run contracts` and `node scripts/probe-runtime-contracts.mjs`, and that neither command requires a user token.

- [ ] **Step 9: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/api/contracts.test.ts
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/scripts/fetch-contracts.mjs chat/scripts/probe-runtime-contracts.mjs chat/src/api chat/README.md
git commit -m "test(chat): lock dc api endpoint contracts"
```

### Task 4: Add Shared Types, Errors, Storage, And Logging

**Files:**
- Create: `chat/src/shared/types.ts`
- Create: `chat/src/shared/errors.ts`
- Create: `chat/src/shared/storage.ts`
- Create: `chat/src/shared/logger.ts`
- Create: `chat/src/shared/config.ts`
- Create: `chat/src/shared/time.ts`
- Create: `chat/src/shared/storage.test.ts`
- Create: `chat/src/shared/errors.test.ts`

- [ ] **Step 1: Write storage tests**

Cover token save/load/clear, JSON parse failures, and storage-unavailable fallback using an in-memory storage shim.

- [ ] **Step 2: Write error tests**

Cover `ApiError`, `AuthError`, `NetworkError`, `StorageError`, and `redactSensitiveText`. Assert that strings containing `i=secret-token`, `token=secret-token`, or JSON field `"i":"secret-token"` are redacted.

- [ ] **Step 3: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/shared
```

Expected: fails because modules do not exist.

- [ ] **Step 4: Implement shared modules**

Define domain types for `UserSummary`, `RoomSummary`, `ChatMessage`, `DriveFile`, `ApiEndpoint`, and pagination params. Implement `createLocalStorageAdapter`, `safeJsonParse`, `redactSensitiveText`, and `createLogger`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/shared
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/shared
git commit -m "feat(chat): add shared foundations"
```

### Task 5: Implement API Client And Domain Endpoint Wrappers

**Files:**
- Create: `chat/src/api/apiClient.ts`
- Create: `chat/src/api/apiClient.test.ts`
- Create: `chat/src/api/endpointTypes.ts`
- Create: `chat/src/rooms/roomApi.ts`
- Create: `chat/src/rooms/roomApi.test.ts`
- Create: `chat/src/chat/chatApi.ts`
- Create: `chat/src/chat/chatApi.test.ts`
- Create: `chat/src/files/fileApi.ts`
- Create: `chat/src/files/fileApi.test.ts`
- Create: `chat/src/test/server.ts`
- Create: `chat/src/test/handlers.ts`

- [ ] **Step 1: Write API client tests**

Test that `callEndpoint('chat/rooms/show', { roomId: 'abc' })` posts to `https://dc.hhhl.cc/api/chat/rooms/show`, includes token as `i`, applies timeout, parses JSON, maps non-200 responses to `ApiError`, and redacts tokens from thrown error messages.

- [ ] **Step 2: Write domain wrapper tests**

For room, chat, and file wrappers, assert exact endpoint names and request payload shapes. For upload, assert `FormData` includes `i`, `force=true`, `file`, and `name`.

- [ ] **Step 3: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/api src/rooms/roomApi.test.ts src/chat/chatApi.test.ts src/files/fileApi.test.ts
```

Expected: fails because API modules do not exist.

- [ ] **Step 4: Implement API client**

Implement `ApiClient` with constructor options `{ baseUrl, tokenProvider, fetchImpl, timeoutMs }`. Use JSON POST for normal endpoints and `XMLHttpRequest` or `fetch` with `FormData` for `drive/files/create` so upload progress can be reported by `fileApi`.

- [ ] **Step 5: Implement endpoint wrappers**

Implement room functions for joining, owned, invitations, show, join, leave, create, update, delete, mute, members. Implement chat functions for timeline, create-to-room, delete, react, unreact, search, show, context. Implement file upload wrapper for `drive/files/create`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/api src/rooms/roomApi.test.ts src/chat/chatApi.test.ts src/files/fileApi.test.ts
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/api chat/src/rooms/roomApi.ts chat/src/rooms/roomApi.test.ts chat/src/chat/chatApi.ts chat/src/chat/chatApi.test.ts chat/src/files/fileApi.ts chat/src/files/fileApi.test.ts chat/src/test
git commit -m "feat(chat): add dc api client"
```

### Task 6: Implement I18n And Telegram Theme Integration

**Files:**
- Create: `chat/src/i18n/index.ts`
- Create: `chat/src/i18n/locales.ts`
- Create: `chat/src/i18n/messages.en.ts`
- Create: `chat/src/i18n/messages.zh.ts`
- Create: `chat/src/i18n/i18n.test.ts`
- Modify: `chat/src/main.ts`
- Modify: `chat/src/styles/telegram.css`

- [ ] **Step 1: Write locale selection tests**

Cover Telegram language priority, browser language fallback, stored preference override, and Chinese/English fallbacks.

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/i18n/i18n.test.ts
```

Expected: fails because i18n modules do not exist.

- [ ] **Step 3: Implement i18n module**

Export `createI18nState`, `t(key, params)`, `setLocale(locale)`, and message dictionaries for all visible UI states planned in this document.

- [ ] **Step 4: Apply Telegram theme variables**

Use Telegram theme params to set CSS variables such as `--tg-bg`, `--tg-text`, `--tg-hint`, `--tg-button`, and `--tg-button-text`. Use instance-inspired fallback colors when Telegram values are absent in tests.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/i18n
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/i18n chat/src/main.ts chat/src/styles/telegram.css
git commit -m "feat(chat): add i18n and telegram theme"
```

### Task 7: Implement MiAuth Login, Token Restore, And Logout

**Files:**
- Create: `chat/src/auth/permissions.ts`
- Create: `chat/src/auth/miauth.ts`
- Create: `chat/src/auth/miauth.test.ts`
- Create: `chat/src/auth/authStore.ts`
- Create: `chat/src/auth/authStore.test.ts`
- Create: `chat/src/auth/components/LoginGuide.vue`
- Create: `chat/src/auth/components/LoginGate.vue`
- Modify: `chat/src/router.ts`
- Modify: `chat/src/shared/config.ts`

- [ ] **Step 1: Write MiAuth URL tests**

Assert that the generated URL uses `https://dc.hhhl.cc/miauth/<session>`, includes `name`, `callback`, `permission`, and never includes a user token.

- [ ] **Step 2: Write auth store tests**

Cover these states: no token opens login guide, valid token enters authorized state, invalid token clears storage, logout clears token/user/drafts/recent room.

- [ ] **Step 3: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/auth
```

Expected: fails because auth modules do not exist.

- [ ] **Step 4: Implement permissions**

Create `permissions.ts` with this first-pass permission list:

```ts
export const HHHL_CHAT_PERMISSIONS = [
  'read:account',
  'write:account',
  'read:drive',
  'write:drive',
  'read:chat',
  'write:chat',
] as const;
```

Add a test asserting the MiAuth URL encodes exactly this permission array as a comma-separated `permission` query value. Do not add Telegram permissions.

- [ ] **Step 5: Implement MiAuth client**

Implement session generation with `crypto.randomUUID()`, callback route construction, auth URL creation, and token exchange. Read `miauthCheckPathPattern` from `getRuntimeContracts()` and call it by replacing `{session}` with the stored session ID. `completeMiAuth(session)` returns the token from the check response and rejects with `AuthError('MIAUTH_TOKEN_MISSING')` if the response has no token field.

- [ ] **Step 6: Implement auth store and components**

Use Pinia. `LoginGuide.vue` has actions for `Authorize with dc.hhhl.cc` and `Open dc.hhhl.cc to register or sign in`. `LoginGate.vue` coordinates restore, callback completion, and route rendering.

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/auth
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/auth chat/src/router.ts chat/src/shared/config.ts
git commit -m "feat(chat): add miauth login"
```

### Task 8: Implement Room List, Direct Join, Invitations, And Deep Link Preservation

**Files:**
- Create: `chat/src/rooms/roomMerge.ts`
- Create: `chat/src/rooms/roomMerge.test.ts`
- Create: `chat/src/rooms/roomStore.ts`
- Create: `chat/src/rooms/roomStore.test.ts`
- Create: `chat/src/rooms/components/RoomListView.vue`
- Create: `chat/src/rooms/components/RoomListItem.vue`
- Create: `chat/src/rooms/components/RoomDirectJoin.vue`
- Create: `chat/src/rooms/components/RoomInvitationList.vue`
- Create: `chat/src/rooms/components/RoomErrorState.vue`
- Modify: `chat/src/router.ts`

- [ ] **Step 1: Write room merge tests**

Test de-duplication by room ID across joined, owned, invitation, manual, and deep-linked sources. Assert source badges are preserved as a sorted list.

- [ ] **Step 2: Write room store tests**

Mock `roomApi` and assert load sequence, loading/error states, direct join success, direct join failure, invitation accept/ignore, and pending `startapp` target preservation through auth.

- [ ] **Step 3: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/rooms
```

Expected: fails because merge/store modules do not exist.

- [ ] **Step 4: Implement room merge and store**

Implement `loadRooms`, `joinRoomById`, `openDeepLinkedRoom`, `acceptInvitation`, `ignoreInvitation`, `leaveRoom`, and `clearRoomError`.

- [ ] **Step 5: Implement room views**

`RoomListView.vue` shows joined/owned/invited rooms, a direct room ID input, loading, empty state, and errors. It does not show global public discovery.

- [ ] **Step 6: Wire routes**

Add `/rooms`, `/rooms/:roomId`, and `/auth/callback` handling. If launch contains `room_<id>`, redirect to `/rooms/<id>` after auth succeeds.

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/rooms
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/rooms chat/src/router.ts
git commit -m "feat(chat): add room list and deep links"
```

### Task 9: Implement Chat Timeline, Composer, Pending Messages, Replies, Quotes, Deletion, And Reactions

**Files:**
- Create: `chat/src/chat/timelineMerge.ts`
- Create: `chat/src/chat/timelineMerge.test.ts`
- Create: `chat/src/chat/outgoingQueue.ts`
- Create: `chat/src/chat/outgoingQueue.test.ts`
- Create: `chat/src/chat/chatStore.ts`
- Create: `chat/src/chat/chatStore.test.ts`
- Create: `chat/src/chat/components/ChatRoomView.vue`
- Create: `chat/src/chat/components/ChatHeader.vue`
- Create: `chat/src/chat/components/MessageTimeline.vue`
- Create: `chat/src/chat/components/MessageBubble.vue`
- Create: `chat/src/chat/components/MessageComposer.vue`
- Create: `chat/src/chat/components/MessageActions.vue`
- Create: `chat/src/chat/components/ReplyPreview.vue`
- Create: `chat/src/chat/components/ReactionPicker.vue`

- [ ] **Step 1: Write timeline merge tests**

Cover initial load, prepend older messages, append new messages, duplicate server IDs, replacement of pending local IDs with server IDs, and stable chronological order.

- [ ] **Step 2: Write outgoing queue tests**

Cover pending, sent, failed, retry, remove failed, reply ID, quote ID, and file ID payloads.

- [ ] **Step 3: Write chat store tests**

Mock `chatApi` and assert timeline load, send success, send failure, retry, delete optimistic rollback, reaction optimistic rollback, reply selection, quote selection, and room switch cleanup.

- [ ] **Step 4: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/chat
```

Expected: fails because chat modules do not exist.

- [ ] **Step 5: Implement timeline and outgoing queue**

Use pure functions for merge and queue state so they are easy to test without Vue.

- [ ] **Step 6: Implement chat store**

Add actions `loadInitial`, `loadOlder`, `sendText`, `retryMessage`, `deleteMessage`, `react`, `unreact`, `setReplyTarget`, `setQuoteTarget`, and `clearComposerContext`.

- [ ] **Step 7: Implement chat UI components**

Use a Telegram-like layout with fixed header, scrollable timeline, and bottom composer. Ensure long text wraps and toolbar buttons use `lucide-vue-next` icons with accessible labels.

- [ ] **Step 8: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/chat
npm run typecheck
npm run build
```

Expected: all pass.

Commit:

```bash
git add chat/src/chat
git commit -m "feat(chat): add message timeline and composer"
```

### Task 10: Implement Realtime Streaming And Polling Fallback

**Files:**
- Create: `chat/src/realtime/realtimeClient.ts`
- Create: `chat/src/realtime/realtimeClient.test.ts`
- Create: `chat/src/realtime/pollingFallback.ts`
- Create: `chat/src/realtime/pollingFallback.test.ts`
- Create: `chat/src/realtime/realtimeStore.ts`
- Create: `chat/src/realtime/realtimeStore.test.ts`
- Modify: `chat/src/chat/chatStore.ts`
- Modify: `chat/src/chat/components/ChatHeader.vue`

- [ ] **Step 1: Write realtime client tests**

Use a fake WebSocket class. Assert the URL is built from `getRuntimeContracts().streamingUrlPattern`, assert connect/disconnect messages match `streamConnectMessage`, assert channel event envelopes match `streamChannelEnvelope`, assert event payloads are normalized, and assert token is never emitted in logs.

- [ ] **Step 2: Write polling tests**

Assert polling calls `room-timeline` with `sinceId`, stops on WebSocket recovery, backs off after errors, and emits degraded status after repeated WebSocket failures.

- [ ] **Step 3: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/realtime src/chat/chatStore.test.ts
```

Expected: fails because realtime modules do not exist.

- [ ] **Step 4: Implement realtime client**

Implement `connect`, `subscribeRoom(roomId)`, `unsubscribeRoom(roomId)`, `onEvent`, and `disconnect`. Use `streamConnectMessage.body.channel` from `getRuntimeContracts()` as the channel. The initial contract uses `main`; filter normalized events by `roomId` when the event body contains a room ID, and ignore unrelated chat events.

- [ ] **Step 5: Implement polling fallback**

Use a configurable interval, default 5000 ms when degraded. Track `lastSeenId` per room and call `chat/messages/room-timeline` with `sinceId`.

- [ ] **Step 6: Connect realtime to chat store**

When a room opens, start realtime. On new messages, append through `timelineMerge`. On delete/reaction events, update local state. On close, unsubscribe and stop polling.

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/realtime src/chat
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/realtime chat/src/chat
git commit -m "feat(chat): add realtime with polling fallback"
```

### Task 11: Implement File And Image Upload Sending

**Files:**
- Create: `chat/src/files/uploadQueue.ts`
- Create: `chat/src/files/uploadQueue.test.ts`
- Create: `chat/src/files/components/FilePickerButton.vue`
- Create: `chat/src/files/components/FileUploadPreview.vue`
- Create: `chat/src/files/components/UploadProgressList.vue`
- Modify: `chat/src/files/fileApi.ts`
- Modify: `chat/src/chat/components/MessageComposer.vue`
- Modify: `chat/src/chat/chatStore.ts`

- [ ] **Step 1: Write upload queue tests**

Cover file validation, queue add/remove, progress updates, upload success returning `fileId`, upload failure retry, and send failure after successful upload preserving `fileId` for retry.

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/files src/chat/chatStore.test.ts
```

Expected: fails because upload queue and UI do not exist.

- [ ] **Step 3: Implement upload queue and progress**

Support selected files and pasted images. Validate size against `MAX_UPLOAD_BYTES = 25 * 1024 * 1024` in `files/uploadQueue.ts`; this plan uses the observed 25 MB instance policy as the fixed client-side limit.

- [ ] **Step 4: Wire upload to composer**

Add an icon button for file selection, previews for queued files, upload progress, and a send action that uploads first and then calls `chat/messages/create-to-room` with `fileId`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/files src/chat
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/files chat/src/chat
git commit -m "feat(chat): add file upload sending"
```

### Task 12: Implement Search, Members, Room Creation, Invitations, And Management

**Files:**
- Create: `chat/src/chat/components/SearchPanel.vue`
- Create: `chat/src/chat/components/MembersPanel.vue`
- Create: `chat/src/rooms/components/RoomCreateDialog.vue`
- Create: `chat/src/rooms/components/RoomManagementPanel.vue`
- Modify: `chat/src/rooms/roomStore.ts`
- Modify: `chat/src/rooms/roomStore.test.ts`
- Modify: `chat/src/chat/chatStore.ts`
- Modify: `chat/src/chat/chatStore.test.ts`
- Modify: `chat/src/router.ts`

- [ ] **Step 1: Write management tests**

Cover room create, update, delete, invite create, invitation outbox load, members pagination, message search, and API permission failure states.

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/rooms src/chat
```

Expected: tests fail until management actions and panels exist.

- [ ] **Step 3: Implement search panel**

Use `chat/messages/search` with `query`, `limit`, optional `untilId`, optional `userId`, and `roomId`. Show result count, loading, empty, and error states.

- [ ] **Step 4: Implement members panel**

Use `chat/rooms/members`. Support pagination and member display using avatar, username, and display name when returned.

- [ ] **Step 5: Implement room creation and management**

Create room dialog with `name`, `description`, and `joinMode`. Management panel supports update, delete, leave, mute, invitations, and permission-denied UI when API rejects an action.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/rooms src/chat
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/rooms chat/src/chat
git commit -m "feat(chat): add search members and room management"
```

### Task 13: Implement Settings, Logout, Diagnostics, And Local Data Clearing

**Files:**
- Create: `chat/src/settings/settingsStore.ts`
- Create: `chat/src/settings/settingsStore.test.ts`
- Create: `chat/src/settings/components/SettingsView.vue`
- Create: `chat/src/settings/components/DiagnosticsPanel.vue`
- Modify: `chat/src/router.ts`
- Modify: `chat/src/auth/authStore.ts`
- Modify: `chat/src/rooms/roomStore.ts`
- Modify: `chat/src/chat/chatStore.ts`

- [ ] **Step 1: Write settings tests**

Cover language preference, debug panel closed by default, diagnostics redaction, logout clearing token/user/drafts/recent room, and route back to login after logout.

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/settings src/auth src/rooms src/chat
```

Expected: fails until settings store and logout integration exist.

- [ ] **Step 3: Implement settings store and view**

Settings includes language selector, current instance URL, realtime status, storage status, and logout button. Diagnostics panel redacts all token-like strings.

- [ ] **Step 4: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/settings src/auth src/rooms src/chat
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add chat/src/settings chat/src/auth chat/src/rooms chat/src/chat chat/src/router.ts
git commit -m "feat(chat): add settings and logout"
```

### Task 14: Add Bot Link Tools And Documentation

**Files:**
- Create: `chat/src/bot-tools/linkBuilder.ts`
- Create: `chat/src/bot-tools/linkBuilder.test.ts`
- Create: `chat/src/bot-tools/README.md`
- Create: `chat/scripts/generate-startapp-link.mjs`
- Modify: `chat/README.md`

- [ ] **Step 1: Write link builder tests**

Assert `buildStartAppLink('mybot', 'amlc1bekzi')` returns `https://t.me/mybot?startapp=room_amlc1bekzi`, rejects bot usernames with `@`, rejects empty room IDs, and never accepts token-like values.

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd chat
npm run test:run -- src/bot-tools
```

Expected: fails until link builder exists.

- [ ] **Step 3: Implement link builder and CLI script**

The script accepts `--bot <username>` and `--room <roomId>`, prints only the generated URL, and exits non-zero for invalid input.

- [ ] **Step 4: Write BotFather documentation**

Document menu button URL setup, group button/link format, `startapp=room_<roomId>`, and reminder that BotFather URL must be updated when moving from `*.workers.dev` to a custom domain.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/bot-tools
node scripts/generate-startapp-link.mjs --bot mybot --room amlc1bekzi
```

Expected: command prints `https://t.me/mybot?startapp=room_amlc1bekzi`.

Commit:

```bash
git add chat/src/bot-tools chat/scripts/generate-startapp-link.mjs chat/README.md
git commit -m "docs(chat): add telegram bot link tools"
```

### Task 15: Add Cloudflare Workers Deployment And GitHub Actions

**Files:**
- Create: `chat/wrangler.toml`
- Create: `chat/public/_redirects`
- Create: `chat/scripts/verify-workers-build.mjs`
- Create: `chat/src/test/workersPreview.test.ts`
- Create: `.github/workflows/chat-ci.yml`
- Modify: `chat/README.md`

- [ ] **Step 1: Write Workers build verification test**

Create `workersPreview.test.ts` that asserts the production output has `dist/index.html` and that known app routes are expected to fall back to the app shell in preview verification.

- [ ] **Step 2: Add Wrangler config**

Create `chat/wrangler.toml` for static assets. Use `dist` as assets directory and set `compatibility_date = "2026-05-28"`.

- [ ] **Step 3: Add SPA fallback**

Add `chat/public/_redirects` with a rule that serves `/index.html` for app routes.

- [ ] **Step 4: Add verification script**

`verify-workers-build.mjs` runs after `npm run build`, verifies `dist/index.html`, verifies static assets exist, and fails if output contains a raw token-like string such as `secret-token` from tests.

- [ ] **Step 5: Add GitHub Actions workflow**

Create `.github/workflows/chat-ci.yml` with jobs:

- checkout
- setup Node
- `cd chat && npm ci`
- `npm run test:run`
- `npm run typecheck`
- `npm run build`
- `npm run verify:workers`
- deploy only when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are available and the branch is the chosen deployment branch

- [ ] **Step 6: Document manual deployment**

Add README commands:

```bash
cd chat
npm ci
npm run build
npm run verify:workers
npm run deploy
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd chat
npm run test:run -- src/test/workersPreview.test.ts
npm run build
npm run verify:workers
```

Expected: all pass.

Commit:

```bash
git add chat/wrangler.toml chat/public/_redirects chat/scripts/verify-workers-build.mjs chat/src/test/workersPreview.test.ts .github/workflows/chat-ci.yml chat/README.md
git commit -m "ci(chat): add workers deployment"
```

### Task 16: Add E2E Tests For Telegram Gate, Auth, Deep Links, Chat, And Workers Routing

**Files:**
- Create: `chat/playwright.config.ts`
- Create: `chat/tests/e2e/telegram-gate.spec.ts`
- Create: `chat/tests/e2e/auth-flow.spec.ts`
- Create: `chat/tests/e2e/room-deeplink.spec.ts`
- Create: `chat/tests/e2e/chat-happy-path.spec.ts`
- Create: `chat/tests/e2e/workers-routing.spec.ts`
- Modify: `chat/src/test/mockTelegram.ts`
- Modify: `chat/src/test/handlers.ts`

- [ ] **Step 1: Write Telegram gate E2E**

Assert normal browser without Telegram mock shows the Telegram-only prompt and does not render auth or chat UI.

- [ ] **Step 2: Write auth flow E2E**

Mock Telegram WebApp and API. Assert login guide appears, MiAuth URL is opened, callback stores token, and rooms load.

- [ ] **Step 3: Write deep link E2E**

Mock `startapp=room_amlc1bekzi`. Assert the target room is preserved through auth and opens after token restore.

- [ ] **Step 4: Write chat happy path E2E**

Assert room opens, messages load, text send creates a pending row, server response replaces pending, reaction works, delete works, search opens, members panel opens, file upload preview appears.

- [ ] **Step 5: Write Workers routing E2E**

Run against built preview. Assert `/rooms/amlc1bekzi`, `/auth/callback`, and `/settings` all serve the app shell.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd chat
npx playwright install --with-deps chromium
npm run e2e
npm run build
```

Expected: all pass.

Commit:

```bash
git add chat/playwright.config.ts chat/tests chat/src/test
git commit -m "test(chat): add e2e coverage"
```

### Task 17: Final Hardening, Accessibility, And Release Checklist

**Files:**
- Modify: `chat/README.md`
- Modify: `chat/src/styles/base.css`
- Modify: `chat/src/styles/components.css`
- Modify: UI components under `chat/src/**/components/*.vue`
- Create: `chat/docs/release-checklist.md`

- [ ] **Step 1: Add release checklist**

Create `chat/docs/release-checklist.md` with checks for BotFather URL, Workers URL, MiAuth callback, token clearing, Telegram mobile, Telegram desktop, WebSocket fallback, file upload, room management, and language switching.

- [ ] **Step 2: Run full verification**

Run:

```bash
cd chat
npm run test:run
npm run typecheck
npm run build
npm run verify:workers
npm run e2e
```

Expected: all pass.

- [ ] **Step 3: Do manual UI checks**

Open the local preview in desktop browser with Telegram mocked for layout inspection. Check 375 px width, 768 px tablet width, and desktop width. Confirm no text overlaps, composer remains fixed, room list does not shift, long messages wrap, and buttons remain tappable.

- [ ] **Step 4: Fix only release-blocking issues**

Limit changes to accessibility labels, responsive sizing, overflow, and missing status messages found in Step 3. Do not add new product scope.

- [ ] **Step 5: Rerun full verification**

Run the same commands from Step 2.

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add chat
git commit -m "chore(chat): harden release readiness"
```

---

## Final Verification Commands

Before declaring implementation complete, run:

```bash
cd chat
npm ci
npm run contracts
npm run test:run
npm run typecheck
npm run build
npm run verify:workers
npm run e2e
```

Expected: every command exits with code 0. If `npm run contracts` fails because `dc.hhhl.cc` is temporarily unavailable, record the failure and rerun before deployment.

## Spec Coverage Matrix

- Pure frontend and no backend: Tasks 1, 5, 15.
- `chat/` subdirectory application: all tasks create app files under `chat/` except GitHub Actions.
- Telegram-only environment: Task 2 and Task 16.
- MiAuth login and local token storage: Task 7 and Task 13.
- dc.hhhl.cc API client: Tasks 3 and 5.
- Room list, direct join, invitations, deep links: Task 8.
- Full chat functions: Tasks 9, 11, 12.
- WebSocket with polling fallback: Task 10.
- File/image sending: Task 11.
- i18n Chinese/English: Task 6.
- Bot menu and group link support: Task 14.
- GitHub and direct Cloudflare Workers deployment: Task 15.
- Tests and Telegram acceptance coverage: Tasks 16 and 17.
