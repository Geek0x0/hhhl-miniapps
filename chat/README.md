# HHHL Chat Mini App

Telegram Mini App client for `dc.hhhl.cc` chat rooms. This app lives in the `chat/` subdirectory so the repository can host additional Mini Apps later.

## External Contract Verification

Run endpoint metadata verification without a user token:

```bash
npm run contracts
```

Run runtime contract fixture generation without a user token:

```bash
node scripts/probe-runtime-contracts.mjs
```

Both commands write fixtures under `src/api/__fixtures__`. They must not request, print, or store user tokens.

## Telegram Bot Links

Generate a room deep link:

```bash
npm run link -- --bot mybot --room amlc1bekzi
```

The command prints:

```text
https://t.me/mybot?startapp=room_amlc1bekzi
```

Configure the bot menu button in BotFather with the deployed Mini App URL. For group entry, send a room link using `startapp=room_<roomId>`. Update the BotFather URL when moving from a `*.pages.dev` deployment to a custom domain.

## Cloudflare Pages Deployment

Git deployment settings:

```text
Root directory: chat
Build command: npm run build
Build output directory: dist
Node.js version: 24.15.0
```

Manual deployment with Wrangler:


```bash
cd chat
npm ci
npm run deploy
```

The Pages configuration uploads static assets from `dist/`. The `_redirects` file keeps SPA fallback routing working for Mini App routes such as `/rooms/amlc1bekzi`, `/auth/callback`, and `/settings`.

## Release Readiness

Use [docs/release-checklist.md](docs/release-checklist.md) before changing the BotFather menu URL or announcing a production deployment.
