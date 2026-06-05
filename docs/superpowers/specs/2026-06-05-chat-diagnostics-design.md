# Chat Diagnostics Design

## Context

The `chat/` Mini App currently exposes diagnostics from the settings page. The existing implementation stores one redacted text blob in `settingsStore.collectDiagnostics()` and renders it in `DiagnosticsPanel.vue`. It includes only the instance URL, realtime status, storage status, and optional raw text.

The existing security requirement remains unchanged: diagnostics stay hidden until the user opens them, and token-like data must never appear in visible diagnostics.

## Goal

Add richer diagnostics for user support and development troubleshooting while preserving a strict privacy boundary.

The first version covers:

- runtime environment
- authentication status
- current route
- realtime status
- storage status
- room state summary
- chat state summary
- current store errors

## Non-Goals

This version does not add API or runtime contract summaries. It also does not include chat message text, message ID lists, file URLs, raw Telegram `initData`, auth tokens, or unredacted URLs containing sensitive query parameters.

## Approach

Use a structured diagnostics snapshot in the settings store, then render that snapshot into two text outputs:

- `safeDiagnostics`: shown by default and safe for normal user support.
- `detailedDiagnostics`: hidden until a second confirmation and intended for development troubleshooting.

The UI remains simple text output. Field selection and privacy rules live in the diagnostics collection/rendering path, not in the Vue component.

## Diagnostics Snapshot

The snapshot is organized by module:

- `environment`
- `auth`
- `route`
- `realtime`
- `storage`
- `rooms`
- `chat`
- `errors`

The collector accepts the relevant Pinia store summaries, current route summary, app version, and Telegram launch/environment summary. The collector should store counts, statuses, booleans, route metadata, and selected identifiers only where allowed by the output level.

## Safe Summary

The safe output includes:

- app version
- app mode or development flag
- configured instance origin
- current route name and route type
- whether a Telegram environment is present
- Telegram platform, if available
- auth status
- whether an authenticated user exists
- realtime status
- storage status
- room loading state
- room count
- invitation count
- whether the user is currently on a room route
- chat loading state
- timeline count
- outgoing message count
- search result count
- key-search result count
- current redacted errors from auth, rooms, chat, search, and key search

The safe output must not include user IDs, usernames, room IDs, or room names.

## Development Details

The detailed output is available only after the user confirms that it may include user and room identifiers. It may additionally include:

- current user ID
- current username
- current room ID
- current room name
- pending start room ID
- active room ID
- chat room ID
- member count for the active room
- outbox invitation count
- whether a reply target exists
- whether a quote target exists
- failed pending message count

The detailed output still must not include chat message text, message ID lists, file URLs, raw Telegram `initData`, auth tokens, or unredacted sensitive URLs.

## Redaction

All rendered diagnostics pass through `redactSensitiveText`. The redaction coverage should continue to include:

- `?i=...` and `&i=...`
- `token=...`
- JSON `"i": "..."`
- JSON `"token": "..."`

If the implementation adds URL-bearing fields, the diagnostics renderer must strip or redact sensitive query parameters before output.

## UI Behavior

The settings page continues to open diagnostics from the existing diagnostics button. The panel defaults to the safe summary and provides a copy action for that safe text.

Development details are not shown immediately. The user clicks a "show development details" action, sees a confirmation state explaining that user and room identifiers may be included but message text and tokens are excluded, then confirms before the detailed output appears. The detailed output has its own copy action.

Closing or refreshing diagnostics resets the development details back to the unconfirmed state.

All visible text is localized in English and Chinese.

## Testing

Add focused tests for:

- `settingsStore.collectDiagnostics()` generating both safe and detailed outputs.
- safe diagnostics excluding user ID, username, room ID, and room name.
- detailed diagnostics including allowed user and room identifiers.
- diagnostics excluding message text, message ID lists, tokens, raw Telegram `initData`, and sensitive URLs.
- all error fields and raw diagnostic inputs passing through redaction.
- `DiagnosticsPanel` showing only the safe summary by default.
- `DiagnosticsPanel` showing detailed diagnostics only after confirmation.
- `SettingsView` passing auth, realtime, room, chat, route, and app version context into diagnostics collection.

Verification commands:

```bash
cd chat
npm run test:run -- src/settings src/shared
npm run typecheck
```

## Implementation Boundaries

Keep changes scoped to settings diagnostics, i18n messages, and tests unless a small shared redaction helper change is required. Do not refactor unrelated store behavior.
