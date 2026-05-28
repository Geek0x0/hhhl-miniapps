# Telegram Mini App Chat Client Design

## Context

Build a Telegram Mini App that connects to the existing `dc.hhhl.cc` chat-room feature. The app is a pure frontend client deployed on Cloudflare Workers/Pages, initially under a `*.workers.dev` URL. It does not include a custom backend and does not use Telegram identity for product login, because `dc.hhhl.cc` does not support Telegram login.

Users authenticate with `dc.hhhl.cc` through MiAuth. The Mini App stores the resulting user token locally by default and provides a settings action to log out and clear local credentials. Telegram is used only as the Mini App container and launch surface.

The local project directory is currently empty and not a git repository. The design assumes a new frontend project will be created here after approval.

## Goals

- Provide a complete Telegram Mini App client for `dc.hhhl.cc` chat rooms.
- Support full first-release chat functionality: room list, join, create, manage, invitations, members, text messages, replies, quotes, reactions, deletion, search, and file/image sending.
- Use a pure frontend architecture with no private backend service.
- Deploy as static frontend assets through Cloudflare Workers/Pages.
- Support Telegram Bot menu entry and group links/buttons.
- Support `startapp=room_<roomId>` deep links, falling back to the room list when no target is provided.
- Support Chinese and English initially, with an extensible i18n structure.
- Prefer WebSocket streaming for realtime updates and fall back to polling when streaming is unavailable.

## Non-Goals

- Do not implement Telegram identity login or Telegram account to `dc.hhhl.cc` account mapping.
- Do not build a custom backend, token proxy, push relay, or server-side credential store.
- Do not provide a full browser web client. Non-Telegram browser access shows a prompt to open in Telegram.
- Do not implement global public room discovery unless `dc.hhhl.cc` exposes a verified API later. The first release only uses joined, owned, invited, manually entered, or deep-linked rooms.
- Do not handle `dc.hhhl.cc` registration inside the Mini App. Users without an account are directed to `dc.hhhl.cc`.

## Confirmed API Surface

The `dc.hhhl.cc` API console exposes endpoint metadata through public API-console endpoints:

- `POST https://dc.hhhl.cc/api/endpoints`
- `POST https://dc.hhhl.cc/api/endpoint`

Relevant chat endpoints found during discovery include:

- `chat/history`
- `chat/rooms/create`
- `chat/rooms/delete`
- `chat/rooms/invitations/create`
- `chat/rooms/invitations/ignore`
- `chat/rooms/invitations/inbox`
- `chat/rooms/invitations/outbox`
- `chat/rooms/join`
- `chat/rooms/joining`
- `chat/rooms/leave`
- `chat/rooms/members`
- `chat/rooms/mute`
- `chat/rooms/owned`
- `chat/rooms/show`
- `chat/rooms/update`
- `chat/messages/context`
- `chat/messages/create-to-room`
- `chat/messages/delete`
- `chat/messages/react`
- `chat/messages/room-timeline`
- `chat/messages/search`
- `chat/messages/show`
- `chat/messages/unreact`

Observed endpoint parameters include:

- `chat/messages/create-to-room`: `text`, `fileId`, `toRoomId`, `replyId`, `quoteId`
- `chat/messages/room-timeline`: `limit`, `sinceId`, `untilId`, `roomId`
- `chat/rooms/show`: `roomId`
- `chat/rooms/join`: `roomId`
- `chat/rooms/members`: `roomId`, `limit`, `sinceId`, `untilId`
- `chat/messages/search`: `query`, `limit`, `untilId`, `userId`, `roomId`
- `chat/rooms/create`: `name`, `description`, `joinMode`

Cross-origin preflight for `https://dc.hhhl.cc/api/chat/rooms/joining` returned `Access-Control-Allow-Origin: *`, so direct browser calls from a Workers-hosted frontend are viable under the observed current configuration.

## Architecture

The application is a pure frontend, module-lazy-loaded Telegram Mini App.

### Telegram Shell

The Telegram shell owns all access to `window.Telegram.WebApp` and provides a small internal adapter for:

- Telegram environment detection
- `startapp` parameter parsing
- theme colors and safe-area handling
- BackButton and MainButton integration
- Telegram-native popup/open-link helpers
- lightweight haptic feedback where available

If `window.Telegram.WebApp` is unavailable, the app renders only a non-Telegram environment screen with an instruction to open the app inside Telegram.

### Authentication

Authentication uses MiAuth against `dc.hhhl.cc`.

The auth state machine supports:

- anonymous
- authorizing
- authorized
- token invalid
- logout complete

On launch, the app loads a locally stored token and validates it with an account endpoint such as `i`. If validation fails, it clears local auth state and returns to the authorization screen.

MiAuth requests the full permission set needed by the complete first release up front. This avoids repeated authorization prompts when users later access file upload, room management, or invitations.

Users without a `dc.hhhl.cc` account see a short explanation and an action to open `dc.hhhl.cc` for registration or login. Registration itself is not implemented in the Mini App.

### API Layer

All `dc.hhhl.cc` API calls go through one API layer:

```ts
callEndpoint<TResponse>(endpoint: string, params?: Record<string, unknown>): Promise<TResponse>
```

The API layer is responsible for:

- attaching the local user token in the format expected by `dc.hhhl.cc`
- normalizing endpoint errors into typed frontend errors
- applying request timeouts
- retrying only idempotent or explicitly safe reads
- avoiding token leakage in logs and UI errors
- exposing small domain wrappers for chat, rooms, files, and users

No frontend module outside the API layer directly calls `fetch` for `dc.hhhl.cc` endpoints.

### Rooms

The room layer builds the room list from verified sources:

- joined rooms through `chat/rooms/joining`
- owned rooms through `chat/rooms/owned`
- invitations through `chat/rooms/invitations/inbox`
- direct room IDs typed by the user
- direct room IDs from `startapp=room_<roomId>`

The app does not attempt global room discovery in the first release.

When a deep link targets a room, the app preserves the room target through authentication. After login, it calls `chat/rooms/show`; if the room is visible and joinable but the user has not joined, it calls `chat/rooms/join`; then it opens the room timeline. If any step fails, it shows a room-specific error and a path back to the room list.

### Chat

The chat layer supports:

- initial timeline loading through `chat/messages/room-timeline`
- incremental loading before and after the current timeline
- sending text messages through `chat/messages/create-to-room`
- sending replies and quotes through `replyId` and `quoteId`
- sending uploaded files by passing `fileId`
- deleting messages through `chat/messages/delete`
- reactions through `chat/messages/react` and `chat/messages/unreact`
- message search through `chat/messages/search`
- message context lookup through `chat/messages/context` where needed

Outgoing messages use a local pending state. On success, pending entries are reconciled with the server message ID. On failure, users can retry or remove the local pending entry. Destructive or reversible actions such as reactions and deletion may use optimistic UI, but failures must roll back to the last confirmed server state.

### Files

File and image sending uses `dc.hhhl.cc` Drive/file upload APIs. The upload flow is:

1. User selects or pastes a file.
2. The frontend validates size and supported type according to instance limits where available.
3. The file is uploaded to `dc.hhhl.cc` with the user token.
4. The returned `fileId` is sent through `chat/messages/create-to-room`.

The first release includes upload progress, retry, image preview, and a clear error state. It does not need a full Drive file manager UI.

### Realtime

Realtime uses the `dc.hhhl.cc` streaming WebSocket when available. The realtime layer owns:

- connection setup with token
- room or chat channel subscription
- reconnect attempts
- duplicate event suppression
- mapping stream events to chat-domain events
- fallback to polling after repeated failure

The fallback polls `chat/messages/room-timeline` using `sinceId` for incremental updates. When WebSocket connectivity recovers, polling stops.

The UI shows a lightweight status when degraded to polling, such as “实时连接受限，正在使用刷新模式”.

### Lazy Loading

The app is shipped as a Vite-built frontend with module lazy loading.

Initial bundle:

- Telegram shell
- auth state
- API base layer
- room list shell
- basic UI components

Loaded after entering a room:

- chat timeline
- realtime layer
- message composer

Loaded on demand:

- file upload
- search panel
- room management
- invitation flows
- member list details
- settings and debug information
- bot link tools
- non-current language bundles

This keeps the Telegram WebView startup path small while still delivering a complete first release.

## Module Boundaries

- `telegram/`: Telegram WebApp adapter and environment gate.
- `auth/`: MiAuth state machine, token validation, logout.
- `api/`: endpoint caller, token injection, error normalization, domain wrappers.
- `rooms/`: room list, joining, leaving, creation, update, invitations, members.
- `chat/`: timelines, composing, replies, quotes, deletion, reactions, search.
- `files/`: upload, progress, preview, file validation.
- `realtime/`: streaming, reconnect, fallback polling, event normalization.
- `i18n/`: locale detection, Chinese and English resources, extensible language loading.
- `settings/`: logout, token clearing, language switch, diagnostics.
- `bot-tools/`: BotFather instructions, menu setup notes, group-link formats, helper script.

State is split by domain, for example `authStore`, `roomStore`, `chatStore`, and `settingsStore`. The design avoids a single global catch-all store.

## UI Direction

The UI uses a mixed style:

- Telegram-like layout: room list, chat timeline, bottom composer, message bubbles, native-feeling controls.
- `dc.hhhl.cc`/Sharkey-like identity: colors, avatar treatment, terminology, and room/user metadata should feel aligned with the instance.

The product UI is available only in Telegram. Browser access renders the Telegram-open prompt.

## Telegram Bot Integration

The design includes Bot configuration documentation and a small helper script.

Supported entry paths:

- Bot menu button opens the Mini App for personal entry.
- Group messages or buttons link to the Mini App.
- Room deep links use `startapp=room_<roomId>`.

The helper script generates URLs in the form:

```text
https://t.me/<botUsername>?startapp=room_<roomId>
```

The script does not handle tokens or user secrets.

## Local Persistence

Local storage contains only necessary client state:

- `dc.hhhl.cc` user token
- current user summary
- most recent room ID
- draft messages
- language and UI preferences

The app does not cache long-term message history by default. This limits local privacy exposure and storage growth.

Logout clears token, user summary, drafts, recent room state, and relevant cached auth state.

## Error Handling

Errors are categorized by source:

- Telegram environment errors: show Telegram-open prompt or compatibility message.
- MiAuth errors: retry authorization, clear invalid token, or direct non-users to `dc.hhhl.cc`.
- API permission errors: hide, disable, or explain actions based on API results.
- Room errors: show missing, not visible, or not joinable states with a return-to-list action.
- Message errors: pending state, retry, remove, and optimistic rollback.
- Realtime errors: reconnect, then polling fallback, then visible degraded status.
- Upload errors: validate early, show progress, retry failed upload or failed send.
- Network/CORS errors: standardized timeout/retry messaging.
- Storage errors: explain that login cannot be remembered and continue where possible.

Security requirements:

- Never place token in URL query parameters.
- Never write token to logs, visible errors, generated links, or debug output.
- Clear short-lived MiAuth parameters after use.
- Keep diagnostics hidden unless the user explicitly opens them.

## Internationalization

Language selection priority:

1. Telegram user language if available.
2. Browser language.
3. Stored user preference.
4. Default fallback language.

Initial languages are Chinese and English. Language resources are structured so additional locales can be added without changing feature code.

## Testing Strategy

### Unit Tests

Cover:

- `startapp` parsing
- MiAuth state transitions
- API error normalization
- room list merge and de-duplication
- timeline merge and message de-duplication
- polling incremental update logic
- i18n language choice
- local token clearing

### Component Tests

Cover:

- Telegram-only prompt
- login guide
- room list
- room direct-entry error states
- chat timeline
- composer pending and failed states
- file upload states
- search panel
- members panel
- room management panel
- settings/logout

### Integration Tests

Use mocked `dc.hhhl.cc` APIs and mocked Telegram SDK to cover:

- successful MiAuth and token restore
- token invalidation and reauthorization
- room list loading from joined, owned, and invited sources
- `startapp=room_<roomId>` before and after login
- room join and room open
- sending text and file messages
- deleting and reacting with rollback on failure
- WebSocket failure and polling fallback
- logout and local data clearing

### Telegram Acceptance Tests

Verify on Telegram mobile and desktop:

- Bot menu opens the Mini App.
- Group link/button opens the Mini App.
- `startapp=room_<roomId>` reaches the intended room.
- MiAuth returns to the Mini App and persists login.
- Existing room list loads.
- Direct room ID join works.
- Text, reply, quote, reaction, deletion, search, members, and file/image sending work.
- WebSocket failure falls back to polling.
- Logout clears the local token.
- Chinese and English language selection works.

## Implementation Phasing

The first public release includes the complete feature set. Development should still be split into internal milestones to reduce risk:

1. Project shell, Telegram gate, i18n skeleton, and local settings.
2. MiAuth login, token validation, and logout.
3. Room list, direct room ID entry, and `startapp` deep link handling.
4. Chat timeline, text sending, replies, quotes, deletion, and reactions.
5. Realtime WebSocket and polling fallback.
6. File/image upload and send.
7. Search, members, room creation, invitations, and room management.
8. Bot configuration docs and link helper script.
9. Full test pass and Telegram device acceptance.

No partial milestone is considered the public first release; the release gate is the complete accepted feature set.

## Open Risks

- Exact MiAuth callback behavior inside Telegram WebView must be verified against `dc.hhhl.cc` during implementation.
- Exact streaming channel names and event payloads must be verified from the Sharkey/hhhl client or live API behavior.
- File upload endpoint shape must be confirmed before implementing the upload module.
- Cloudflare Workers static hosting must preserve HTTPS and routing needed for MiAuth return URLs and Telegram Mini App launch.
- Future CORS changes on `dc.hhhl.cc` could affect pure frontend direct API access.

These risks are known implementation risks, not unresolved product requirements.
