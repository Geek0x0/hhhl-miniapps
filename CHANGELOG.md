# Changelog

This repository can contain multiple mini apps. Changelog entries are grouped by release version and then by subproject.

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
