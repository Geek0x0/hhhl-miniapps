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
