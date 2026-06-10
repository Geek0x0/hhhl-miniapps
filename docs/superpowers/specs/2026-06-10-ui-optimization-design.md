# HHHL Chat Mini App UI Optimization Design

Date: 2026-06-10

## Scope

This design covers a complete UI experience upgrade for the `chat/` Telegram Mini App. It includes room discovery and entry, the chat room experience, settings and management panels, and shared loading, empty, error, success, disabled, and pending states.

The approved direction is **Telegram-native enhancement**: keep the familiar Telegram Mini App structure and theme compatibility, while adding stronger hierarchy, richer motion, clearer feedback, and a more polished product feel.

Implementation should be CSS-first with only small template adjustments where needed for decorative layers, state wrappers, skeletons, or clearer semantic grouping. Business logic, stores, API clients, routing, and data flow are outside this UI optimization scope unless a minimal template adjustment requires a small binding change.

## Project Context

The Mini App lives in `chat/` and uses Vue 3, Vite, Pinia, Vue Router, Vitest, and Playwright. Key UI files include:

- `chat/src/styles/base.css`
- `chat/src/styles/telegram.css`
- `chat/src/styles/components.css`
- `chat/src/rooms/components/RoomListView.vue`
- `chat/src/chat/components/ChatRoomView.vue`
- `chat/src/chat/components/ChatHeader.vue`
- `chat/src/chat/components/MessageTimeline.vue`
- `chat/src/chat/components/MessageBubble.vue`
- `chat/src/chat/components/MessageComposer.vue`
- `chat/src/settings/components/SettingsView.vue`
- `chat/src/settings/components/DiagnosticsPanel.vue`
- `chat/src/rooms/components/RoomManagementPanel.vue`
- `chat/src/App.vue`

The existing UI already defines Telegram theme variables, basic panels, buttons, room lists, chat bubbles, sticky chat header, and some motion such as connection status breathing and slide-up effects. The current experience is functional and lightweight, but visually plain and inconsistent across high-frequency states.

## Goals

1. Preserve Telegram Mini App familiarity and Telegram theme compatibility.
2. Improve visual hierarchy across rooms, chat, settings, panels, and status surfaces.
3. Add richer but controlled motion for page entry, panel transitions, message feedback, button press states, toasts, and loading states.
4. Make high-frequency actions feel responsive: joining rooms, opening panels, sending messages, retrying failures, searching, copying or delivering keys, and dismissing prompts.
5. Unify loading, empty, error, success/info, disabled, pending, and update states.
6. Keep the implementation maintainable by extending the existing CSS structure and avoiding unrelated business logic changes.
7. Support mobile and desktop Telegram/Web usage, with mobile touch behavior as the baseline and desktop layouts avoiding a sparse feel.

## Non-Goals

- Rewriting stores, API clients, realtime logic, routing, or authentication.
- Introducing a new UI framework or a large animation library.
- Replacing Telegram-native styling with a fully custom brand direction.
- Redesigning product flows or adding new product features.
- Removing existing i18n behavior, Telegram safe-area handling, or accessibility semantics.

## Design Direction

The visual direction is **Telegram-native enhancement with lively motion**.

The app should still feel like it belongs inside Telegram, using existing `--tg-*` variables as the base. The upgrade adds a product-quality layer: refined surfaces, softer hierarchy, clearer focus states, tactile buttons, more expressive cards, lively but purposeful transitions, and polished system feedback.

The result should be more complete and delightful without becoming visually noisy or unfamiliar.

## Visual System

### Theme Foundation

Continue using the existing Telegram variables:

- `--tg-bg`
- `--tg-text`
- `--tg-hint`
- `--tg-button`
- `--tg-button-text`
- `--tg-panel`
- `--tg-border`
- `--tg-soft-border`
- `--tg-message-incoming`
- `--tg-message-own`
- `--tg-message-own-border`
- `--tg-shadow`
- `--tg-danger`

Add experience tokens on top of these variables rather than replacing them. The new tokens should represent reusable design concepts, such as:

- surface levels: base, panel, raised, glass, danger, notice
- radius levels: small controls, cards, large panels, pills
- shadow levels: subtle, raised, floating
- focus ring styling
- state colors for success, warning, danger, info, online, degraded, connecting
- motion durations and easing curves
- skeleton and shimmer colors

These tokens should live primarily in `telegram.css` or a closely related style layer so components can remain simple and theme-compatible.

### Surfaces and Depth

Use soft borders, translucent overlays, and shadows to create clearer depth:

- Raised cards for rooms, invitations, settings groups, and management sections.
- Glass-like sticky surfaces for chat header and composer dock.
- Floating surfaces for menus, toast-like prompts, image lightbox controls, and update banners.
- Danger surfaces for destructive actions and critical errors.

The goal is to avoid all components sharing the same flat `8px` panel look.

### Background Atmosphere

Keep the Telegram-inspired chat background, but refine it with lightweight CSS-only layers:

- subtle radial glow using `--tg-button`
- soft pattern or dot texture at low opacity
- gentle gradients that preserve readability

The background must remain quiet behind messages and must not create contrast problems. Desktop widths should feel intentional rather than empty.

### Motion Tokens

Define reusable motion variables for:

- fast press feedback
- standard hover/focus transitions
- panel entrance
- toast entrance
- message entrance
- pulse or attention highlight

Motion should prefer compositor-friendly properties: `transform`, `opacity`, and occasional light `filter`. Avoid animating layout properties such as height, width, top, left, margin, or padding.

All non-essential motion must degrade under `prefers-reduced-motion: reduce`.

## Room List and Entry Experience

The room list should feel like a polished entry hub.

### Header

Keep the existing HHHL logo, `dc.hhhl.cc` eyebrow, and settings action. Improve hierarchy with:

- stronger title scale and spacing
- softer logo surface or glow
- clearer settings button shape and focus state
- balanced desktop spacing inside the existing content width

### Room Cards

Upgrade `RoomListItem` from a plain list row to a tactile clickable card:

- raised card styling
- clearer title, ID, and source badge hierarchy
- hover, focus-visible, and press feedback
- optional entry animation when the list first appears

The card should remain readable and accessible without requiring new business data.

### Join, Create, and Invitation Panels

Unify `RoomDirectJoin`, `RoomCreateDialog`, and `RoomInvitationList` with the shared panel system:

- clearer panel headers
- consistent input focus rings
- buttons with press and disabled states
- invitation cards that make the available action obvious
- consistent spacing and card rhythm

### Room States

Replace plain text-only states where appropriate:

- Loading: skeleton or shimmer rows.
- Empty: friendly explanation plus next action guidance.
- Error: alert surface with message and recovery/dismiss action.

The wording can continue to use existing i18n strings initially, with future copy improvements handled separately if needed.

## Chat Room Experience

The chat room is the primary high-frequency surface.

### Chat Shell and Header

Refine `ChatRoomView` and `ChatHeader`:

- maintain safe-area handling and current sticky behavior
- use a glassy sticky header surface with subtle backdrop blur
- increase clarity of room title and connection status
- make icon buttons more tactile and touch-friendly
- unify connection status badge colors and breathing animation with motion tokens

Connection states should be distinguishable by text and styling, not color alone.

### Message Timeline

`MessageTimeline` should feel smoother without changing scroll-anchor logic:

- loading older messages should use a refined loading indicator or skeleton
- new message count should become a floating pill with a lively entrance
- search jump focus should produce a clearer but temporary highlight pulse
- appending messages can use a light enter animation when motion is allowed

Scroll preservation and message filtering behavior must remain unchanged.

### Message Bubbles

`MessageBubble` should become more expressive while preserving content semantics:

- stronger own vs incoming distinction through surface, border, radius rhythm, and shadow
- pending state with subtle sending feedback
- failed state with warning styling and clear retry/remove actions
- refined metadata spacing and sender hierarchy
- consistent styling for references, mentions, reactions, file links, image previews, and link previews

Referenced and focused messages should use attention styling that is noticeable but temporary.

### Media and Lightbox

Image previews and lightbox should feel more polished:

- stronger overlay treatment
- floating close button with clear focus state
- image container entrance animation
- reduced-motion fallback

Dialog semantics and click-to-close behavior should remain accessible.

### Composer Dock

Upgrade `MessageComposer` into a bottom composer dock:

- safe-area-aware sticky/fixed-feeling bottom surface
- translucent or raised background separating it from the timeline
- clear text input affordance
- tactile attachment and send buttons
- distinct disabled, ready, sending, and error-adjacent states
- reply/quote preview as a compact card with slide/fade entrance

The composer should remain efficient on mobile keyboards and desktop Telegram/Web.

### Functional Panels

Search, key search, favorites, members, blocked users, and management panels should share a sheet-like panel treatment:

- consistent panel container
- slide/fade entrance
- internal rows with avatars, labels, helper text, and action buttons
- scroll boundaries for long lists
- unified empty, loading, and error styling

Panel switching should avoid abrupt visual jumps where possible.

## Settings, Diagnostics, and Management

### Settings View

`SettingsView` should use grouped raised panels:

- section heading and helper text hierarchy
- consistent controls and button alignment
- clear success/error feedback for sync or storage operations
- mobile-friendly spacing and desktop-friendly grouping

### Diagnostics Panel

`DiagnosticsPanel` should remain functional and readable:

- diagnostic output stays in a scrollable monospace region
- long content wraps safely
- container receives better surface treatment
- status messages use the shared notice system

### Room Management Panel

`RoomManagementPanel` should be organized by risk and task:

- normal room editing controls
- invitation/member-related actions
- mute/leave/delete as clearly separated high-risk actions

Destructive actions should use a danger surface and not appear visually equivalent to regular actions.

## Global State Feedback

Unify these state types across the app:

### Loading

Use lightweight spinner, skeleton, or shimmer depending on context:

- list loading: skeleton rows
- inline action loading: small spinner or button pending state
- panel loading: compact loading row

### Empty

Empty states should include:

- short explanation
- optional decorative icon or shape
- suggested next action when available

### Error

Errors should use alert surfaces with:

- clear message
- icon or label
- recovery, retry, or dismiss action when available

### Success and Info

Use inline notices or toast-like feedback for:

- copy success
- key delivery feedback
- update prompts
- save/sync success

### Disabled and Pending

Disabled controls should be visually distinct and non-interactive. Pending controls should communicate progress and prevent repeated action when appropriate.

### Update Banner

The existing update banner in `App.vue` should become a polished floating notice:

- clear version text
- primary refresh action
- obvious dismiss control
- status role retained
- mobile safe-area friendly placement

## Accessibility Requirements

1. Preserve semantic HTML and existing ARIA roles.
2. Keep or improve `:focus-visible` styling for buttons, inputs, cards, menus, panels, and lightbox controls.
3. Ensure touch targets are comfortable, especially header actions, message actions, composer controls, and dismiss buttons.
4. Do not communicate state by color alone; pair color with text, icon, shape, or label.
5. Support `prefers-reduced-motion: reduce` by disabling or simplifying:
   - message entrance animations
   - panel slide animations
   - staggered list animations
   - breathing and pulsing effects
   - shimmer effects
6. Keep contrast legible in light and dark Telegram themes.
7. Avoid adding decorative elements that are announced by screen readers; mark decorative imagery or effects as hidden where relevant.

## Performance Requirements

1. Do not add a large animation library.
2. Prefer CSS transitions and keyframes using `transform` and `opacity`.
3. Keep background effects lightweight and static or very lightly animated.
4. Avoid layout-bound animations.
5. Avoid excessive `will-change`; use it only where it materially helps and remove if unnecessary.
6. Maintain bundle budget expectations for a Mini App.
7. Preserve existing scroll performance in the message timeline.

## Testing and Validation

Implementation should be validated with the existing frontend tooling:

- `npm run typecheck`
- `npm run lint`
- `npm run test:run`
- `npm run build`

Visual and interaction checks should cover:

- mobile widths: 320, 375, 768
- desktop widths: 1024, 1440
- light and dark Telegram theme variables where practical
- reduced-motion mode
- keyboard focus through major controls
- room list loading, empty, error, invitation, and populated states
- chat timeline empty, loading older, new messages, pending send, failed send, search focus, media preview, and reactions
- settings and management normal, success, error, and destructive-action states

Playwright screenshots or manual browser screenshots should be used for the most important UI surfaces if the implementation phase has browser access.

## Implementation Boundaries

Expected implementation areas:

- Extend tokens and base behaviors in `chat/src/styles/telegram.css` and `chat/src/styles/base.css`.
- Refine component styles in `chat/src/styles/components.css`.
- Add minimal template wrappers or decorative/state elements in selected Vue components only when CSS alone cannot express the intended state.
- Keep files focused; extract additional CSS files only if `components.css` becomes difficult to maintain.

Avoid unrelated refactoring. If a component is touched, improvements should directly support the UI optimization described here.

## Risks and Mitigations

### Risk: Motion becomes distracting

Mitigation: Use motion tokens, keep durations short, and provide reduced-motion fallbacks.

### Risk: Telegram theme compatibility regresses

Mitigation: Build new styling from existing `--tg-*` variables and test with light/dark theme variables.

### Risk: CSS file grows too large

Mitigation: Keep sections organized by surface and extract focused CSS modules only if needed.

### Risk: Chat scroll performance suffers

Mitigation: Avoid layout animations in timeline items and preserve existing scroll-anchor logic.

### Risk: Visual changes break tests relying on text or structure

Mitigation: Prefer CSS-only changes and preserve semantic text, roles, and event wiring.

## Approval Status

Approved by the user for design documentation on 2026-06-10.
