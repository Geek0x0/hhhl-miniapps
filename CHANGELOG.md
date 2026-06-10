# Changelog

This repository can contain multiple mini apps. Changelog entries are grouped by release version and then by subproject.

## 0.6.9 - 2026-06-10

### chat

#### Changed

- Changed room message updates to use one-second HTTP polling of the room timeline while keeping the WebSocket update path in the codebase but disabled.
- Updated the room transport indicator and diagnostics to report HTTP polling mode, polling interval, and polling eligibility.

## 0.6.8 - 2026-06-10

### chat

#### Added

- Added richer message-update diagnostics for the visible-room catch-up path, including document visibility, the shared catch-up interval, route-room presence, chat/realtime room match checks, and whether catch-up is currently eligible without exposing message text or IDs.

## 0.6.7 - 2026-06-10

### chat

#### Added

- Added message-update diagnostics to the settings diagnostics output, including newer/older loading state, history availability, timeline counts, and last server-message timing without exposing message text or IDs.

#### Fixed

- Fixed rooms that show `WS` but stop receiving pushed messages by adding a visible-room catch-up fetch every 3 seconds while the WebSocket remains connected.

## 0.6.6 - 2026-06-10

### chat

#### Fixed

- Added a floating error toast on the hhhl authorization screen when authorization startup or callback errors occur.
- Fixed realtime new-message delivery for nested HHHL message payloads by normalizing messages before room filtering, preventing valid WebSocket events from being ignored until a later catch-up fetch.

## 0.6.5 - 2026-06-10

### chat

#### Fixed

- Fixed chat messages not updating or arriving late by adding WebSocket auto-reconnect with exponential backoff after unexpected disconnections, and immediate catch-up polling when the connection degrades.
- Fixed the room header WS/HP transport status indicator to correctly reflect idle, connected, and degraded states with distinct styling instead of always showing WS when not degraded.
- Fixed member list incomplete loading by retrying failed page fetches up to three times with brief delays before giving up, preventing transient network errors from leaving the list partially loaded.
- Fixed scroll position jumping when loading older chat history by restoring the scroll anchor synchronously after DOM update instead of deferring to a double-requestAnimationFrame callback.
- Fixed realtime messages (from WebSocket or polling) always updating existing timeline entries so reactions and edits arriving through the stream are reflected immediately.
- Added immediate first poll when the polling fallback starts so degraded rooms receive missed messages without waiting for the first scheduled interval.
- Added automatic `loadNewer` fetch on WebSocket reconnection and page visibility restoration to fill any gap between the last seen message and the current server timeline.

## 0.6.4 - 2026-06-08

### chat

#### Added

- Added bot key-result delivery from the Mini App: `autoKeySearch=sendToBot` reads the current Telegram user's CloudStorage-restored HHHL auth, searches room `amlc1bekzi`, and posts only the key result to the bot Worker.

#### Fixed

- Fixed settings sync after login so default local settings are not stamped as freshly updated before the HHHL Drive config is checked, allowing existing cloud settings to load first.

### bot

#### Changed

- Changed the `获取密钥` button flow so the Mini App performs the per-user HHHL lookup and the bot sends the resulting key message after validating Telegram WebApp `initData`, without using KV/D1 or shared HHHL token storage.

## 0.6.3 - 2026-06-08

### chat

#### Added

- Added an `autoKeySearch` room launch mode so bot WebApp buttons can open the fixed key room and automatically search keys using the current Telegram user's CloudStorage-restored HHHL token.

### bot

#### Changed

- Changed the `获取密钥` button to open the Mini App at room `amlc1bekzi` instead of querying HHHL from the Worker, keeping HHHL auth scoped to each Telegram user's CloudStorage.

## 0.6.2 - 2026-06-08

### chat

#### Added

- Added optional Telegram CloudStorage HHHL auth sync so the Mini App can restore login across devices after a successful local login.

### bot

#### Added

- Added an independent `获取密钥` inline button that searches HHHL chat messages for the latest configured `sk-...` token and sends only the extracted key back to the Telegram user.

## 0.6.1 - 2026-06-08

### chat

#### Fixed

- Fixed sent reply and quote message bubbles so action buttons no longer squeeze the message body, keeping the sent text width aligned with its referenced message preview.

## 0.6.0 - 2026-06-08

### xbot

#### Added

- Added a new Cloudflare Worker subproject for bridging one authorized Telegram private chat user with one bound HHHL room.
- Added Telegram webhook handling with shared-secret validation, `/bind`, `/unbind`, `/rename`, `/list`, `/status`, and `/help` command support, plus HHHL room membership validation before binding.
- Added KV-backed binding, realtime status, and Telegram/HHHL message mapping state for reply, quote, dedupe, and unbind cleanup flows.
- Added Telegram-to-HHHL text and media forwarding, including Telegram reply mapping to HHHL `replyId` and `quoteId`.
- Added HHHL-to-Telegram realtime forwarding through a Durable Object WebSocket runtime with history backfill, reconnect alarms, persisted backoff, self-message filtering, media forwarding, replies, and quote fallbacks.
- Added fast webhook acknowledgement for longer forwarding work via `waitUntil`, plus local development, secret, and deployment documentation for xbot.

### chat

#### Added

- Added room member blocking with avatar action menus, muted-message filtering, and a block management panel backed by HHHL room mute endpoints.
- Added a room header transport indicator that shows `WS` or `HP` with accent styling and subtle motion.
- Added key search extraction for embedded `sk-...` tokens so only the newest matched key is displayed and copied.

#### Changed

- Moved key search to the primary room-header action row and moved member access into the secondary header menu.
- Preserved the first visible chat message as a scroll anchor while loading older history, with a floating loading indicator to reduce viewport jumps.

#### Fixed

- Fixed selected-member message searches so sender filters still work with the same keyword that succeeds without a member filter.

## 0.5.6 - 2026-06-07

### chat

#### Fixed

- Fixed member-only message search returning `Invalid param` by scanning room timeline pages and filtering by sender instead of sending an empty query to `chat/messages/search`.

## 0.5.5 - 2026-06-07

### chat

#### Added

- Added a remote version check that compares the running app version with `/version.json` and prompts users to refresh when a newer release is available.

#### Fixed

- Hid room management actions unless the active room is returned by the owned-room list, including direct room routes that must load room sources before showing header actions.

## 0.5.4 - 2026-06-07

### chat

#### Added

- Added an avatar-backed, searchable member picker to message search so members can be filtered by name, username, handle, or id before selecting a sender filter.

#### Changed

- Disabled page-level viewport zoom in the Telegram Mini App while preserving image preview pinch-zoom behavior.

## 0.5.3 - 2026-06-07

### chat

#### Added

- Added member-filtered message search, including member-only searches for all messages from a selected member and paginated continuation that preserves the selected member filter.

## 0.5.2 - 2026-06-07

### chat

#### Fixed

- Fixed another iOS Telegram restore gate case where the WebApp bridge reported a real Telegram platform but restored without launch data, leaving the Mini App on the `Open in Telegram` prompt.

## 0.5.1 - 2026-06-07

### chat

#### Fixed

- Fixed iOS Telegram restore startup races where the Mini App could remain on the `Open in Telegram` prompt until reopened by retrying Telegram WebApp bridge detection briefly after restore and visibility events.

## 0.5.0 - 2026-06-07

### chat

#### Added

- Added room-scoped composer draft persistence that survives refresh and room switching, with successful sends clearing only the submitted room draft.
- Added retryable composer file uploads with validation errors, upload-stage failure feedback, progress forwarding, and preview object URL cleanup.
- Added a compact room-header more menu for favorites, key search, and room management, with keyboard navigation and accessible menu behavior.
- Added search result pagination, safe text-part highlighting, load-more controls, empty state copy, and e2e coverage for normal search/key-search isolation.
- Added non-blocking favorite toggle feedback and favorite-panel loading copy that reports unresolved favorite member counts.
- Added release checklist coverage for drafts, uploads, realtime restore, search pagination, room management, destructive confirmations, favorite feedback, and performance smoke paths.

#### Changed

- Replaced fixed foreground newer-message polling with state-driven realtime reconnect handling, idempotent degraded polling, and visibility-based catch-up.
- Updated search pagination state to guard stale room results and keep unsubmitted search input from driving load-more behavior.

#### Fixed

- Guarded stale room/session races across initial load, older/newer loading, text sending, and file sending so late responses cannot mutate the wrong room.
- Confirmed destructive message, leave-room, and delete-room actions before emitting API calls.
- Preserved pending text drafts across slow or failed sends, including same-text re-entry and room-switch races.

## 0.4.5 - 2026-06-06

### chat

#### Fixed

- Kept the Mini App gate stable after iOS Telegram background restores by remembering recent Telegram launches and rechecking the WebApp bridge on page visibility events.

## 0.4.4 - 2026-06-05

### chat

#### Fixed

- Hardened diagnostics redaction for token-like fields, Telegram launch data, message-shaped logs, encoded identifiers, message ID aliases, and non-active room/member identifiers.

## 0.4.3 - 2026-06-05

### chat

#### Fixed

- Fixed Save to Drive rejecting Drive file responses with nullable URL fields, so JSON settings files without thumbnails or public URLs no longer show `Invalid Drive file response`.

## 0.4.2 - 2026-06-05

### chat

#### Fixed

- Fixed Save to Drive treating empty Drive file lookup responses as invalid responses, so first-time settings sync can create `settings.json` instead of showing `Invalid Drive file response`.
- Fixed the settings footer action buttons on narrow mobile screens by laying them out in a stable two-column grid.

## 0.4.1 - 2026-06-05

### chat

#### Fixed

- Fixed Save to Drive treating empty Drive folder lookup results as invalid responses, so first-time settings sync can create the app folder instead of showing `Invalid Drive folder response`.

## 0.4.0 - 2026-06-05

### chat

#### Added

- Added Drive-backed settings sync for language, theme mode, and favorite user ids via `telegram-bot-chat/settings.json`.
- Added automatic settings load after login, debounced auto-save after preference changes, and a manual Save to Drive action in settings.
- Added settings sync status, last synced time, and redacted sync error display to the settings view.
- Added a diagnostics renderer for redacted auth, realtime, room, chat, route, app version, and Telegram environment context.

#### Changed

- Hardened Drive settings file handling with strict endpoint contracts, UTC `updatedAt` comparison, unknown-field preservation, duplicate cleanup, and serialized cloud sync operations.
- Updated settings storage to keep local changes responsive when cloud sync fails and to ignore stale in-flight sync results after newer local edits or local-data clearing.

#### Fixed

- Prevented Drive file fetches from following token-bearing URLs or including browser credentials.
- Scoped diagnostics redaction so sensitive tokens and identifiers are removed without over-redacting unrelated text.

## 0.3.10 - 2026-06-03

### chat

#### Added

- Added the HHHL logo to the login and room-list headings with shared 45px sizing and aligned heading layout.

#### Changed

- Opened message reaction emoji choices in a floating popover instead of expanding inside the message bubble.
- Updated the new-message prompt to show the number of unseen incoming messages.
- Updated login authorization copy and the primary login button to use `hhhl` wording instead of `MiAuth` or `hhhl.cc`.
- Removed the secondary `dc.hhhl.cc` button from the login guide.

#### Fixed

- Prevented long reply and quote previews from overflowing the chat bubble or composer width.

## 0.3.9 - 2026-06-01

### chat

#### Fixed

- Stripped nested `$[tag ...]` special-format wrappers from displayed chat messages so arbitrary MFM-style effects show their inner text in the Mini App.

## 0.3.8 - 2026-05-31

### chat

#### Fixed

- Restricted key-search results to messages whose entire text is exactly `sk-` followed by a 32-character alphanumeric key, excluding surrounding content.

## 0.3.7 - 2026-05-31

### chat

#### Fixed

- Fixed send-message mention suggestion avatars by using the same no-referrer fallback state as chat message avatars.
- Rendered mention suggestion images from fallback avatar URLs when no primary avatar URL is available, and switched to the initial fallback after both image attempts fail.

## 0.3.6 - 2026-05-31

### chat

#### Fixed

- Aligned member list avatar loading with `MessageBubble` by keeping failed avatar retries on `no-referrer` and removing the old crossorigin retry path.
- Added coverage for member, favorite, and mention suggestion avatar entrypoints to prevent referrer and CORS fallback regressions.

## 0.3.5 - 2026-05-31

### chat

#### Fixed

- Fixed `MessageBubble` media requests returning 500 in Mini App contexts by avoiding the Mini App origin referrer on avatar and image loads.
- Preferred public Drive file URLs over same-origin file URLs when both are returned, so chat images do not depend on original-site cookies to render.

## 0.3.4 - 2026-05-31

### chat

#### Fixed

- Fixed sent message images in `MessageBubble` by normalizing uploaded Drive file URLs before pending and server messages render, preventing relative `/files/...` URLs from being resolved against the Mini App domain.
- Shared Drive file normalization between timeline messages and uploaded files so blurhash, sensitivity, dimensions, thumbnails, and original file URLs stay consistent.

## 0.3.3 - 2026-05-31

### chat

#### Fixed

- Improved avatar and message image loading by matching the original site's origin referrer behavior, retrying avatar fallbacks without forcing CORS, and falling back from thumbnails to original images and Sharkey media proxy URLs.
- Preserved chat file metadata such as blurhash, sensitivity, and image dimensions for future media placeholder and sensitive-media handling.

## 0.3.2 - 2026-05-31

### chat

#### Fixed

- Fixed emoji reactions not appearing immediately after reacting to another user's message.

## 0.3.1 - 2026-05-31

### chat

#### Fixed

- Changed chat message timestamps from `HH:MM` to `MM-DD HH:MM`.

## 0.3.0 - 2026-05-31

### chat

#### Added

- Added current app version display in the settings view.

#### Fixed

- Fixed member list avatars not displaying correctly by applying the same referrerpolicy/crossorigin fallback strategy used in chat message avatars.
- Fixed code quality issues in polling, chat store, room API, and start parameter handling.

## 0.2.0 - 2026-05-29

### Repository

#### Added

- Added root-level npm scripts that delegate to the `chat/` mini app, so commands such as `npm run dev`, `npm run build`, `npm run lint`, and `npm run test:run` work from the repository root.

### chat

#### Added

- Added Cloudflare Pages deployment support for the `chat/` subdirectory, including SPA fallback verification.
- Added Telegram-style chat room UI refinements, image preview lightbox, link previews, emoji sending, Enter-to-send, outside-click panel closing, and search-result jump-to-message behavior.
- Added special-follow favorites for members, including favorite markers in message sender names and a favorites panel that can resolve users through `users/show`.
- Added member search with incremental member loading.
- Added dark, light, and system theme modes in settings.
- Added automatic old-message loading while scrolling upward and newer-message polling for active rooms.
- Added strict key-message search for the configured user id `amk1v51gkh1u0001`, with sender verification through `chat/messages/show` when search results omit user details.
- Added shared UUID fallback generation for environments where `crypto.randomUUID()` is unavailable.

#### Changed

- Room loading now paginates joined, owned, and invitation room lists instead of showing only the first page.
- Search-result jumps now keep the search panel open when context loading fails, instead of silently closing the panel.
- WebSocket failures now notify the realtime store so polling fallback degradation can be triggered.
- Vite dev server now uses polling file watching and ignores generated output directories to avoid local inotify watcher limits.

#### Fixed

- Fixed MiAuth and local message/upload id generation in WebViews or local environments without `crypto.randomUUID()`.
- Fixed key search leaking unverified `sk-` results when the search API ignores or omits sender details.
- Fixed joined-room list badge width and create-room input/type layout issues.
- Fixed search panel state leaking between normal search and key search.

## 0.1.0 - 2026-05-28

### chat

#### Added

- Initial `chat/` Telegram Mini App scaffold for `dc.hhhl.cc` chat rooms.
- Added MiAuth login, room list, room join/create flows, chat timeline loading, message sending, file upload, message search, realtime client, polling fallback, i18n, and Cloudflare Pages build output.
