# HHHL Telegram Bot

Cloudflare Worker for the Telegram bot entrypoint. When a user sends `/start`, the Worker replies with an inline `打开hhhl` URL button for `https://dc.hhhl.cc`, followed by WebApp buttons that open `MINI_APP_URL`.

The `获取密钥` button opens the Mini App at room `amlc1bekzi` with `autoKeySearch=1`. HHHL authorization for that flow is read by the Mini App from Telegram CloudStorage, so each Telegram user uses their own stored HHHL token. The Worker does not need or read a shared HHHL token.

The `/start` reply uses `message.from.language_code` from Telegram. Chinese language codes such as `zh`, `zh-CN`, and `zh-Hant` receive Chinese copy; all other languages fall back to English.

## Environment Variables

Required Worker environment variables:

- `BOT_TOKEN`: Telegram bot token from BotFather. Configure as a Cloudflare Worker secret.
- `MINI_APP_URL`: HTTPS URL of the Telegram Mini App.

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in real values:

```bash
cp .dev.vars.example .dev.vars
```

For Cloudflare deployment, do not commit the bot token. Configure it with Wrangler or the Cloudflare dashboard:

```bash
npx wrangler secret put BOT_TOKEN
```

Configure `MINI_APP_URL` as a Worker variable in the dashboard, or as a secret if you do not want it committed:

```bash
npx wrangler secret put MINI_APP_URL
```

## Development

```bash
npm install
npm run test:run
npm run typecheck
npm run dev
```

The Worker accepts Telegram webhook updates at both:

- `POST /webhook`
- `POST /`

It also exposes `GET /health` for a lightweight health check.

## Deployment

Deploy the Worker:

```bash
npm run deploy
```

After deployment, point the Telegram webhook at the Worker:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -d "url=https://<your-worker-host>/webhook"
```
