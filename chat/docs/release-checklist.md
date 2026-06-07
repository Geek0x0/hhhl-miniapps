# HHHL Chat Mini App Release Checklist

Run this checklist before changing the Telegram bot menu URL or announcing a production deployment.

## Deployment

- [ ] BotFather menu button points to the current Mini App URL.
- [ ] Group entry links use `https://t.me/<bot>?startapp=room_<roomId>` and open the expected room.
- [ ] Cloudflare Pages deployment URL loads `/`, `/rooms`, `/rooms/<roomId>`, `/auth/callback`, and `/settings` without a 404.
- [ ] Custom domain, if used, is the URL configured in BotFather and hhhl authorization callback settings.
- [ ] `npm run build` and `npm run verify:pages` pass against the deployment artifact.

## Authentication And Data

- [ ] hhhl authorization opens `dc.hhhl.cc` and returns to `/auth/callback` on the deployed domain.
- [ ] A valid dc.hhhl.cc token restores the room list without using Telegram identity as login.
- [ ] Logout clears auth, recent room, and draft local data, then returns to the login gate.
- [ ] Diagnostics output redacts tokens and does not print token-bearing URLs.
- [ ] Browser devtools network requests keep the dc token in POST bodies only, never in URLs.

## Telegram Clients

- [ ] Telegram mobile opens the Mini App, expands correctly, and keeps composer controls tappable.
- [ ] Telegram desktop opens the Mini App and preserves the same login, room, and settings flows.
- [ ] Normal browser access outside Telegram shows the Telegram-only prompt.
- [ ] `startapp=room_<roomId>` is preserved through token restore and opens the target room.
- [ ] Back navigation from a room returns to the room list without losing local state.
- [ ] Telegram iOS background restore returns to the current room and catches up newer messages.
- [ ] Returning from background does not create repeated foreground timeline polling.

## Chat Features

- [ ] Room list loads joined, owned, invited, and direct-join rooms without layout shift.
- [ ] Text send creates a pending message and replaces it with the server response.
- [ ] Long messages wrap inside the timeline at mobile, tablet, and desktop widths.
- [ ] WebSocket failure switches to polling fallback and shows the limited realtime status.
- [ ] File and pasted-image upload previews appear, can be removed, and send successfully.
- [ ] Search opens, submits a query, and renders results.
- [ ] Members panel opens and paginates without overlapping the composer.
- [ ] Room management actions render and permission/API failures show visible errors.
- [ ] Language switching persists and updates visible labels in English and Chinese.
- [ ] Room text drafts survive refresh and room switching, then clear after successful send.
- [ ] File validation errors, upload failures, and message-send failures show distinct user-visible states.
- [ ] Failed uploads remain retryable in the composer.
- [ ] Search result pagination loads older results and keeps normal search separate from key search.
- [ ] Header actions fit on narrow mobile widths, with favorites, key search, and management reachable from more actions.
- [ ] Delete message, leave room, and delete room ask for confirmation before calling the API.
- [ ] Favorite toggles show a non-blocking status and the favorites panel distinguishes loading from empty states.

## Performance Smoke

- [ ] A mocked 100-message room opens without visible layout instability.
- [ ] A mocked 300-message room scrolls, appends a new message, and loads older messages without obvious input delay on Telegram mobile.
- [ ] A mocked 1000-message room is measured and any visible jank is recorded as a follow-up virtualization decision.
- [ ] Image previews open and close without retaining stale previews after message changes.

## Final Commands

```bash
npm ci
npm run contracts
npm run test:run
npm run typecheck
npm run build
npm run verify:pages
npm run e2e
```

Every command should exit with code 0 before release. If `npm run contracts` fails because `dc.hhhl.cc` is unavailable, rerun it before deployment.
