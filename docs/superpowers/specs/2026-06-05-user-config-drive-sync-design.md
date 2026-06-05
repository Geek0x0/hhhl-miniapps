# User Configuration Drive Sync Design

## Goal

Add support for storing and loading HHHL Chat user configuration through the hhhl.com Drive feature.

The feature syncs account-level preferences across devices while keeping the app usable when sync fails. The first implementation syncs language, theme mode, and favorite user ids. The file format is versioned so future account-level preferences can be added without redesigning the sync layer.

## Current Context

The chat Mini App lives under `chat/` and uses Vue 3, Pinia, Vite, and Vitest.

Relevant existing modules:

- `chat/src/settings/settingsStore.ts` stores language, theme mode, and favorite users in local storage.
- `chat/src/shared/storage.ts` provides the local storage adapter and in-memory fallback.
- `chat/src/api/apiClient.ts` posts authenticated JSON endpoints and uploads files through `drive/files/create`.
- `chat/src/auth/authStore.ts` restores MiAuth tokens and validates them through the `i` endpoint.
- `chat/src/auth/permissions.ts` already requests `read:drive` and `write:drive`.
- `chat/src/api/endpointContracts.ts` locks endpoint metadata into fixtures.

Public endpoint metadata confirms these Drive operations exist:

- `drive/folders/find`
- `drive/folders/create`
- `drive/files/find`
- `drive/files/show`
- `drive/files/create`
- `drive/files/delete`

## Requirements

- Load cloud configuration automatically after login.
- If the cloud config does not exist, create it automatically from the current local configuration.
- Save automatically after supported settings change.
- Add a manual save button in the settings page.
- Manual save must still respect conflict detection and must not overwrite newer cloud data.
- Use UTC timestamps, stored as ISO 8601 strings from `Date.toISOString()`.
- Resolve conflicts using config-level `updatedAt`: the newer config wins.
- Store the Drive config at `telegram-bot-chat/settings.json`.
- Continue using local configuration if sync fails.
- Show sync status, the latest error summary, and a retry/manual save path in settings.
- Keep the existing "clear local data" action local only. It must not delete or clear the cloud config.
- Never sync tokens, draft text, diagnostics, logs, or other sensitive or temporary data.

## Non-Goals

- No real user Drive data is probed during design.
- No broad Drive file manager UI is added.
- No user-selectable sync path is added.
- No per-field conflict resolution is added.
- No cloud deletion action is added in this feature.

## Recommended Approach

Use a dedicated settings sync service.

The alternatives considered were putting sync directly in `settingsStore` or building a generic cloud config layer. A dedicated service is the best fit now because it follows the app's existing API wrapper style, keeps the store focused on UI state and local persistence, and avoids premature cross-app abstraction.

## Architecture

### `settingsSync` Service

The sync service owns Drive interaction and conflict behavior:

- find or create the `telegram-bot-chat` folder
- find config file candidates named `settings.json`
- read and validate the cloud config
- create a first cloud config when none exists
- compare local and cloud `updatedAt`
- load newer cloud preferences into the store
- save local preferences by deleting stale cloud config files and creating a fresh `settings.json`
- expose structured results to the store, such as `created`, `loaded-cloud`, `saved-local`, `unchanged`, or `failed`

The service depends on an endpoint caller and file upload transport, not on Vue components.

### Drive Config API Wrapper

Add a small Drive wrapper below the sync service so endpoint names and response normalization are not spread through the store:

- `findFolder(name, parentId?)`
- `createFolder(name, parentId?)`
- `findFiles(name, folderId)`
- `showFile(fileId)`
- `fetchJsonFile(fileUrl)`
- `createJsonFile(folderId, name, data)`
- `deleteFile(fileId)`

`createJsonFile` uses multipart `drive/files/create` with a JSON `Blob`, fixed file name `settings.json`, and the target folder id.

`showFile` returns Drive file metadata. Reading the config body uses the file URL from that metadata. The implementation must only fetch expected `dc.hhhl.cc` file URLs, must not append the user token to the URL, and must treat an unreadable file URL as a sync failure with local settings preserved.

Cloud updates use delete then create:

1. Read and validate the currently selected cloud config.
2. Compare cloud and local `updatedAt`.
3. If cloud is newer, load cloud config and do not overwrite.
4. If local is same age or newer, delete exact-name config candidates in the app folder.
5. Create a new `settings.json` from the local config.

If deletion fails, creation is skipped to avoid duplicate config files. If creation fails, the local config remains the source of truth until retry.

### `settingsStore`

The settings store keeps existing responsibilities and adds sync state:

- `syncStatus`: `idle`, `loading`, `saving`, `synced`, or `failed`
- `syncError`: redacted latest error summary or `null`
- `lastSyncedAt`: UTC ISO string or `null`
- local config `updatedAt`, persisted under a dedicated local storage key

Existing setters for language, theme mode, and favorite users update local state immediately, write local storage, advance local `updatedAt`, and enqueue an automatic save.

Automatic saves should be debounced and serialized. If settings change while a save is in progress, the store should run one more save after the current save finishes.

### Login Integration

Local settings still initialize first so the UI can render immediately.

After auth reaches an authorized state, the login flow triggers a sync attempt. The sync attempt must not block entering the app. If it fails, the app continues with local settings and settings UI exposes the failure.

## Config File Format

Version 1:

```json
{
  "schemaVersion": 1,
  "app": "hhhl-chat",
  "updatedAt": "2026-06-05T00:00:00.000Z",
  "preferences": {
    "language": "zh",
    "themeMode": "system",
    "favoriteUserIds": []
  }
}
```

Rules:

- `updatedAt` is always UTC ISO 8601.
- Unknown fields in a compatible version should be preserved when saving after a successful cloud load.
- Unsupported future schema versions must not be overwritten by an older client.
- Invalid JSON, invalid timestamps, or invalid preference shapes are treated as sync failures. Local settings remain active.
- Preference normalization reuses existing local validators for locale, theme mode, and favorite user ids.

The file may contain account-level preferences in the future. It must not contain tokens, draft text, diagnostics, logs, or other sensitive or temporary data. This constraint matters because Drive file URLs may be fetchable outside the API flow once known.

## Data Flow

### First Login With No Cloud Config

1. Initialize local settings.
2. Auth succeeds.
3. Sync service finds or creates `telegram-bot-chat`.
4. Sync service cannot find `settings.json`.
5. Sync service creates `settings.json` from local preferences.
6. Store marks sync as `synced`.

### Login With Existing Cloud Config

1. Initialize local settings.
2. Auth succeeds.
3. Sync service reads `telegram-bot-chat/settings.json`.
4. Compare cloud `updatedAt` with local `updatedAt`.
5. If cloud is newer, apply cloud preferences to store and local storage.
6. If local is newer, delete old cloud config and create a new one.
7. If timestamps match, mark sync as complete without writing.

### Automatic Save

1. User changes a supported setting.
2. Store updates UI and local storage immediately.
3. Store advances local `updatedAt`.
4. Store enqueues a debounced sync save.
5. Save reads cloud config before writing.
6. If cloud is newer, cloud is loaded and local overwrite is skipped.
7. Otherwise, cloud file is replaced with local config using delete then create.

### Manual Save

Manual save uses the same conflict-safe save path as automatic save. It is a retry and "save now" control, not a force overwrite.

If cloud is newer, manual save loads cloud preferences and reports that newer cloud settings were applied.

## Duplicate File Handling

If multiple `settings.json` files exist in `telegram-bot-chat`, the sync service treats them as exact-name candidates for the app config.

Read behavior:

- Prefer the valid config with the newest `updatedAt`.
- If none can be parsed, report sync failure and keep local settings.

Save behavior:

- After conflict checks pass, delete exact-name candidates in the app folder.
- Create one fresh `settings.json`.

## Error Handling

Sync errors never block chat or settings use.

The store records:

- status `failed`
- a redacted error summary
- unchanged local preferences

Sensitive strings must pass through existing redaction helpers before display or diagnostics.

Expected failure cases:

- missing Drive permissions
- network timeout
- folder or file lookup failure
- invalid cloud JSON
- unsupported schema version
- cloud file changed after local edit
- delete failure
- create failure

Deletion failure is handled conservatively: do not create a new file until deletion succeeds.

## UI Changes

The settings page adds:

- current sync status
- last successful sync time when available
- latest redacted sync error when available
- manual "save to Drive" button

The existing "clear local data" button remains local only and does not delete cloud config.

## Endpoint Contract Updates

Add these endpoints to the required endpoint fixture list and contract tests:

- `drive/folders/find`: `name`, `parentId`
- `drive/folders/create`: `name`, `parentId`
- `drive/files/find`: `name`, `folderId`
- `drive/files/show`: `fileId`, `url`
- `drive/files/delete`: `fileId`

`drive/files/create` is already covered but should also be tested for JSON config file creation.

Contract probing must stay token-free and must not read user Drive content.

## Testing Plan

### Unit Tests

`settingsSync`:

- creates the app folder when missing
- creates `settings.json` when missing
- loads cloud config when cloud `updatedAt` is newer
- replaces cloud config when local `updatedAt` is newer
- leaves cloud untouched when manual save sees newer cloud config
- rejects invalid JSON and keeps local preferences
- rejects unsupported future schema without overwriting
- handles duplicate config files by choosing the newest valid config
- skips create when delete fails

`settingsStore`:

- initializes local `updatedAt`
- changing language, theme mode, or favorite users advances local `updatedAt`
- supported setting changes enqueue automatic save
- sync failure sets status and error without rolling back UI
- cloud load applies preferences to store and local storage
- clearing local data does not call cloud deletion

Drive wrapper:

- sends exact endpoint names and payloads
- fetches JSON content only from allowed Drive file URLs
- creates JSON config files as multipart uploads
- redacts token-like values in errors

### Component Tests

`SettingsView`:

- renders sync status
- renders last sync time
- renders redacted sync error
- manual save button calls the store save action
- clear local data still only clears local data

### Verification

Run focused tests first:

```bash
npm --prefix chat run test:run -- src/settings src/api
```

Then run the broader checks:

```bash
npm run test:run
npm run typecheck
npm run lint
```

## Implementation Notes

- Use `Date.toISOString()` for all new timestamps.
- Compare timestamps by parsing ISO strings and rejecting invalid values.
- Keep sync writes serialized to avoid concurrent delete/create races.
- Avoid logging config bodies unless tests explicitly use safe fixtures.
- Do not add real tokens or real user Drive responses to fixtures.
- Preserve unrelated user changes in the working tree during implementation.
