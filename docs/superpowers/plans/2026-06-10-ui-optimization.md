# HHHL Chat Mini App UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the HHHL Chat Mini App UI with a Telegram-native enhanced visual system, richer motion, clearer state feedback, and polished room, chat, settings, and management surfaces.

**Architecture:** Extend the existing Vue 3 Mini App using a CSS-first approach. Add reusable design tokens and utility/state classes in the existing style files, then make small template-only adjustments in Vue components where needed for skeletons, richer empty/error states, panel grouping, and safer semantics.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vue Router, Vitest, Testing Library Vue, Playwright, CSS custom properties.

---

## Source Spec

Approved design spec: `docs/superpowers/specs/2026-06-10-ui-optimization-design.md`

## Implementation Rules

- Work inside `chat/` for frontend commands.
- Use TDD for structural/template behavior changes.
- Prefer CSS-only changes where possible.
- Do not change store, API, auth, realtime, or routing behavior.
- Do not introduce a UI framework or animation library.
- Preserve existing i18n keys unless a task explicitly adds text.
- Preserve existing tests; update or add tests only for observable DOM structure/classes/semantics.
- After each task, run the narrow test command listed in that task before committing.
- Commit each task separately using conventional commit messages.

## File Structure Map

### Style files

- Modify: `chat/src/styles/telegram.css`
  - Responsibility: Telegram-derived color variables plus new design tokens for surfaces, radii, shadows, motion, states, focus rings, skeletons, and theme-aware color mixing.
- Modify: `chat/src/styles/base.css`
  - Responsibility: app-wide base behavior: focus outlines, reduced-motion defaults, body background, form element polish.
- Modify: `chat/src/styles/components.css`
  - Responsibility: all component-level styling for rooms, chat, panels, composer, states, banners, menus, settings, diagnostics, and animations.

### Room entry components

- Modify: `chat/src/rooms/components/RoomListView.vue`
  - Responsibility: room entry shell and loading/empty states for joined rooms.
- Modify: `chat/src/rooms/components/RoomListItem.vue`
  - Responsibility: single room card structure and readable room metadata.
- Modify: `chat/src/rooms/components/RoomDirectJoin.vue`
  - Responsibility: direct join panel markup.
- Modify: `chat/src/rooms/components/RoomInvitationList.vue`
  - Responsibility: invitation cards and action grouping.
- Modify: `chat/src/rooms/components/RoomErrorState.vue`
  - Responsibility: room-level error alert surface.
- Modify: `chat/src/rooms/components/RoomCreateDialog.vue`
  - Responsibility: create room panel markup, if existing classes need grouping.

### Chat components

- Modify: `chat/src/chat/components/ChatRoomView.vue`
  - Responsibility: chat shell, panel region, global chat error, feedback toast.
- Modify: `chat/src/chat/components/ChatHeader.vue`
  - Responsibility: sticky header, action menu, connection status badge.
- Modify: `chat/src/chat/components/MessageTimeline.vue`
  - Responsibility: timeline loading state, empty state, new-message pill, focused message behavior remains unchanged.
- Modify: `chat/src/chat/components/MessageBubble.vue`
  - Responsibility: message bubble states and lightbox/menu visual affordances.
- Modify: `chat/src/chat/components/MessageComposer.vue`
  - Responsibility: composer dock structure and send/disabled/pending affordances.
- Modify: `chat/src/chat/components/SearchPanel.vue`, `KeySearchPanel.vue`, `MembersPanel.vue`, `FavoritePanel.vue`, `BlockedUsersPanel.vue`, `ReplyPreview.vue`, `MessageActions.vue`, `ReactionPicker.vue`
  - Responsibility: adopt shared sheet, row, list, and state classes primarily through CSS; template changes only if tests expose missing semantics.

### Settings and management components

- Modify: `chat/src/settings/components/SettingsView.vue`
  - Responsibility: grouped settings panels and notices.
- Modify: `chat/src/settings/components/DiagnosticsPanel.vue`
  - Responsibility: diagnostics surface and scrollable output styling.
- Modify: `chat/src/rooms/components/RoomManagementPanel.vue`
  - Responsibility: grouped room management sections and danger zone.

### App shell

- Modify: `chat/src/App.vue`
  - Responsibility: update banner structure/classes only.

### Tests

- Modify or add tests near touched components:
  - `chat/src/rooms/components/RoomListView.test.ts`
  - `chat/src/rooms/components/RoomListItem.test.ts` if a new test file is needed
  - `chat/src/rooms/components/RoomInvitationList.test.ts` if a new test file is needed
  - `chat/src/chat/components/MessageTimeline.test.ts`
  - `chat/src/chat/components/MessageComposer.test.ts`
  - `chat/src/chat/components/ChatHeader.test.ts`
  - `chat/src/settings/components/SettingsView.test.ts`
  - `chat/src/rooms/components/RoomManagementPanel.test.ts`
  - `chat/src/App.test.ts`

---

## Task 1: Add Visual System Tokens and Base Interaction Rules

**Files:**
- Modify: `chat/src/styles/telegram.css`
- Modify: `chat/src/styles/base.css`
- Modify: `chat/src/styles/components.css`

### Goal

Create reusable CSS tokens and global behaviors before component work starts. This task should not change Vue templates.

- [ ] **Step 1: Add design tokens to `chat/src/styles/telegram.css`**

Append these variables inside the existing `:root` block after `--tg-danger`:

```css
  --tg-success: #16a34a;
  --tg-warning: #f59e0b;
  --tg-info: #2aabee;
  --tg-soft-bg: color-mix(in srgb, var(--tg-button) 7%, var(--tg-bg));
  --tg-surface-raised: color-mix(in srgb, var(--tg-panel) 94%, var(--tg-button) 6%);
  --tg-surface-glass: color-mix(in srgb, var(--tg-panel) 86%, transparent);
  --tg-surface-danger: color-mix(in srgb, var(--tg-danger) 10%, var(--tg-panel));
  --tg-surface-warning: color-mix(in srgb, var(--tg-warning) 12%, var(--tg-panel));
  --tg-surface-success: color-mix(in srgb, var(--tg-success) 10%, var(--tg-panel));
  --tg-focus-ring: 0 0 0 3px color-mix(in srgb, var(--tg-button) 28%, transparent);
  --tg-radius-xs: 6px;
  --tg-radius-sm: 10px;
  --tg-radius-md: 14px;
  --tg-radius-lg: 20px;
  --tg-radius-pill: 999px;
  --tg-shadow-subtle: 0 1px 2px rgba(20, 32, 43, 0.08);
  --tg-shadow-raised: 0 10px 28px rgba(20, 32, 43, 0.12);
  --tg-shadow-floating: 0 18px 48px rgba(20, 32, 43, 0.18);
  --tg-motion-fast: 120ms;
  --tg-motion-normal: 220ms;
  --tg-motion-slow: 420ms;
  --tg-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --tg-ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --tg-skeleton-base: color-mix(in srgb, var(--tg-hint) 12%, transparent);
  --tg-skeleton-sheen: color-mix(in srgb, var(--tg-button) 14%, transparent);
```

Inside the existing `:root[data-theme='dark']` block, add these overrides after `--tg-shadow`:

```css
  --tg-shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.28);
  --tg-shadow-raised: 0 12px 32px rgba(0, 0, 0, 0.32);
  --tg-shadow-floating: 0 18px 54px rgba(0, 0, 0, 0.42);
  --tg-surface-glass: color-mix(in srgb, var(--tg-panel) 82%, transparent);
```

- [ ] **Step 2: Add global focus and reduced-motion rules to `chat/src/styles/base.css`**

Append this block to the end of `base.css`:

```css
:focus-visible {
  outline: none;
  box-shadow: var(--tg-focus-ring);
}

button,
a,
input,
textarea,
select {
  transition:
    background-color var(--tg-motion-fast) var(--tg-ease-standard),
    border-color var(--tg-motion-fast) var(--tg-ease-standard),
    box-shadow var(--tg-motion-fast) var(--tg-ease-standard),
    color var(--tg-motion-fast) var(--tg-ease-standard),
    opacity var(--tg-motion-fast) var(--tg-ease-standard),
    transform var(--tg-motion-fast) var(--tg-ease-standard);
}

button:active:not(:disabled),
a:active {
  transform: translateY(1px) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 3: Add shared state primitives to `chat/src/styles/components.css`**

Insert this block near the top of `components.css`, after `.app-copy`:

```css
.ui-surface {
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-subtle);
}

.ui-surface--glass {
  background: var(--tg-surface-glass);
  backdrop-filter: blur(16px) saturate(1.2);
}

.ui-notice {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-subtle);
  color: var(--tg-text);
}

.ui-notice--error {
  border-color: color-mix(in srgb, var(--tg-danger) 38%, var(--tg-border));
  background: var(--tg-surface-danger);
}

.ui-notice--warning {
  border-color: color-mix(in srgb, var(--tg-warning) 42%, var(--tg-border));
  background: var(--tg-surface-warning);
}

.ui-notice--success {
  border-color: color-mix(in srgb, var(--tg-success) 36%, var(--tg-border));
  background: var(--tg-surface-success);
}

.ui-empty-state {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 18px;
  border: 1px dashed color-mix(in srgb, var(--tg-button) 28%, var(--tg-border));
  border-radius: var(--tg-radius-md);
  background:
    radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--tg-button) 12%, transparent), transparent 34%),
    var(--tg-bg);
  color: var(--tg-hint);
}

.ui-empty-state strong {
  color: var(--tg-text);
}

.ui-skeleton {
  position: relative;
  overflow: hidden;
  border-radius: var(--tg-radius-md);
  background: var(--tg-skeleton-base);
}

.ui-skeleton::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--tg-skeleton-sheen), transparent);
  content: "";
  transform: translateX(-100%);
  animation: ui-skeleton-shimmer 1400ms var(--tg-ease-standard) infinite;
}

@keyframes ui-skeleton-shimmer {
  to {
    transform: translateX(100%);
  }
}

@keyframes ui-enter-up {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes ui-pop-in {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.94);
  }

  70% {
    opacity: 1;
    transform: translateY(-1px) scale(1.02);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

- [ ] **Step 4: Run formatting/lint smoke check**

Run:

```bash
cd chat && npm run lint
```

Expected: PASS with no ESLint errors. CSS is not linted by ESLint, but this confirms the project still parses and no accidental JS/TS changes were introduced.

- [ ] **Step 5: Commit**

```bash
git add chat/src/styles/telegram.css chat/src/styles/base.css chat/src/styles/components.css
git commit -m "feat: add UI design tokens"
```

---

## Task 2: Upgrade Shared Buttons, Inputs, Panels, and Update Banner

**Files:**
- Modify: `chat/src/styles/components.css`
- Modify: `chat/src/App.vue`
- Test: `chat/src/App.test.ts`

### Goal

Make the existing shared building blocks feel tactile and polished, then improve the app update banner without changing update logic.

- [ ] **Step 1: Add a failing update banner structure test**

In `chat/src/App.test.ts`, add this test inside the existing `describe('App', ...)` block. Use the file's existing mocks and setup patterns for update checks. If the file already has update tests, place this near them.

```ts
it('renders the app update prompt as a floating notice with refresh and dismiss actions', async () => {
  installMockTelegram();
  mockCheckForAppUpdate.mockResolvedValue({ updateAvailable: true, remoteVersion: '9.9.9' });

  render(App, {
    global: {
      plugins: [createTestingPinia()],
    },
  });

  const notice = await screen.findByRole('status');
  expect(notice).toHaveClass('app-update-banner', 'ui-notice');
  expect(notice).toHaveTextContent('9.9.9');
  expect(screen.getByRole('button', { name: /refresh/i })).toHaveClass('app-update-banner__button');
  expect(screen.getByRole('button', { name: /dismiss/i })).toHaveClass('app-update-banner__dismiss');
});
```

If `mockCheckForAppUpdate`, `App`, `render`, `screen`, `installMockTelegram`, or `createTestingPinia` have different names in the existing file, use the already-defined names from `App.test.ts`. Do not create duplicate mocks.

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd chat && npm run test:run -- src/App.test.ts
```

Expected: FAIL because the banner does not yet include the `ui-notice` class.

- [ ] **Step 3: Update `App.vue` banner classes and close label glyph**

Change the `<aside>` opening tag in `chat/src/App.vue` from:

```vue
<aside
  v-if="updatePromptVisible"
  class="app-update-banner"
  role="status"
  aria-live="polite"
>
```

To:

```vue
<aside
  v-if="updatePromptVisible"
  class="app-update-banner ui-notice ui-notice--success"
  role="status"
  aria-live="polite"
>
```

Change the dismiss button content from:

```vue
x
```

To:

```vue
×
```

- [ ] **Step 4: Upgrade shared button, input, panel, and banner CSS**

In `chat/src/styles/components.css`, replace the `.app-button`, `.app-button-secondary`, and `.app-button:disabled` blocks with:

```css
.app-button {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid color-mix(in srgb, var(--tg-button) 18%, transparent);
  border-radius: var(--tg-radius-sm);
  background:
    linear-gradient(180deg, color-mix(in srgb, #fff 14%, transparent), transparent),
    var(--tg-button);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--tg-button) 20%, transparent);
  color: var(--tg-button-text);
  cursor: pointer;
  font-weight: 800;
}

.app-button:hover:not(:disabled),
.app-button:focus-visible:not(:disabled) {
  box-shadow:
    var(--tg-focus-ring),
    0 12px 26px color-mix(in srgb, var(--tg-button) 24%, transparent);
  transform: translateY(-1px);
}

.app-button-secondary {
  border: 1px solid var(--tg-border);
  background: color-mix(in srgb, var(--tg-panel) 72%, transparent);
  box-shadow: var(--tg-shadow-subtle);
  color: var(--tg-text);
}

.app-button-secondary:hover:not(:disabled),
.app-button-secondary:focus-visible:not(:disabled) {
  border-color: color-mix(in srgb, var(--tg-button) 42%, var(--tg-border));
  background: color-mix(in srgb, var(--tg-button) 9%, var(--tg-panel));
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
  box-shadow: none;
}
```

Replace the `.room-panel` block with:

```css
.room-panel {
  display: grid;
  gap: 14px;
  margin: 14px 0;
  padding: 16px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-lg);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--tg-button) 5%, transparent), transparent 42%),
    var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-subtle);
  animation: ui-enter-up var(--tg-motion-normal) var(--tg-ease-spring) both;
}
```

Replace the `.room-direct-join__input` block with:

```css
.room-direct-join__input {
  min-width: 0;
  min-height: 44px;
  padding: 0 13px;
  border: 1px solid var(--tg-border);
  border-radius: var(--tg-radius-sm);
  background: color-mix(in srgb, var(--tg-bg) 82%, var(--tg-panel));
  color: var(--tg-text);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent);
}

.room-direct-join__input:focus-visible {
  border-color: color-mix(in srgb, var(--tg-button) 58%, var(--tg-border));
  background: var(--tg-panel);
}
```

Append this banner styling near existing app-level styles:

```css
.app-update-banner {
  position: fixed;
  right: 14px;
  bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  left: 14px;
  z-index: 50;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  max-width: 760px;
  margin: 0 auto;
  animation: ui-pop-in var(--tg-motion-normal) var(--tg-ease-spring) both;
}

.app-update-banner__button,
.app-update-banner__dismiss {
  min-height: 36px;
  border: 0;
  border-radius: var(--tg-radius-pill);
  cursor: pointer;
  font-weight: 800;
}

.app-update-banner__button {
  padding: 0 14px;
  background: var(--tg-button);
  color: var(--tg-button-text);
}

.app-update-banner__dismiss {
  width: 36px;
  background: color-mix(in srgb, var(--tg-text) 8%, transparent);
  color: var(--tg-text);
  font-size: 1.2rem;
  line-height: 1;
}
```

- [ ] **Step 5: Run focused test**

Run:

```bash
cd chat && npm run test:run -- src/App.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run lint**

Run:

```bash
cd chat && npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add chat/src/App.vue chat/src/App.test.ts chat/src/styles/components.css
git commit -m "feat: polish shared UI controls"
```

---

## Task 3: Upgrade Room List Entry Hub

**Files:**
- Modify: `chat/src/rooms/components/RoomListView.vue`
- Modify: `chat/src/rooms/components/RoomListItem.vue`
- Modify: `chat/src/styles/components.css`
- Test: `chat/src/rooms/components/RoomListView.test.ts`
- Create if needed: `chat/src/rooms/components/RoomListItem.test.ts`

### Goal

Make the room list page feel like a polished entry hub with better header hierarchy, room card affordance, skeleton loading, and friendly empty state.

- [ ] **Step 1: Add failing tests for loading skeleton and empty state**

In `chat/src/rooms/components/RoomListView.test.ts`, add these tests after the existing test:

```ts
it('renders skeleton room cards while rooms are loading', () => {
  mocks.roomStore.loading = true;

  const { container } = render(RoomListView);

  expect(container.querySelectorAll('.room-list-skeleton .room-card-skeleton')).toHaveLength(3);
  expect(screen.queryByText('Empty')).not.toBeInTheDocument();
});

it('renders a friendly empty room state when no rooms are joined', () => {
  mocks.roomStore.loading = false;
  mocks.roomStore.rooms = [];

  const { container } = render(RoomListView);

  expect(container.querySelector('.rooms-empty-state')).toHaveClass('ui-empty-state');
  expect(screen.getByText('Empty')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/rooms/components/RoomListView.test.ts
```

Expected: FAIL because `.room-list-skeleton`, `.room-card-skeleton`, and `.rooms-empty-state` are not rendered.

- [ ] **Step 3: Update `RoomListView.vue` loading and empty markup**

Replace this block:

```vue
<p
  v-if="roomStore.loading"
  class="app-copy"
>
  {{ i18n.t('common.loading') }}
</p>
<p
  v-else-if="roomStore.rooms.length === 0"
  class="app-copy"
>
  {{ i18n.t('chat.empty') }}
</p>
```

With:

```vue
<div
  v-if="roomStore.loading"
  class="room-list-skeleton"
  :aria-label="i18n.t('common.loading')"
>
  <span
    v-for="index in 3"
    :key="index"
    class="room-card-skeleton ui-skeleton"
    aria-hidden="true"
  />
</div>
<div
  v-else-if="roomStore.rooms.length === 0"
  class="rooms-empty-state ui-empty-state"
>
  <strong>{{ i18n.t('chat.empty') }}</strong>
  <span>{{ i18n.t('rooms.directJoin') }}</span>
</div>
```

- [ ] **Step 4: Add room item metadata wrapper test**

Create `chat/src/rooms/components/RoomListItem.test.ts` with:

```ts
import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import RoomListItem from './RoomListItem.vue';

const entry = {
  room: {
    id: 'room-1',
    name: 'General',
    description: 'Daily chat',
  },
  sources: ['joined', 'owned'],
};

describe('RoomListItem', () => {
  it('renders a tactile room card with metadata and source badges', () => {
    const { container } = render(RoomListItem, {
      props: { entry },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a class="room-list-item" :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByRole('link', { name: /General/ })).toHaveClass('room-list-item');
    expect(container.querySelector('.room-list-item__meta')).toHaveTextContent('Daily chat');
    expect(container.querySelectorAll('.room-source-badge')).toHaveLength(2);
  });
});
```

- [ ] **Step 5: Run test to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/rooms/components/RoomListItem.test.ts
```

Expected: FAIL because `.room-list-item__meta` does not exist.

- [ ] **Step 6: Update `RoomListItem.vue` metadata structure**

Change:

```vue
<small>{{ entry.room.description ?? entry.room.id }}</small>
```

To:

```vue
<span class="room-list-item__meta">
  <small>{{ entry.room.description ?? entry.room.id }}</small>
  <small class="room-list-item__id">{{ entry.room.id }}</small>
</span>
```

- [ ] **Step 7: Add room hub CSS**

In `chat/src/styles/components.css`, update these existing selectors:

Replace `.rooms-shell` with:

```css
.rooms-shell {
  position: relative;
  width: min(100%, 820px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 20px;
  padding-top: calc(20px + var(--tg-content-safe-area-inset-top, 0px) + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)));
}

.rooms-shell::before {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(circle at 20% 8%, color-mix(in srgb, var(--tg-button) 14%, transparent), transparent 32%),
    radial-gradient(circle at 86% 18%, color-mix(in srgb, var(--tg-success) 9%, transparent), transparent 30%),
    var(--tg-bg);
  content: "";
}
```

Replace `.rooms-header` with:

```css
.rooms-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  margin-bottom: 20px;
  padding: 6px 2px;
}
```

Replace `.room-list-item, .room-invitation, .room-error` with:

```css
.room-list-item,
.room-invitation,
.room-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-subtle);
  color: var(--tg-text);
  text-decoration: none;
}

.room-list-item {
  animation: ui-enter-up var(--tg-motion-normal) var(--tg-ease-spring) both;
}

.room-list-item:hover,
.room-list-item:focus-visible {
  border-color: color-mix(in srgb, var(--tg-button) 34%, var(--tg-border));
  box-shadow: var(--tg-shadow-raised);
  transform: translateY(-2px);
}
```

Append:

```css
.room-list-item__meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.room-list-item__id {
  opacity: 0.74;
}

.room-list-skeleton {
  display: grid;
  gap: 8px;
}

.room-card-skeleton {
  height: 68px;
}

.rooms-empty-state {
  min-height: 96px;
}
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
cd chat && npm run test:run -- src/rooms/components/RoomListView.test.ts src/rooms/components/RoomListItem.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add chat/src/rooms/components/RoomListView.vue chat/src/rooms/components/RoomListView.test.ts chat/src/rooms/components/RoomListItem.vue chat/src/rooms/components/RoomListItem.test.ts chat/src/styles/components.css
git commit -m "feat: polish room entry hub"
```

---

## Task 4: Upgrade Room Join, Invitation, Error, and Create Panels

**Files:**
- Modify: `chat/src/rooms/components/RoomDirectJoin.vue`
- Modify: `chat/src/rooms/components/RoomInvitationList.vue`
- Modify: `chat/src/rooms/components/RoomErrorState.vue`
- Modify: `chat/src/rooms/components/RoomCreateDialog.vue`
- Modify: `chat/src/styles/components.css`
- Test: create `chat/src/rooms/components/RoomInvitationList.test.ts` if absent

### Goal

Make room entry panels consistent and action-oriented.

- [ ] **Step 1: Add invitation list structure test**

Create `chat/src/rooms/components/RoomInvitationList.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import RoomInvitationList from './RoomInvitationList.vue';

describe('RoomInvitationList', () => {
  it('renders invitations as action cards with accept and ignore buttons', async () => {
    const { container, emitted } = render(RoomInvitationList, {
      props: {
        invitations: [
          {
            id: 'invite-1',
            roomId: 'room-1',
            room: { id: 'room-1', name: 'General' },
          },
        ],
      },
    });

    expect(container.querySelector('.room-section')).toHaveClass('room-panel');
    expect(container.querySelector('.room-invitation__main')).toHaveTextContent('General');

    await fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(emitted('accept')).toEqual([['invite-1', 'room-1']]);
    expect(emitted('ignore')).toEqual([['invite-1']]);
  });
});
```

If the English i18n for direct join is not `Join` in the test environment, use the exact text currently rendered by `i18n.t('rooms.directJoin')`.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/rooms/components/RoomInvitationList.test.ts
```

Expected: FAIL because `.room-section` does not include `room-panel` and `.room-invitation__main` does not exist.

- [ ] **Step 3: Update `RoomInvitationList.vue` structure**

Change:

```vue
<section
  v-if="invitations.length > 0"
  class="room-section"
>
```

To:

```vue
<section
  v-if="invitations.length > 0"
  class="room-section room-panel"
>
```

Change:

```vue
<span>{{ invitation.room?.name ?? invitation.roomId ?? invitation.id }}</span>
```

To:

```vue
<span class="room-invitation__main">
  <strong>{{ invitation.room?.name ?? invitation.roomId ?? invitation.id }}</strong>
  <small>{{ invitation.room?.id ?? invitation.roomId ?? invitation.id }}</small>
</span>
```

- [ ] **Step 4: Update `RoomDirectJoin.vue` to expose panel description**

After the `<h2>` in `RoomDirectJoin.vue`, add:

```vue
<p class="app-copy room-panel__description">
  {{ i18n.t('rooms.directJoinPlaceholder') }}
</p>
```

- [ ] **Step 5: Update room error surface classes**

Open `RoomErrorState.vue`. Ensure the visible error container includes these classes:

```vue
class="room-error ui-notice ui-notice--error"
```

If the component currently renders a different root element, keep the element type and add the classes to that visible alert surface.

- [ ] **Step 6: Add panel CSS refinements**

Append to `chat/src/styles/components.css`:

```css
.room-panel__description {
  margin-top: -6px;
}

.room-invitation {
  align-items: flex-start;
}

.room-invitation__main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.room-invitation__main small {
  overflow: hidden;
  color: var(--tg-hint);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-error.ui-notice {
  align-items: flex-start;
  justify-content: flex-start;
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
cd chat && npm run test:run -- src/rooms/components/RoomInvitationList.test.ts src/rooms/components/RoomListView.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run lint**

Run:

```bash
cd chat && npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add chat/src/rooms/components/RoomDirectJoin.vue chat/src/rooms/components/RoomInvitationList.vue chat/src/rooms/components/RoomInvitationList.test.ts chat/src/rooms/components/RoomErrorState.vue chat/src/styles/components.css
git commit -m "feat: unify room entry states"
```

---

## Task 5: Upgrade Chat Shell and Header

**Files:**
- Modify: `chat/src/chat/components/ChatHeader.vue`
- Modify: `chat/src/chat/components/ChatRoomView.vue`
- Modify: `chat/src/styles/components.css`
- Test: `chat/src/chat/components/ChatHeader.test.ts`

### Goal

Make the chat header a glassy, tactile control bar with clearer connection status and menu polish.

- [ ] **Step 1: Add failing ChatHeader status semantic test**

In `chat/src/chat/components/ChatHeader.test.ts`, add:

```ts
it('renders connection status as a labelled status badge', () => {
  const { container } = render(ChatHeader, {
    props: {
      roomId: 'room-1',
      title: 'General',
      connectionStatus: 'degraded',
      canManageRoom: true,
    },
  });

  const badge = container.querySelector('.chat-header__status');
  expect(badge).toHaveClass('chat-header__status--degraded');
  expect(badge).toHaveAttribute('data-status', 'degraded');
  expect(badge).toHaveTextContent('HP');
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/ChatHeader.test.ts
```

Expected: FAIL because `data-status` is not present.

- [ ] **Step 3: Add status data attribute in `ChatHeader.vue`**

In the `<span class="chat-icon-button chat-header__status" ...>` element, add:

```vue
:data-status="connectionStatus"
```

The element should now include:

```vue
<span
  class="chat-icon-button chat-header__status"
  :class="{
    'chat-header__status--accent': connectionStatus === 'connected',
    'chat-header__status--breathing': true,
    'chat-header__status--degraded': connectionStatus !== 'connected',
  }"
  :data-status="connectionStatus"
  :style="{ '--chat-status-breathe-duration': statusBreatheDuration }"
  :aria-label="connectionStatus === 'connected' ? i18n.t('realtime.transportWs') : i18n.t('realtime.transportHp')"
  :title="connectionStatus === 'connected' ? i18n.t('realtime.transportWs') : i18n.t('realtime.transportHp')"
>
```

- [ ] **Step 4: Add chat shell decorative layer in `ChatRoomView.vue`**

Immediately inside `<main class="chat-room-shell">`, before `<div data-panel-region>`, add:

```vue
<div
  class="chat-room-shell__atmosphere"
  aria-hidden="true"
/>
```

- [ ] **Step 5: Replace chat shell/header CSS**

In `chat/src/styles/components.css`, replace `.chat-room-shell` with:

```css
.chat-room-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 820px);
  height: 100vh;
  height: calc(var(--tg-viewport-stable-height, 100vh));
  min-height: 100vh;
  min-height: calc(var(--tg-viewport-stable-height, 100vh));
  margin: 0 auto;
  padding-top: calc(var(--tg-content-safe-area-inset-top, 0px) + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)));
  overflow: hidden;
  background:
    linear-gradient(color-mix(in srgb, var(--tg-bg) 90%, transparent), color-mix(in srgb, var(--tg-bg) 94%, transparent)),
    radial-gradient(circle at 18px 18px, color-mix(in srgb, var(--tg-button) 12%, transparent) 0 1px, transparent 1.5px),
    var(--tg-bg);
  background-size: auto, 24px 24px, auto;
}

.chat-room-shell__atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 8%, color-mix(in srgb, var(--tg-button) 16%, transparent), transparent 28%),
    radial-gradient(circle at 88% 28%, color-mix(in srgb, var(--tg-success) 9%, transparent), transparent 32%);
}

.chat-room-shell > :not(.chat-room-shell__atmosphere) {
  position: relative;
}
```

Replace `.chat-header` with:

```css
.chat-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 10px 0;
  padding: 10px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-lg);
  background: var(--tg-surface-glass);
  box-shadow: var(--tg-shadow-subtle);
  backdrop-filter: blur(16px) saturate(1.2);
  flex: none;
}
```

Append:

```css
.chat-icon-button {
  min-width: 40px;
  min-height: 40px;
  border: 1px solid color-mix(in srgb, var(--tg-border) 80%, transparent);
  border-radius: var(--tg-radius-pill);
  background: color-mix(in srgb, var(--tg-panel) 72%, transparent);
  box-shadow: var(--tg-shadow-subtle);
  color: var(--tg-text);
  cursor: pointer;
}

.chat-icon-button:hover:not(:disabled),
.chat-icon-button:focus-visible:not(:disabled) {
  border-color: color-mix(in srgb, var(--tg-button) 42%, var(--tg-border));
  background: color-mix(in srgb, var(--tg-button) 10%, var(--tg-panel));
  transform: translateY(-1px);
}

.chat-header__status[data-status="connected"] {
  background: color-mix(in srgb, var(--tg-success) 12%, var(--tg-panel));
}

.chat-header__status[data-status="degraded"],
.chat-header__status[data-status="idle"] {
  background: color-mix(in srgb, var(--tg-warning) 13%, var(--tg-panel));
}
```

Update `.chat-header__more-menu` radius/background if needed:

```css
.chat-header__more-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  min-width: 190px;
  display: grid;
  gap: 4px;
  padding: 7px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-glass);
  box-shadow: var(--tg-shadow-floating);
  backdrop-filter: blur(16px) saturate(1.2);
  animation: ui-pop-in var(--tg-motion-fast) var(--tg-ease-spring) both;
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/ChatHeader.test.ts src/chat/components/ChatRoomView.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add chat/src/chat/components/ChatHeader.vue chat/src/chat/components/ChatHeader.test.ts chat/src/chat/components/ChatRoomView.vue chat/src/styles/components.css
git commit -m "feat: polish chat shell header"
```

---

## Task 6: Upgrade Message Timeline States and New Message Pill

**Files:**
- Modify: `chat/src/chat/components/MessageTimeline.vue`
- Modify: `chat/src/styles/components.css`
- Test: `chat/src/chat/components/MessageTimeline.test.ts`

### Goal

Improve loading older messages, empty timeline, and new message affordance without changing scroll preservation behavior.

- [ ] **Step 1: Add failing timeline loading and empty state tests**

In `chat/src/chat/components/MessageTimeline.test.ts`, add:

```ts
it('renders a skeleton loader while older messages are loading', () => {
  const { container } = render(MessageTimeline, {
    props: {
      entries: [],
      loadingOlder: true,
      hasMoreOlder: true,
      currentUserId: 'me',
      favoriteUserIds: [],
      mutedUserIds: [],
      mentionMembers: [],
    },
  });

  expect(container.querySelector('.message-timeline__loading')).toHaveClass('ui-skeleton');
});

it('renders an empty state when the timeline has no visible messages', () => {
  const { container } = render(MessageTimeline, {
    props: {
      entries: [],
      loadingOlder: false,
      hasMoreOlder: false,
      currentUserId: 'me',
      favoriteUserIds: [],
      mutedUserIds: [],
      mentionMembers: [],
    },
  });

  expect(container.querySelector('.message-timeline__empty')).toHaveClass('ui-empty-state');
  expect(screen.getByText('Empty')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/MessageTimeline.test.ts
```

Expected: FAIL because loading and empty state classes are not present.

- [ ] **Step 3: Update loading and empty markup in `MessageTimeline.vue`**

Replace:

```vue
<p
  v-if="loadingOlder"
  class="message-timeline__loading"
>
  {{ i18n.t('common.loading') }}
</p>
```

With:

```vue
<p
  v-if="loadingOlder"
  class="message-timeline__loading ui-skeleton"
  aria-live="polite"
>
  <span>{{ i18n.t('common.loading') }}</span>
</p>
```

Replace:

```vue
<p
  v-if="visibleEntries.length === 0"
  class="app-copy"
>
  {{ i18n.t('chat.empty') }}
</p>
```

With:

```vue
<div
  v-if="visibleEntries.length === 0"
  class="message-timeline__empty ui-empty-state"
>
  <strong>{{ i18n.t('chat.empty') }}</strong>
</div>
```

- [ ] **Step 4: Add timeline CSS**

Append or replace timeline-related CSS in `chat/src/styles/components.css`:

```css
.message-timeline {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 16px 14px 18px;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

.message-timeline__loading {
  align-self: center;
  width: min(70%, 260px);
  height: 28px;
  margin: 4px 0;
  color: transparent;
}

.message-timeline__loading span {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.message-timeline__empty {
  align-self: center;
  width: min(100%, 420px);
  margin: auto 0;
  text-align: center;
  justify-items: center;
}

.message-timeline__new-messages {
  position: sticky;
  bottom: 12px;
  align-self: center;
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--tg-button) 32%, var(--tg-border));
  border-radius: var(--tg-radius-pill);
  background: var(--tg-button);
  box-shadow: var(--tg-shadow-raised);
  color: var(--tg-button-text);
  cursor: pointer;
  font-weight: 800;
  animation: ui-pop-in var(--tg-motion-normal) var(--tg-ease-spring) both;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/MessageTimeline.test.ts
```

Expected: PASS, including the existing scroll preservation test.

- [ ] **Step 6: Commit**

```bash
git add chat/src/chat/components/MessageTimeline.vue chat/src/chat/components/MessageTimeline.test.ts chat/src/styles/components.css
git commit -m "feat: polish message timeline states"
```

---

## Task 7: Upgrade Message Bubbles, Rich Content, and Lightbox Styling

**Files:**
- Modify: `chat/src/chat/components/MessageBubble.vue`
- Modify: `chat/src/styles/components.css`
- Test: `chat/src/chat/components/MessageBubble.test.ts`

### Goal

Make own/incoming, pending, failed, referenced, focused, rich content, actions, and lightbox states visually clearer. Avoid changing message parsing or media fallback logic.

- [ ] **Step 1: Add failing pending/failed semantic class tests**

In `chat/src/chat/components/MessageBubble.test.ts`, add:

```ts
it('marks pending and failed messages with visual state classes', () => {
  const pending = renderBubble({
    kind: 'pending',
    localId: 'local-1',
    status: 'sending',
    message: {
      id: 'local-1',
      roomId: 'room-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'sending',
      user: { id: 'me', username: 'me' },
    },
  });
  const failed = renderBubble({
    kind: 'pending',
    localId: 'local-2',
    status: 'failed',
    message: {
      id: 'local-2',
      roomId: 'room-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'failed',
      user: { id: 'me', username: 'me' },
    },
  });

  expect(pending.container.querySelector('.message-bubble')).toHaveClass('message-bubble--sending');
  expect(failed.container.querySelector('.message-bubble')).toHaveClass('message-bubble--failed');
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/MessageBubble.test.ts
```

Expected: FAIL because `message-bubble--sending` and `message-bubble--failed` are not applied.

- [ ] **Step 3: Update `MessageBubble.vue` state classes**

In the root `<article class="message-bubble" :class="{ ... }">`, add these class bindings:

```vue
'message-bubble--sending': entry.kind === 'pending' && entry.status !== 'failed',
'message-bubble--failed': entry.kind === 'pending' && entry.status === 'failed',
```

The class object should include both new keys alongside existing own/incoming/pending/referenced classes.

- [ ] **Step 4: Add/replace message bubble CSS**

In `chat/src/styles/components.css`, update message bubble styling. If these selectors already exist, merge carefully so behavior is preserved:

```css
.message-bubble {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  max-width: min(92%, 620px);
  animation: ui-enter-up var(--tg-motion-normal) var(--tg-ease-spring) both;
}

.message-bubble--own {
  align-self: flex-end;
  grid-template-columns: minmax(0, 1fr) auto;
}

.message-bubble--own .message-bubble__avatar {
  display: none;
}

.message-bubble--incoming {
  align-self: flex-start;
}

.message-bubble__body {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-lg);
  background: var(--tg-message-incoming);
  box-shadow: var(--tg-shadow-subtle);
}

.message-bubble--own .message-bubble__body {
  border-color: var(--tg-message-own-border);
  border-bottom-right-radius: var(--tg-radius-xs);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--tg-button) 10%, transparent), transparent 46%),
    var(--tg-message-own);
}

.message-bubble--incoming .message-bubble__body {
  border-bottom-left-radius: var(--tg-radius-xs);
}

.message-bubble--sending .message-bubble__body {
  opacity: 0.82;
  animation: message-sending-pulse 1200ms var(--tg-ease-standard) infinite;
}

.message-bubble--failed .message-bubble__body {
  border-color: color-mix(in srgb, var(--tg-danger) 42%, var(--tg-border));
  background: var(--tg-surface-danger);
}

.message-bubble--focused .message-bubble__body {
  animation: message-focus-pulse 1400ms var(--tg-ease-spring) both;
}

@keyframes message-sending-pulse {
  50% {
    opacity: 1;
    transform: translateY(-1px);
  }
}

@keyframes message-focus-pulse {
  0%, 100% {
    box-shadow: var(--tg-shadow-subtle);
  }

  35% {
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--tg-button) 24%, transparent),
      var(--tg-shadow-raised);
  }
}

.message-reference,
.message-link-preview,
.message-file-link {
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-sm);
  background: color-mix(in srgb, var(--tg-button) 7%, var(--tg-panel));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--tg-button) 48%, transparent);
}

.message-reactions__item {
  border: 1px solid color-mix(in srgb, var(--tg-button) 26%, var(--tg-border));
  border-radius: var(--tg-radius-pill);
  background: color-mix(in srgb, var(--tg-button) 8%, var(--tg-panel));
}

.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(0, 0, 0, 0.76);
  backdrop-filter: blur(12px);
  animation: ui-enter-up var(--tg-motion-normal) var(--tg-ease-spring) both;
}

.image-lightbox__container {
  max-width: min(100%, 960px);
  max-height: min(100%, 82vh);
  border-radius: var(--tg-radius-lg);
  overflow: hidden;
  box-shadow: var(--tg-shadow-floating);
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/MessageBubble.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add chat/src/chat/components/MessageBubble.vue chat/src/chat/components/MessageBubble.test.ts chat/src/styles/components.css
git commit -m "feat: polish message bubbles"
```

---

## Task 8: Upgrade Composer Dock and Upload/Error Feedback

**Files:**
- Modify: `chat/src/chat/components/MessageComposer.vue`
- Modify: `chat/src/styles/components.css`
- Test: `chat/src/chat/components/MessageComposer.test.ts`

### Goal

Make the composer feel like a dock with clear send availability, upload/error feedback, and lively but accessible controls.

- [ ] **Step 1: Add failing composer state class test**

In `chat/src/chat/components/MessageComposer.test.ts`, add:

```ts
it('marks the composer as ready when text is present', async () => {
  const { container, getByPlaceholderText } = renderComposer();
  const input = getByPlaceholderText('Message') as HTMLTextAreaElement;

  expect(container.querySelector('.message-composer')).not.toHaveClass('message-composer--ready');

  await fireEvent.update(input, 'hello');

  expect(container.querySelector('.message-composer')).toHaveClass('message-composer--ready');
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/MessageComposer.test.ts
```

Expected: FAIL because `.message-composer--ready` is not applied.

- [ ] **Step 3: Add ready class to `MessageComposer.vue` root form**

Change:

```vue
<form
  class="message-composer"
  @submit.prevent="submit"
>
```

To:

```vue
<form
  class="message-composer"
  :class="{ 'message-composer--ready': text.trim() !== '' || uploads.length > 0 }"
  @submit.prevent="submit"
>
```

Change upload error class from:

```vue
class="chat-error"
```

To:

```vue
class="chat-error ui-notice ui-notice--error"
```

- [ ] **Step 4: Add composer CSS**

In `chat/src/styles/components.css`, add or replace composer blocks:

```css
.message-composer {
  position: relative;
  z-index: 3;
  display: grid;
  gap: 8px;
  flex: none;
  margin: 0 10px 10px;
  padding: 10px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-lg);
  background: var(--tg-surface-glass);
  box-shadow: var(--tg-shadow-raised);
  backdrop-filter: blur(16px) saturate(1.2);
}

.message-composer__row {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}

.message-composer__input {
  min-height: 42px;
  max-height: 150px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--tg-border);
  border-radius: var(--tg-radius-md);
  background: color-mix(in srgb, var(--tg-bg) 72%, var(--tg-panel));
  color: var(--tg-text);
  resize: none;
}

.message-composer__input:focus-visible {
  border-color: color-mix(in srgb, var(--tg-button) 58%, var(--tg-border));
  background: var(--tg-panel);
}

.message-composer--ready .chat-icon-button--send {
  border-color: color-mix(in srgb, var(--tg-button) 44%, var(--tg-border));
  background: var(--tg-button);
  color: var(--tg-button-text);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--tg-button) 24%, transparent);
}

.message-composer .chat-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
  transform: none;
}

.mention-suggestions,
.emoji-picker {
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-glass);
  box-shadow: var(--tg-shadow-floating);
  backdrop-filter: blur(16px) saturate(1.2);
  animation: ui-pop-in var(--tg-motion-fast) var(--tg-ease-spring) both;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/MessageComposer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add chat/src/chat/components/MessageComposer.vue chat/src/chat/components/MessageComposer.test.ts chat/src/styles/components.css
git commit -m "feat: polish message composer"
```

---

## Task 9: Unify Chat Panels, Rows, Menus, Reactions, and Reply Preview

**Files:**
- Modify: `chat/src/styles/components.css`
- Modify only if needed: `chat/src/chat/components/SearchPanel.vue`
- Modify only if needed: `chat/src/chat/components/KeySearchPanel.vue`
- Modify only if needed: `chat/src/chat/components/MembersPanel.vue`
- Modify only if needed: `chat/src/chat/components/FavoritePanel.vue`
- Modify only if needed: `chat/src/chat/components/BlockedUsersPanel.vue`
- Modify only if needed: `chat/src/chat/components/ReplyPreview.vue`
- Modify only if needed: `chat/src/chat/components/MessageActions.vue`
- Modify only if needed: `chat/src/chat/components/ReactionPicker.vue`
- Tests: existing component tests for changed components

### Goal

Make all functional panels and compact chat controls feel like one system. This task is CSS-first.

- [ ] **Step 1: Inspect panel classes before editing**

Run:

```bash
cd chat && grep -R "class=\"side-panel\|class=\"reply-preview\|class=\"message-actions\|class=\"reaction" -n src/chat/components src/rooms/components | sort
```

Expected: output lists panel and action classes. Use this to avoid adding duplicate CSS selectors.

- [ ] **Step 2: Add shared sheet panel CSS**

In `chat/src/styles/components.css`, replace or augment `.side-panel` with:

```css
.side-panel {
  display: grid;
  gap: 12px;
  flex: none;
  margin: 10px 14px 0;
  padding: 14px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-lg);
  background: var(--tg-surface-glass);
  box-shadow: var(--tg-shadow-raised);
  backdrop-filter: blur(16px) saturate(1.2);
  animation: ui-enter-up var(--tg-motion-normal) var(--tg-ease-spring) both;
}

.side-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 2px;
}

.side-panel__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.side-panel__list--scrollable {
  max-height: min(38vh, 320px);
  padding-right: 2px;
  padding-bottom: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}
```

- [ ] **Step 3: Add row/control CSS refinements**

Append:

```css
.member-row,
.search-result,
.key-search-result,
.favorite-row,
.blocked-user-row {
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: color-mix(in srgb, var(--tg-panel) 82%, transparent);
  box-shadow: var(--tg-shadow-subtle);
}

.reply-preview {
  border: 1px solid color-mix(in srgb, var(--tg-button) 26%, var(--tg-border));
  border-radius: var(--tg-radius-md);
  background: color-mix(in srgb, var(--tg-button) 8%, var(--tg-panel));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--tg-button) 54%, transparent);
  animation: ui-enter-up var(--tg-motion-fast) var(--tg-ease-spring) both;
}

.message-actions,
.sender-action-menu,
.reaction-picker {
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-glass);
  box-shadow: var(--tg-shadow-floating);
  backdrop-filter: blur(16px) saturate(1.2);
}
```

If any selector is unused after inspection, keep it only if it matches current class names. Do not invent selectors that no component uses.

- [ ] **Step 4: Run existing panel/action tests**

Run:

```bash
cd chat && npm run test:run -- src/chat/components/SearchPanel.test.ts src/chat/components/KeySearchPanel.test.ts src/chat/components/MessageActions.test.ts src/chat/components/ReplyPreview.test.ts
```

Expected: PASS. If a file does not exist in the repo, remove it from the command and run the remaining files.

- [ ] **Step 5: Run lint**

Run:

```bash
cd chat && npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add chat/src/styles/components.css
git commit -m "feat: unify chat panels"
```

If template files were required, include them in `git add` as well.

---

## Task 10: Upgrade Settings and Diagnostics Surfaces

**Files:**
- Modify: `chat/src/settings/components/SettingsView.vue`
- Modify: `chat/src/settings/components/DiagnosticsPanel.vue`
- Modify: `chat/src/styles/components.css`
- Test: `chat/src/settings/components/SettingsView.test.ts`
- Test: `chat/src/settings/components/DiagnosticsPanel.test.ts`

### Goal

Turn settings into grouped panels with clear status notices and make diagnostics readable inside a polished surface.

- [ ] **Step 1: Add failing settings panel structure test**

In `chat/src/settings/components/SettingsView.test.ts`, add:

```ts
it('groups settings controls inside a raised settings panel', () => {
  const { container } = render(SettingsView);

  expect(container.querySelector('.settings-panel')).toHaveClass('side-panel');
  expect(container.querySelector('.settings-sync-notice')).toBeInTheDocument();
});
```

Use the existing render helper/mocks in the file. If `render(SettingsView)` is not how the file renders the component, use the existing helper.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/settings/components/SettingsView.test.ts
```

Expected: FAIL because `.settings-panel` and `.settings-sync-notice` are not present.

- [ ] **Step 3: Update settings panel classes in `SettingsView.vue`**

Change:

```vue
<section class="side-panel">
```

To:

```vue
<section class="side-panel settings-panel">
```

Change the sync status wrapper from:

```vue
<div
  class="settings-field"
  aria-live="polite"
>
```

To:

```vue
<div
  class="settings-field settings-sync-notice ui-notice"
  :class="{
    'ui-notice--error': settings.syncStatus === 'failed',
    'ui-notice--success': settings.syncStatus === 'synced',
  }"
  aria-live="polite"
>
```

Change the last action paragraph from:

```vue
<p
  v-if="settings.lastAction != null"
  class="app-copy"
>
```

To:

```vue
<p
  v-if="settings.lastAction != null"
  class="app-copy ui-notice ui-notice--success"
>
```

- [ ] **Step 4: Add diagnostics surface CSS**

In `chat/src/styles/components.css`, append:

```css
.settings-panel {
  margin-top: 14px;
}

.settings-field {
  display: grid;
  gap: 6px;
}

.settings-sync-notice {
  margin-top: 4px;
}

.diagnostics-section {
  display: grid;
  gap: 0.75rem;
  padding: 12px;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-md);
  background: color-mix(in srgb, var(--tg-panel) 82%, transparent);
  box-shadow: var(--tg-shadow-subtle);
}

.diagnostics-output {
  max-height: 240px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--tg-soft-border);
  border-radius: var(--tg-radius-sm);
  background: color-mix(in srgb, #000 4%, var(--tg-bg));
  color: var(--tg-text);
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd chat && npm run test:run -- src/settings/components/SettingsView.test.ts src/settings/components/DiagnosticsPanel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add chat/src/settings/components/SettingsView.vue chat/src/settings/components/SettingsView.test.ts chat/src/styles/components.css
git commit -m "feat: polish settings surfaces"
```

Include `DiagnosticsPanel.vue` only if changed.

---

## Task 11: Upgrade Room Management Panel and Danger Zone

**Files:**
- Modify: `chat/src/rooms/components/RoomManagementPanel.vue`
- Modify: `chat/src/styles/components.css`
- Test: `chat/src/rooms/components/RoomManagementPanel.test.ts`

### Goal

Separate ordinary management actions from destructive actions using clear sections and danger styling.

- [ ] **Step 1: Add failing management structure test**

In `chat/src/rooms/components/RoomManagementPanel.test.ts`, add:

```ts
it('separates destructive room actions into a danger zone', () => {
  const { container } = render(RoomManagementPanel, {
    props: {
      roomId: 'room-1',
      error: null,
    },
  });

  expect(container.querySelector('.room-management__details')).toBeInTheDocument();
  expect(container.querySelector('.room-management__danger-zone')).toHaveClass('ui-notice--error');
  expect(container.querySelector('.room-management__collaboration')).toBeInTheDocument();
});
```

Use the existing render helper/mocks if the test file already has one.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd chat && npm run test:run -- src/rooms/components/RoomManagementPanel.test.ts
```

Expected: FAIL because the grouped section classes do not exist.

- [ ] **Step 3: Update `RoomManagementPanel.vue` grouped markup**

Replace the current template content inside `<section class="side-panel">` with this structure, preserving the existing form fields and emit calls:

```vue
<h2>{{ i18n.t('rooms.manage') }}</h2>
<div class="room-management__details">
  <form
    class="side-panel__form"
    @submit.prevent="$emit('update', { name: name.trim(), description: description.trim() })"
  >
    <input
      v-model="name"
      class="room-direct-join__input"
      :aria-label="i18n.t('rooms.name')"
      :placeholder="roomId"
    >
    <textarea
      v-model="description"
      class="message-composer__input"
      :aria-label="i18n.t('rooms.description')"
      :placeholder="i18n.t('rooms.description')"
    />
    <button
      class="app-button"
      type="submit"
    >
      {{ i18n.t('common.save') }}
    </button>
  </form>
</div>
<div class="room-management__collaboration ui-notice">
  <button
    class="app-button"
    type="button"
    @click="$emit('invite')"
  >
    {{ i18n.t('rooms.invitations') }}
  </button>
  <button
    class="app-button app-button-secondary"
    type="button"
    @click="$emit('mute')"
  >
    {{ i18n.t('rooms.mute') }}
  </button>
</div>
<div class="room-management__danger-zone ui-notice ui-notice--error">
  <button
    class="app-button app-button-secondary"
    type="button"
    @click="confirmLeave"
  >
    {{ i18n.t('rooms.leave') }}
  </button>
  <button
    class="app-button app-button-secondary"
    type="button"
    @click="confirmDelete"
  >
    {{ i18n.t('common.delete') }}
  </button>
</div>
<p
  v-if="error != null"
  class="chat-error ui-notice ui-notice--error"
>
  {{ error }}
</p>
```

Keep `<section class="side-panel">` as the root unless the existing test expects it.

- [ ] **Step 4: Add management CSS**

Append to `chat/src/styles/components.css`:

```css
.room-management__details,
.room-management__collaboration,
.room-management__danger-zone {
  display: grid;
  gap: 10px;
}

.room-management__collaboration,
.room-management__danger-zone {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.room-management__danger-zone .app-button-secondary {
  border-color: color-mix(in srgb, var(--tg-danger) 34%, var(--tg-border));
  color: var(--tg-danger);
}
```

- [ ] **Step 5: Run focused test**

Run:

```bash
cd chat && npm run test:run -- src/rooms/components/RoomManagementPanel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add chat/src/rooms/components/RoomManagementPanel.vue chat/src/rooms/components/RoomManagementPanel.test.ts chat/src/styles/components.css
git commit -m "feat: polish room management panel"
```

---

## Task 12: Add Reduced-Motion and Responsive Polish Pass

**Files:**
- Modify: `chat/src/styles/components.css`
- Modify: `chat/src/styles/base.css` if needed

### Goal

Ensure the rich motion is safe and responsive across mobile and desktop.

- [ ] **Step 1: Add reduced-motion component overrides**

Append to `chat/src/styles/components.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .room-panel,
  .room-list-item,
  .side-panel,
  .message-bubble,
  .message-composer,
  .message-timeline__new-messages,
  .app-update-banner,
  .mention-suggestions,
  .emoji-picker,
  .image-lightbox {
    animation: none !important;
  }

  .chat-header__status--breathing,
  .message-bubble--sending .message-bubble__body,
  .message-bubble--focused .message-bubble__body,
  .ui-skeleton::after {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Add responsive refinements**

Append:

```css
@media (min-width: 900px) {
  .rooms-shell {
    padding-inline: 28px;
  }

  .chat-room-shell {
    border-inline: 1px solid var(--tg-soft-border);
    box-shadow: var(--tg-shadow-floating);
  }
}

@media (max-width: 420px) {
  .rooms-shell {
    padding-inline: 14px;
  }

  .chat-header {
    margin-inline: 6px;
  }

  .chat-header__actions {
    gap: 4px;
  }

  .chat-icon-button {
    min-width: 38px;
    min-height: 38px;
  }

  .message-composer {
    margin-inline: 6px;
  }

  .message-composer__row {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    gap: 6px;
  }
}
```

- [ ] **Step 3: Run full frontend checks**

Run:

```bash
cd chat && npm run typecheck && npm run lint && npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add chat/src/styles/components.css chat/src/styles/base.css
git commit -m "feat: add responsive motion safeguards"
```

Only include `base.css` if changed in this task.

---

## Task 13: Add Visual Regression Smoke Coverage

**Files:**
- Modify or create: `chat/tests/ui-optimization.spec.ts` if a `tests/` directory exists
- Otherwise create: `chat/e2e/ui-optimization.spec.ts` and update Playwright config only if it currently points elsewhere
- No production files unless test config requires it

### Goal

Add browser-level smoke coverage for the most important UI surfaces. Keep the tests deterministic and non-invasive.

- [ ] **Step 1: Inspect Playwright test location**

Run:

```bash
cd chat && find . -maxdepth 3 -type f \( -name "*.spec.ts" -o -name "*.e2e.ts" \) | sort
```

Expected: shows existing Playwright tests if present. Use the same directory. If none exist, create `chat/tests/ui-optimization.spec.ts`.

- [ ] **Step 2: Create visual smoke test file**

Create the selected test file with:

```ts
import { expect, test } from '@playwright/test';

const viewports = [
  { width: 375, height: 812, name: 'mobile' },
  { width: 1024, height: 768, name: 'desktop' },
];

for (const viewport of viewports) {
  test(`rooms page renders polished shell at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/rooms');

    await expect(page.locator('.rooms-shell')).toBeVisible();
    await expect(page.locator('.rooms-header')).toBeVisible();
    await expect(page.locator('.room-panel').first()).toBeVisible();
  });
}

test('reduced motion preference still renders core UI', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/rooms');

  await expect(page.locator('.rooms-shell')).toBeVisible();
  await expect(page.locator('.room-panel').first()).toBeVisible();
});
```

If the app blocks `/rooms` outside Telegram in Playwright, add the same Telegram mock initialization pattern used by existing Playwright tests in this repo. Do not bypass production gate code in app source.

- [ ] **Step 3: Run Playwright smoke test**

Run:

```bash
cd chat && npm run e2e -- ui-optimization.spec.ts
```

Expected: PASS. If the dev server is not configured to start automatically by `playwright.config.ts`, run the command recommended in the existing Playwright config comments.

- [ ] **Step 4: Commit**

```bash
git add chat/tests/ui-optimization.spec.ts chat/e2e/ui-optimization.spec.ts chat/playwright.config.ts
git commit -m "test: add UI optimization smoke coverage"
```

Only add files that exist or changed.

---

## Task 14: Final Verification, Review, and Fix Pass

**Files:**
- Modify as needed based on failures
- No planned production change unless checks expose an issue

### Goal

Run full validation, fix regressions, then request code review agents per project rules.

- [ ] **Step 1: Run full checks**

Run:

```bash
cd chat && npm run typecheck && npm run lint && npm run test:coverage && npm run build
```

Expected: PASS. Coverage should remain at or above the existing project threshold. If coverage tooling reports below 80%, add targeted tests for the changed components before continuing.

- [ ] **Step 2: Run E2E smoke checks**

Run:

```bash
cd chat && npm run e2e
```

Expected: PASS. If E2E cannot run in the environment, record the exact missing dependency or browser error in the final handoff and run `npm run build` successfully.

- [ ] **Step 3: Inspect changed files**

Run:

```bash
git status --short && git diff --stat
```

Expected: only intended UI, test, and plan files changed.

- [ ] **Step 4: Self-check against design spec**

Open `docs/superpowers/specs/2026-06-10-ui-optimization-design.md` and confirm the implementation covers:

- visual tokens and Telegram theme compatibility
- room list entry hub
- chat shell/header
- message timeline states
- message bubbles and lightbox
- composer dock
- functional panels
- settings/diagnostics
- room management danger zone
- global state feedback
- reduced-motion and responsive behavior

- [ ] **Step 5: Run required code review agents**

Use the repo rules after code changes:

1. Run `code-reviewer` on the full diff.
2. Run `typescript-reviewer` because Vue/TypeScript files changed.
3. Run `a11y-architect` because UI/accessibility changed.
4. Run `performance-optimizer` if the diff adds significant animations/background effects.

Address all CRITICAL and HIGH findings. Fix MEDIUM findings when practical.

- [ ] **Step 6: Commit review fixes**

If review fixes are needed:

```bash
git add chat/src chat/tests chat/e2e
git commit -m "fix: address UI optimization review findings"
```

If no fixes are needed, do not create an empty commit.

- [ ] **Step 7: Final handoff summary**

Prepare a final summary including:

- implemented UI areas
- test commands run and results
- known limitations, if any
- screenshots or Playwright artifact paths, if generated

---

## Execution Notes

- This plan intentionally keeps code changes CSS-first and template-light.
- If `components.css` becomes hard to navigate during implementation, split it only after a task boundary into focused files such as `styles/chat.css`, `styles/rooms.css`, and `styles/settings.css`, then update `chat/src/main.ts` imports. Do this only if the file becomes unmanageable; it is not required by default.
- If a proposed selector already exists with important behavior, merge the new properties rather than replacing unrelated rules.
- If a test command references a test file that does not exist, create the file only when the task requires new coverage; otherwise remove that file from the command and run the remaining focused tests.
