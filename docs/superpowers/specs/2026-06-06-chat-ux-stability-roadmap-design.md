# Chat UX and Stability Roadmap Design

## Context

The `chat/` Mini App is a Vue 3, Pinia, Vite, and Cloudflare Pages frontend for `dc.hhhl.cc` chat rooms. It already supports MiAuth, room lists, invitations, room creation, timelines, text and file sending, replies, quotes, reactions, deletion, message search, member panels, favorites, key search, settings sync, diagnostics, Telegram environment gating, WebSocket realtime, and polling fallback.

Recent releases focused on production hardening: Telegram iOS restore handling, diagnostics redaction, Drive-backed settings sync, media URL normalization, avatar fallback behavior, key-search filtering, and UI fixes around reactions, new-message prompts, and reply previews.

The next month should improve everyday chat usability and connection stability without expanding the backend surface.

## Goal

Create a one-month roadmap for user experience and stability improvements in `chat/`, organized as weekly milestones.

The roadmap should:

- close gaps in high-frequency chat flows
- reduce unnecessary realtime and polling work
- make weak-network and Telegram WebView restore behavior more predictable
- improve search, member, and favorite workflows
- end with focused performance checks and release validation

## Non-Goals

This roadmap does not:

- add or change `dc.hhhl.cc` API endpoints
- introduce a custom backend, proxy, push relay, or server-side token store
- sync draft text, diagnostics, logs, tokens, or temporary state to Drive
- cache long-term message history locally
- implement unread receipts, typing indicators, notifications, or server-backed message editing
- replace the timeline with a virtual list unless performance measurements prove it is needed as a separate follow-up project

## Constraints

All work should stay within the existing frontend architecture and API contracts.

The app must continue to keep tokens out of URLs, logs, diagnostics, generated links, and visible errors. Local-only state may include drafts and transient UI state, but message history should remain server-backed.

Changes should follow the current module boundaries:

- `chat/src/chat/` for timeline, composer, message state, search, and message UI
- `chat/src/realtime/` for WebSocket and polling behavior
- `chat/src/rooms/` for room management and member flows
- `chat/src/settings/` only when local settings or diagnostics are directly involved
- `chat/src/i18n/` for visible text in English and Chinese

## Recommended Approach

Use an experience-closure roadmap.

Start with the chat actions users perform every day, then stabilize network recovery and request scheduling, then improve search and organization, and finish with performance validation. This keeps each week independently useful while still addressing both user experience and stability.

The alternative stability-first approach would reduce network risk earlier but deliver fewer visible UX improvements. The efficiency-tool-first approach would improve search and organization faster but leave basic composer and recovery gaps in place longer.

## Roadmap

### Week 1: High-Frequency Chat Closure

Week 1 closes gaps in everyday chat actions.

#### Room-Scoped Composer Drafts

The app already clears the `hhhl-chat:drafts` storage key on logout and local-data clearing, but the composer does not currently save or restore drafts. Add local, room-scoped text drafts.

Expected behavior:

- save draft text by `roomId`
- restore the draft when entering a room
- preserve drafts across refreshes, room switches, and Telegram WebView restores
- clear a room draft after successful text send
- do not save files, uploaded file IDs, reply targets, quote targets, tokens, or diagnostics in the draft store
- do not sync drafts to Drive

The draft data flow should remain local:

`MessageComposer` text changes -> local draft storage keyed by room -> room entry restores text -> successful send clears that room key.

#### Reachable Room Management

`ChatRoomView` already renders `RoomManagementPanel` when `activePanel === 'manage'`, but the current header has no visible management entry. Add a reachable management action using the existing panel and room store actions.

The first version should not add a new permissions model. Existing API failures should continue to surface through `roomStore.error`.

#### Upload and Send Failure Closure

The upload queue model already supports queued, uploading, uploaded, and failed states, but the composer flow should distinguish the user-facing failure points more clearly.

Expected behavior:

- file validation failure is visible before send
- upload failure remains in the composer and can be retried or removed
- upload success followed by message-send failure creates a failed pending message in the timeline
- retrying a failed file message after upload reuses the uploaded `fileId` and does not require reselecting the file
- successful sends clear the related composer state

#### Consistent Confirmation for Destructive Actions

Use explicit confirmation for destructive or hard-to-reverse actions in mobile contexts:

- delete message
- leave room
- delete room

Confirmations should use localized text. They should not change the underlying optimistic rollback rules.

#### Week 1 Acceptance

- Drafts survive refresh, room switch, and returning to the room.
- Successful text send clears only that room draft.
- Failed send does not erase the user's intent.
- Room management is reachable from the room header or an equivalent room action.
- File-too-large, upload failure, and message-send failure are distinguishable.
- Destructive chat and room actions require confirmation.

### Week 2: Weak Network and Restore Stability

Week 2 reduces duplicate work and makes recovery predictable.

#### State-Driven Realtime and Polling

`ChatRoomView` currently starts realtime and also starts fixed newer-message polling. Replace this with connection-state-driven scheduling.

Expected behavior:

- when WebSocket is connected, rely on realtime events and do not run fixed 3-second timeline polling
- after repeated socket failures, enter degraded mode and start polling fallback
- when polling fallback succeeds, append only messages for the active room
- when a new realtime socket is established after degraded mode, stop fallback polling
- on room switch or unmount, stop WebSocket, polling timers, visibility listeners, and stale callbacks

#### Visibility Restore Catch-Up

The app already handles Telegram environment restore at the shell level. The chat room should add a room-level catch-up when the page returns to visible.

Expected behavior:

- on `visibilitychange` to visible, run one guarded `loadNewer()` for the active room
- do not run catch-up for an empty or stale `roomId`
- keep polling active only when the realtime store is degraded
- avoid surfacing normal short restore gaps as errors

#### Request Concurrency and Stale Result Protection

`chatStore.loadNewer()` already guards concurrent newer loads. Make this behavior part of the roadmap contract and cover room-switch cases.

Expected behavior:

- at most one newer-message request per active room at a time
- polling failure backs off and success resets the interval
- old room requests do not update the current room timeline after a room switch
- repeated fallback starts do not create duplicate timers

#### Week 2 Acceptance

- WebSocket-connected rooms no longer call `room-timeline` every 3 seconds.
- Consecutive socket failures start one polling fallback loop.
- Restoring from hidden to visible performs one catch-up request.
- Switching rooms prevents old room timers and stale responses from mutating the new room.
- The degraded header label appears only while polling fallback is active.

### Week 3: Search and Organization Efficiency

Week 3 improves existing search, member, favorite, and header workflows without requiring new APIs.

#### Search State Retention and Pagination

`chatStore.searchMessages()` supports explicit continuations through `untilId`, but `SearchPanel` does not expose loading more results. Add a clearer search continuation flow.

Expected behavior:

- search query, results, error, and loading state remain when closing and reopening the search panel within a room
- a load-more action appears when the current result set may have more pages
- load-more uses the last result ID as `untilId`
- normal search state stays isolated from key-search state
- jump-to-message failure keeps the panel open and shows the existing error path

#### Search Result Readability

Improve search results while keeping rendering safe.

Expected behavior:

- show clear empty-result copy
- highlight the matched query in text results using text nodes, not raw HTML
- preserve the existing sender, timestamp, text, file-name, and jump behavior
- use displayed message text after MFM-style wrapper stripping

#### Header and Panel Organization

The room header already contains search, key search, favorites, and members. Adding management may crowd mobile widths. Evaluate and, if needed, group lower-frequency actions under a more menu while keeping common actions easy to reach.

Recommended grouping:

- keep search and members directly visible
- place favorites, key search, and manage under more actions if the header cannot fit reliably
- keep all actions keyboard and screen-reader accessible

#### Favorite Feedback

Favorites already have markers, a panel, and Drive-backed sync through settings. Add small feedback improvements only.

Expected behavior:

- toggling a favorite from a message or member row gives non-blocking feedback
- favorites panel has clear empty, loading, and resolved states
- favorite IDs remain the only synced data for this feature

#### Week 3 Acceptance

- Search state survives panel close and reopen.
- Search load-more appends results without duplicating existing rows.
- Key search and normal search cannot leak state into each other.
- Search highlighting does not render user-controlled HTML.
- Header actions fit on narrow mobile screens without overlap.
- Favorite toggles provide visible feedback.

### Week 4: Performance Closure and Release Validation

Week 4 avoids large new features and validates the first three weeks.

#### Timeline Performance Measurement

Measure before adding timeline virtualization.

Use representative mocked timelines at:

- 100 messages
- 300 messages
- 1000 messages

Evaluate:

- initial room render
- scrolling
- appending new messages
- loading older messages
- image-message rendering
- search jump focus

If 300-message timelines remain smooth enough on target Telegram WebViews, prefer small optimizations. If not, design virtualized timeline rendering as a later standalone project.

#### Scroll Stability Regression Coverage

Protect current timeline behavior:

- loading older messages preserves visible scroll position
- new messages auto-stick only when near the bottom
- new messages away from the bottom increment the new-message prompt
- search jumps focus the target message
- failed context lookup keeps the search panel open

#### Media and Object URL Cleanup

Review file previews, failed uploads, send success, send failure, remove actions, and component unmounting.

Expected behavior:

- object URLs are revoked after removal, send, or unmount
- image lightbox state closes safely when the underlying message file changes
- media fallback behavior remains compatible with the existing no-referrer strategy

#### Release Checklist

Update release validation to cover:

- Telegram mobile open
- Telegram iOS background restore
- weak-network fallback
- room switching
- text draft restore
- send failure
- upload validation and upload failure
- search pagination
- management entry
- favorites panel
- degraded realtime label

#### Week 4 Acceptance

- Unit tests pass for changed stores and utilities.
- Component tests cover composer, timeline, search, room header, and panels touched by the roadmap.
- Key e2e paths pass for chat send, restore, room management entry, search pagination, and weak-network fallback.
- `npm run typecheck` passes.
- Performance measurements decide whether timeline virtualization remains a future project or becomes urgent.

## Architecture Notes

The roadmap should keep logic close to current ownership:

- Composer draft behavior belongs near `MessageComposer` and `ChatRoomView`, with storage access abstracted enough for tests.
- Message send, retry, and pending-message reconciliation remain in `chatStore`.
- Realtime and polling scheduling belongs in `realtimeStore`, `pollingFallback`, and the room-level lifecycle wiring.
- Search pagination state remains in `chatStore`; `SearchPanel` should stay presentational.
- Room management should reuse `RoomManagementPanel` and `roomStore` actions.

Avoid adding a broad shared state manager or cross-module event bus. The current Pinia stores are sufficient for this roadmap.

## Error Handling

Error handling should remain specific to the failing operation:

- draft storage failure should not block typing or sending
- upload validation should show immediate composer feedback
- upload transport failure should leave the upload item retryable
- message send failure should use the existing pending failed timeline state
- stale room requests should be ignored rather than shown as current-room errors
- realtime fallback should degrade quietly until polling mode is actually active
- destructive action cancellation should leave state unchanged

All visible errors must continue to pass through existing redaction helpers where API or network messages are involved.

## Testing Strategy

Use focused tests scaled to the touched surface.

Unit tests:

- room-scoped draft read, write, restore, and clear
- send success and send failure interactions with drafts
- polling fallback start, stop, duplicate-start prevention, backoff, and reset
- stale room response protection
- search continuation and query state isolation

Component tests:

- composer draft restore and clear behavior
- upload validation and failed upload display
- header management or more-actions entry
- search panel load-more and empty states
- favorite feedback and panel states
- confirmation flows for destructive actions

E2E tests:

- typing a draft, reloading, and seeing it restored
- sending clears the draft
- management panel opens from the room UI
- search load-more appends results and jump behavior still works
- simulated socket failures enter polling fallback
- page visibility restore triggers one catch-up request

Verification commands for implementation work:

```bash
npm --prefix chat run test:run
npm --prefix chat run typecheck
npm --prefix chat run e2e
```

## Scope Control

If the roadmap grows during implementation, defer these items unless they become necessary to complete the accepted milestones:

- server-backed edit history
- read receipts
- typing indicators
- push notifications
- global room discovery
- Drive-synced drafts
- long-term offline message cache
- virtualized timeline rendering
