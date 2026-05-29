# HHHL Telegram Mini App Progress

Updated: 2026-05-28

## Current Checkpoint

- Chat interaction refinement is complete.
- The chat room now uses a more Telegram-like layout with incoming/outgoing bubbles, compact header actions, a rounded composer, and a subtle chat background.
- Newer message polling now runs immediately and every 3 seconds; users who are already near the bottom stay pinned to the latest messages.
- Older messages and members both load by scroll position instead of visible load-more buttons.
- Delete actions are only rendered on the current user's own messages.
- The composer supports an emoji picker, and message search results now show sender, message preview, and sent time.
- Room settings moved to the `/rooms` header, and joined-room badges hide the `deep-link` source.
- Member API responses now normalize additional dc.hhhl.cc user wrapper variants for names and avatars.
- Root `.gitignore` is untracked and contains `docs/`; it was not modified.

## Verification Log

- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run test:run -- src/chat src/rooms src/i18n src/realtime/realtimeClient.test.ts` - passed, 9 files and 44 tests.
- `npm run build && npx playwright test tests/e2e/chat-happy-path.spec.ts tests/e2e/workers-routing.spec.ts` - passed.

## Notes

- Previous rich timeline fixes were committed as `a5d7345 fix(chat): render rich timeline messages`.
- Existing unrelated workspace state remains untouched; the untracked root `.gitignore` is still not part of this work.
