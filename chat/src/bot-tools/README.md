# Telegram Bot Link Tools

Use a bot menu button or a message button to open this Mini App. Room links use Telegram's `startapp` parameter:

```text
https://t.me/<botUsername>?startapp=room_<roomId>
```

Generate a room link locally:

```bash
npm run link -- --bot mybot --room amlc1bekzi
```

BotFather setup:

1. Open BotFather and select the bot.
2. Set the Mini App menu button URL to the deployed app URL, such as `https://<worker-name>.<account>.workers.dev`.
3. Use group buttons or normal messages with `https://t.me/<botUsername>?startapp=room_<roomId>` for room-specific entry.
4. When moving from `*.workers.dev` to a custom domain, update the BotFather menu button URL and any pinned room links.

Never include `dc.hhhl.cc` user tokens, Telegram init data, or `i=` query values in bot links.
