# Changelog

This repository can contain multiple mini apps. Changelog entries are grouped by release version and then by subproject.

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
