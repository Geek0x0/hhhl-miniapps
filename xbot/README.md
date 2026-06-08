# HHHL XBot

HHHL XBot is a Telegram private-chat bridge for one HHHL chat room.

## Behavior

Only the Telegram user whose ID matches `ALLOWED_TELEGRAM_USER_ID` can use the bot. Updates from other Telegram users or non-private chats are ignored.

The bot supports one active HHHL room binding:

- `/bind <roomId> [显示名]` binds exactly one HHHL room. If a binding already exists, run `/unbind` before binding another room.
- `/unbind` removes the current binding and stops realtime forwarding.
- `/rename <显示名>` updates the display name shown for the current binding.
- `/list` shows the current binding.
- `/status` shows realtime bridge status.
- `/help` shows command help.

The HHHL side uses `HHHL_TOKEN`. That HHHL account must already be a member of the room before `/bind` can succeed.

## Local Development

```sh
cp .dev.vars.example .dev.vars
npm install
npm run test:run
npm run typecheck
npm run dev
```

`.dev.vars.example` contains local-only example values. Replace them in `.dev.vars` with values for your development bot and HHHL account.

## Cloudflare Setup

Create a production KV namespace and a preview namespace for the `XBOT_STATE` binding:

```sh
npx wrangler kv namespace create XBOT_STATE
npx wrangler kv namespace create XBOT_STATE --preview
```

Copy the returned namespace IDs into `wrangler.jsonc`, replacing the dummy `id` and `preview_id` values under `kv_namespaces`.

Set production secrets with Wrangler. Use the interactive prompts and do not pass secret values as command arguments:

```sh
npx wrangler secret put BOT_TOKEN
npx wrangler secret put HHHL_TOKEN
npx wrangler secret put ALLOWED_TELEGRAM_USER_ID
npx wrangler secret put BOT_WEBHOOK_SECRET
```

Deploy the Worker:

```sh
npm run deploy
```

Set the Telegram webhook with the Telegram `setWebhook` endpoint. Use the deployed Worker URL, usually with the `/webhook` path, and include a `secret_token` value that exactly matches `BOT_WEBHOOK_SECRET`:

```sh
curl -X POST "https://api.telegram.org/bot<telegram-bot-token>/setWebhook" \
  -d "url=https://<worker-url>/webhook" \
  -d "secret_token=<BOT_WEBHOOK_SECRET>"
```

Telegram sends that shared value back on webhook requests in the `X-Telegram-Bot-Api-Secret-Token` header, and the Worker rejects requests where the header does not match `BOT_WEBHOOK_SECRET`.

## Sensitive Values

Do not put Telegram bot tokens, HHHL tokens, webhook shared values, or `i=` query values in logs, links, screenshots, issue comments, or chat messages.
