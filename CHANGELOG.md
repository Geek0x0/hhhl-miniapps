# Changelog

This repository can contain multiple mini apps. Changelog entries are grouped by release version and then by subproject.

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
