# XBot Telegram HHHL Bridge Design

## Context

The repository currently has two relevant subprojects:

- `chat/`: a Telegram Mini App frontend for HHHL chat rooms. It already documents and implements the HHHL chat API boundaries for rooms, messages, replies, quotes, Drive file uploads, and realtime streaming.
- `bot/`: a small Cloudflare Worker Telegram bot that handles `/start` and opens the Mini App. It is an entrypoint bot, not a chat bridge.

The new `xbot` project will be a separate Cloudflare Worker subproject. It bridges one Telegram private chat with one HHHL chat room at a time. The Telegram side is controlled by one configured Telegram user id. The HHHL side uses one dedicated HHHL bot account token.

## Goals

- Add a new `xbot/` subproject for a Telegram private-chat bridge to HHHL rooms.
- Allow one configured Telegram user to bind exactly one HHHL room at a time.
- Relay Telegram private-chat messages into the bound HHHL room using a dedicated HHHL bot account.
- Relay new HHHL room messages back to the Telegram private chat through HHHL WebSocket streaming.
- Support text, images, ordinary files, videos, and voice messages.
- Support Telegram reply semantics by mapping replies to HHHL `replyId` and `quoteId` when possible.
- Support HHHL reply/quote semantics by using Telegram native replies when possible, with a short text quote fallback.
- Store binding state and message-id mappings in Cloudflare KV.
- Use a Durable Object to own the HHHL WebSocket, reconnection, history backfill, and realtime forwarding loop.
- Keep all command and status text in Chinese for the first release.

## Non-Goals

- Do not extend the existing `bot/` Mini App entrypoint worker with bridge behavior.
- Do not change the `chat/` frontend UI.
- Do not support Telegram group bridging in the first release.
- Do not support multiple simultaneous room bindings.
- Do not support Telegram user to HHHL user account mapping.
- Do not parse or rewrite `@mentions`; mentions remain ordinary text.
- Do not automatically join HHHL rooms during `/bind`.
- Do not add a shared monorepo package in the first release.
- Do not add polling fallback while the WebSocket is disconnected.

## Confirmed HHHL API Surface

The existing `chat/` project already uses these HHHL endpoints and shapes:

- `i`: validate the HHHL token and identify the dedicated HHHL bot account.
- `chat/rooms/show`: verify that a room id is visible.
- `chat/rooms/members`: verify that the dedicated HHHL bot account is already a member of the room.
- `chat/messages/room-timeline`: load recent messages and backfill messages after `lastSeenMessageId`.
- `chat/messages/create-to-room`: send HHHL room messages with `toRoomId`, `text`, `fileId`, `replyId`, and `quoteId`.
- `drive/files/create`: upload Telegram media into HHHL Drive before sending a file message.

The existing realtime contract fixture uses:

- `wss://dc.hhhl.cc/streaming?i={token}` for HHHL streaming.
- A main stream connect message followed by `ch` channel envelopes for room subscriptions.

`xbot` can copy the small endpoint, file normalization, and realtime envelope logic it needs from `chat/`. It should not introduce a shared package until there is a broader reason to refactor both subprojects.

## Architecture

`xbot/` will be a Cloudflare Worker project using TypeScript, Wrangler, and Vitest, matching the style of `bot/`.

The Worker fetch handler owns:

- `GET /health` health checks.
- Telegram webhook routes, for example `POST /` and `POST /webhook`.
- Telegram user authorization against `ALLOWED_TELEGRAM_USER_ID`.
- Command parsing and command responses.
- Telegram to HHHL text and media forwarding.
- Calls into the Durable Object when binding state changes or realtime status is requested.

Cloudflare KV owns persistent lightweight state:

- Current binding.
- Display name for the room.
- `lastSeenMessageId`.
- HHHL message id to Telegram message id mapping.
- Telegram message id to HHHL message id mapping.
- Recent realtime status and last error snapshot.

The Durable Object owns realtime coordination:

- Load current binding from KV.
- Open and hold the HHHL WebSocket.
- Subscribe to the single active room.
- Forward HHHL messages to Telegram.
- Filter messages authored by the dedicated HHHL bot account.
- Write message-id mappings after successful Telegram sends.
- Update `lastSeenMessageId`.
- Reconnect with exponential backoff after socket failures.
- After reconnect, backfill messages newer than `lastSeenMessageId`.
- Stop the socket when `/unbind` removes the binding.

The Durable Object coordination atom is the allowed Telegram user. The Worker should route to a deterministic object name such as `telegram:${telegramUserId}`. Because the first release only permits one allowed Telegram user and one active HHHL room, production will normally have one active object instance, but the design does not require a global singleton if more users are added later.

## Configuration

Local development uses `.dev.vars`. Production uses Cloudflare Worker secrets for sensitive values.

Required secrets:

- `BOT_TOKEN`: Telegram bot token.
- `HHHL_TOKEN`: token for the dedicated HHHL bot account.
- `ALLOWED_TELEGRAM_USER_ID`: Telegram numeric user id that may use this bot.

Non-sensitive vars:

- `HHHL_ORIGIN`, default `https://dc.hhhl.cc`.
- `HHHL_API_BASE_URL`, default `${HHHL_ORIGIN}/api`.
- `INITIAL_HISTORY_LIMIT`, default `30`.
- `RECONNECT_BASE_DELAY_MS`, default `1000`.
- `RECONNECT_MAX_DELAY_MS`, default `60000`.
- `KV_KEY_PREFIX`, default `xbot`.

At startup or before bind validation, `xbot` calls `i` with `HHHL_TOKEN` and caches the HHHL bot user id. This id is used to validate room membership and filter self-authored HHHL messages from the Telegram output.

## Command Model

All first-release command text and help output is Chinese.

Supported commands:

- `/bind <roomId> [显示名]`: bind the only active HHHL room.
- `/unbind`: remove the active binding and stop realtime forwarding.
- `/rename <显示名>`: update the display name for the bound room.
- `/list`: show the current binding, display name, `lastSeenMessageId`, and realtime state.
- `/status`: show compact diagnostics for configuration, binding, WebSocket state, recent error, and next reconnect time.
- `/help`: show Chinese command help.

`/bind` behavior:

1. Reject the command if there is already a binding. The user must run `/unbind` first.
2. Validate the room with `chat/rooms/show`.
3. Validate that the dedicated HHHL bot account is already a member using `chat/rooms/members`.
4. Do not call `chat/rooms/join`.
5. Persist the binding in KV.
6. Notify the Durable Object to start streaming.
7. Backfill the latest `INITIAL_HISTORY_LIMIT` messages, defaulting to 30, from old to new.

Ordinary Telegram messages require an active binding. Without one, the bot replies with a Chinese prompt to run `/bind`.

## State Model

The state can be represented with a few versioned JSON values in KV:

```ts
interface BindingState {
  version: 1;
  telegramUserId: string;
  roomId: string;
  roomName: string;
  boundAt: string;
  lastSeenMessageId: string | null;
}

interface MessageMapState {
  version: 1;
  roomId: string;
  hhhlMessageId: string;
  telegramMessageId: number;
  createdAt: string;
}

interface RealtimeStatusState {
  version: 1;
  state: 'stopped' | 'connecting' | 'connected' | 'backing_off';
  connectedAt: string | null;
  lastError: string | null;
  nextReconnectAt: string | null;
}
```

Recommended key shapes:

- `${prefix}:binding:${telegramUserId}`
- `${prefix}:map:hhhl:${roomId}:${hhhlMessageId}`
- `${prefix}:map:telegram:${telegramUserId}:${telegramMessageId}`
- `${prefix}:status:${telegramUserId}`

Message mappings are needed for both directions:

- Telegram reply to a forwarded HHHL message needs Telegram message id to HHHL message id.
- HHHL reply or quote to an already forwarded HHHL message needs HHHL message id to Telegram message id.

If a mapping is missing or not yet visible in KV, the bridge degrades gracefully by sending a normal message or a short text quote.

## Telegram To HHHL Flow

Text messages:

1. Verify the Telegram sender id matches `ALLOWED_TELEGRAM_USER_ID`.
2. Load the active binding from KV.
3. If the Telegram message is a reply, look up the replied-to Telegram message id in KV.
4. If the lookup finds a HHHL message id for the same room, send `replyId` and `quoteId` with the same HHHL message id.
5. Call `chat/messages/create-to-room` with `toRoomId`, `text`, and optional reply fields.
6. Store the returned HHHL message id mapped to the Telegram source message id when useful for later references.

Media messages:

1. Support Telegram photo, document, video, and voice updates.
2. Resolve the Telegram file through `getFile`.
3. Download the file from Telegram.
4. Upload it to HHHL through `drive/files/create`.
5. Call `chat/messages/create-to-room` with `toRoomId`, `fileId`, and optional `replyId` and `quoteId`.
6. If download or upload fails, reply in Telegram with a Chinese error. Do not send a HHHL placeholder message.

Telegram captions are included as HHHL text when the HHHL API accepts text with `fileId`. If a caption plus file fails due to HHHL constraints, the bridge reports the failed media send in Telegram rather than silently splitting into multiple HHHL messages.

`@mentions` remain ordinary text in both text and captions.

## HHHL To Telegram Flow

The Durable Object receives HHHL realtime events for the active room.

For each HHHL message:

1. Normalize the message similarly to `chat/src/chat/chatApi.ts`.
2. Ignore the message if its author id is the dedicated HHHL bot account id.
3. Skip the message if it has already been forwarded.
4. Resolve reply or quote context:
   - If the referenced HHHL message has a Telegram mapping, send using Telegram native reply to that message.
   - Otherwise prepend or attach a short Chinese quote summary.
5. Send text and media to the allowed Telegram private chat.
6. Pick Telegram send method from HHHL file metadata:
   - image types use `sendPhoto`.
   - video types use `sendVideo`.
   - voice or audio voice-like types use `sendVoice` when compatible.
   - other files use `sendDocument`.
7. Store the HHHL to Telegram message mapping.
8. Update `lastSeenMessageId`.

If a HHHL message has both text and media, the bridge uses Telegram caption support where possible. If caption length or media method constraints prevent that, it may send the text and media as separate Telegram messages while mapping the primary Telegram message id back to the HHHL message id.

## Realtime And Backfill

Binding backfill:

- After `/bind`, load the latest `INITIAL_HISTORY_LIMIT` messages with `chat/messages/room-timeline`.
- Forward them from old to new so Telegram ordering is readable.
- Apply the same self-message filtering and deduplication as realtime events.
- Update `lastSeenMessageId` to the newest forwarded or observed HHHL message.

Reconnect backfill:

- On socket close or error, reconnect immediately.
- Repeated failures use exponential backoff capped by `RECONNECT_MAX_DELAY_MS`.
- No polling fallback runs while disconnected.
- After reconnect, call `chat/messages/room-timeline` with `sinceId: lastSeenMessageId`.
- Forward missed messages from old to new, dedupe them against existing mappings, then resume realtime handling.

Durable Object status is written to KV so `/status` can report whether the bridge is connected, connecting, backing off, or stopped.

## Error Handling And Security

Telegram webhooks should return quickly so Telegram does not retry unnecessarily. Commands that need an immediate response can await their work. Longer forwarding work, especially media download and upload, should be run through the Worker execution context so the webhook can ACK while later failures are sent as Chinese private-chat messages to the allowed user.

Sensitive values must be redacted from logs and errors:

- `BOT_TOKEN`
- `HHHL_TOKEN`
- Telegram file download URLs containing bot token
- HHHL API token parameter `i`

Unauthorized Telegram users are rejected or ignored before any command or bridge logic runs.

Media errors are reported only to Telegram. They do not create placeholder HHHL messages.

HHHL API errors during `/bind` should distinguish:

- Room not visible.
- HHHL bot account is not a room member.
- HHHL token invalid.
- Network or upstream failure.

Durable Object failures should not corrupt the binding. `/unbind` remains available even if the socket is failing.

## Project Structure

Suggested layout:

```text
xbot/
  package.json
  tsconfig.json
  vitest.config.ts
  wrangler.jsonc
  .dev.vars.example
  README.md
  src/
    index.ts
    config.ts
    telegram/
      api.ts
      commands.ts
      updates.ts
      media.ts
    hhhl/
      apiClient.ts
      chatApi.ts
      driveApi.ts
      realtime.ts
      types.ts
    state/
      keys.ts
      kvStore.ts
      schemas.ts
    bridge/
      inbound.ts
      outbound.ts
      mapping.ts
    realtime/
      BridgeObject.ts
  test/
    index.test.ts
    commands.test.ts
    bridge.test.ts
    realtime.test.ts
```

Root `package.json` should add:

- `dev:xbot`
- `test:xbot`
- `typecheck:xbot`
- `deploy:xbot`

`xbot/wrangler.jsonc` should define:

- Worker name.
- Main entrypoint.
- KV namespace binding.
- Durable Object binding and migration.
- Observability settings consistent with `bot/`.

## Testing Strategy

Unit tests:

- Config validation and secret redaction.
- Chinese command parsing.
- Authorization by Telegram user id.
- `/bind` rejects an existing binding.
- `/bind` validates room visibility and membership without auto-joining.
- KV key and schema behavior.
- Telegram update parsing for text, photo, document, video, and voice.
- Telegram reply lookup maps to both HHHL `replyId` and `quoteId`.
- HHHL message normalization and self-message filtering.
- HHHL reply/quote maps to Telegram native reply when mapping exists.
- Missing mappings degrade to normal text or short quote fallback.

Worker handler tests:

- `GET /health`.
- Webhook ACK behavior.
- Unauthorized user behavior.
- Command responses in Chinese.
- Telegram to HHHL text send.
- Telegram media download/upload/send flow.
- Media failure reports only to Telegram.

Durable Object tests:

- Starts WebSocket after binding.
- Subscribes only to the active room.
- Backfills latest history on bind.
- Backfills from `lastSeenMessageId` after reconnect.
- Dedupes messages seen in both backfill and realtime.
- Exponential backoff status updates.
- Stops on unbind.

Manual acceptance:

1. Configure `.dev.vars` with local test secrets.
2. Bind a room where the HHHL bot account is already a member.
3. Confirm recent history appears in Telegram.
4. Send Telegram text, image, file, video, and voice messages and verify HHHL receives them.
5. Reply in Telegram to a forwarded HHHL message and verify HHHL receives both `replyId` and `quoteId`.
6. Send a HHHL reply/quote and verify Telegram uses native reply or quote fallback.
7. Confirm xbot-authored HHHL messages are not echoed back.
8. Disconnect/reconnect WebSocket and confirm missed messages are backfilled.
9. Run `/list`, `/status`, `/rename`, and `/unbind`.

## Implementation Order

1. Scaffold `xbot/` Worker project and root package scripts.
2. Add config, redaction, and Telegram authorization.
3. Add KV state store and schemas.
4. Add command parsing and Chinese command responses.
5. Add HHHL endpoint client and bind validation.
6. Add Telegram to HHHL text forwarding with reply mapping.
7. Add Telegram media download, HHHL Drive upload, and file sending.
8. Add Durable Object WebSocket connection, subscription, and status.
9. Add HHHL to Telegram forwarding, self-message filtering, and message mappings.
10. Add bind history backfill, reconnect backfill, dedupe, and backoff.
11. Add README, `.dev.vars.example`, Wrangler bindings, and deployment notes.
12. Run typecheck and tests for `xbot`.
