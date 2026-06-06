# Chat UX and Stability Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved one-month chat UX and stability roadmap for the `chat/` Telegram Mini App using only the existing frontend and current `dc.hhhl.cc` API surface.

**Architecture:** Keep ownership in the current Vue/Pinia modules. Add small helpers for draft persistence and search highlighting, keep composer UI presentational, keep send/retry reconciliation in `chatStore`, move realtime scheduling into realtime lifecycle code, and use focused component/e2e tests for user-visible behavior.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite, Vitest, Testing Library Vue, Playwright, lucide-vue, localStorage adapter, existing `dc.hhhl.cc` endpoint wrappers.

---

## Scope Check

The design covers several weekly milestones, but they all touch the same chat Mini App UX and stability surface. This plan keeps them in one implementation plan while making each task independently shippable and independently commit-worthy. Execute tasks in order because later tasks rely on earlier state and event interfaces.

## File Structure

Create:

- `chat/src/chat/drafts.ts` - local room-scoped draft persistence helper around `LocalStorageAdapter`.
- `chat/src/chat/drafts.test.ts` - unit tests for draft read/write/clear and malformed storage behavior.
- `chat/src/chat/searchHighlight.ts` - safe text-node search highlighting helper.
- `chat/src/chat/searchHighlight.test.ts` - unit tests for case-insensitive matching and escaping-by-construction.
- `chat/src/chat/components/MessageComposer.test.ts` - component tests for controlled drafts, upload validation, failed upload retry, and object URL cleanup.

Modify:

- `chat/src/chat/chatStore.ts` - return structured send results, pass upload progress, protect stale room loads, track search pagination.
- `chat/src/chat/chatStore.test.ts` - update send result assertions, add stale-room and search-pagination coverage.
- `chat/src/chat/components/MessageComposer.vue` - controlled draft text, local upload item state machine, validation error display, file-send request prop, object URL cleanup on unmount.
- `chat/src/chat/components/ChatRoomView.vue` - draft wiring, file-send wrapper, management action, visibility catch-up, stale-safe room loading, favorite feedback.
- `chat/src/chat/components/ChatHeader.vue` - direct search/members buttons and a compact more menu for favorites, key search, and room management.
- `chat/src/chat/components/SearchPanel.vue` - retained query, load-more button, empty state, safe highlighting.
- `chat/src/chat/components/FavoritePanel.vue` - clearer unresolved favorite state.
- `chat/src/chat/components/MessageActions.vue` - confirm before delete.
- `chat/src/rooms/components/RoomManagementPanel.vue` - confirm before leave/delete and use room management heading.
- `chat/src/realtime/realtimeClient.ts` - expose socket-open notifications.
- `chat/src/realtime/realtimeClient.test.ts` - cover socket-open callback.
- `chat/src/realtime/realtimeStore.ts` - idempotent degraded polling, connected recovery path, optional open callback wiring.
- `chat/src/realtime/realtimeStore.test.ts` - cover duplicate degraded starts and recovery stopping polling.
- `chat/src/realtime/pollingFallback.ts` - idempotent start, stop resets timer and failure count.
- `chat/src/realtime/pollingFallback.test.ts` - cover duplicate starts and stop behavior.
- `chat/src/i18n/messages.en.ts` and `chat/src/i18n/messages.zh.ts` - add visible strings.
- `chat/src/styles/components.css` - compact header more menu, upload failure row, toast/status, search highlight.
- `chat/tests/e2e/helpers.ts` - add mock options for upload failure, search pagination, and timeline request counting.
- `chat/tests/e2e/chat-happy-path.spec.ts` - update header action expectations and add search pagination assertions.
- `chat/tests/e2e/chat-ux-stability.spec.ts` - add draft restore, management entry, and catch-up tests.
- `chat/docs/release-checklist.md` - add roadmap acceptance paths.

Do not change:

- API endpoint contract fixtures unless a test discovers a real fixture mismatch.
- Auth token storage format.
- Drive settings sync schema.
- Long-term message-history persistence.

---

### Task 1: Room-Scoped Draft Persistence Helper

**Files:**
- Create: `chat/src/chat/drafts.ts`
- Create: `chat/src/chat/drafts.test.ts`

- [ ] **Step 1: Write the failing draft helper tests**

Create `chat/src/chat/drafts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LocalStorageAdapter } from '@/shared/storage';
import { clearRoomDraft, DRAFTS_KEY, readRoomDraft, saveRoomDraft } from './drafts';

function createStorage(initial: Record<string, unknown> = {}): LocalStorageAdapter & { raw: Map<string, unknown> } {
  const raw = new Map<string, unknown>(Object.entries(initial));

  return {
    raw,
    getToken: () => null,
    setToken: () => undefined,
    clearAuth: () => undefined,
    getJson: <T>(key: string, fallback: T) => raw.has(key) ? raw.get(key) as T : fallback,
    setJson: <T>(key: string, value: T) => { raw.set(key, value); },
    remove: (key: string) => { raw.delete(key); },
  };
}

describe('drafts', () => {
  it('saves, reads, and clears text drafts by room id', () => {
    const storage = createStorage();

    saveRoomDraft(storage, 'room-1', 'hello draft');
    saveRoomDraft(storage, 'room-2', 'other draft');

    expect(readRoomDraft(storage, 'room-1')).toBe('hello draft');
    expect(readRoomDraft(storage, 'room-2')).toBe('other draft');

    clearRoomDraft(storage, 'room-1');

    expect(readRoomDraft(storage, 'room-1')).toBe('');
    expect(readRoomDraft(storage, 'room-2')).toBe('other draft');
  });

  it('removes empty drafts and deletes the storage key when no drafts remain', () => {
    const storage = createStorage();

    saveRoomDraft(storage, 'room-1', 'hello');
    saveRoomDraft(storage, 'room-1', '');

    expect(readRoomDraft(storage, 'room-1')).toBe('');
    expect(storage.raw.has(DRAFTS_KEY)).toBe(false);
  });

  it('ignores malformed draft records and blank room ids', () => {
    const storage = createStorage({ [DRAFTS_KEY]: { 'room-1': 'hello', 'room-2': 42, '': 'bad' } });

    expect(readRoomDraft(storage, 'room-1')).toBe('hello');
    expect(readRoomDraft(storage, 'room-2')).toBe('');
    expect(readRoomDraft(storage, '')).toBe('');

    saveRoomDraft(storage, '', 'ignored');

    expect(readRoomDraft(storage, '')).toBe('');
  });
});
```

- [ ] **Step 2: Run the draft helper test to verify it fails**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/drafts.test.ts
```

Expected: FAIL because `chat/src/chat/drafts.ts` does not exist.

- [ ] **Step 3: Implement the draft helper**

Create `chat/src/chat/drafts.ts`:

```ts
import type { LocalStorageAdapter } from '@/shared/storage';

export const DRAFTS_KEY = 'hhhl-chat:drafts';

type DraftRecord = Record<string, string>;

function roomKey(roomId: string): string {
  return roomId.trim();
}

function normalizeDrafts(value: unknown): DraftRecord {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const drafts: DraftRecord = {};
  for (const [key, draft] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = roomKey(key);
    if (normalizedKey !== '' && typeof draft === 'string' && draft !== '') {
      drafts[normalizedKey] = draft;
    }
  }

  return drafts;
}

function readDrafts(storage: LocalStorageAdapter): DraftRecord {
  return normalizeDrafts(storage.getJson<unknown>(DRAFTS_KEY, {}));
}

function writeDrafts(storage: LocalStorageAdapter, drafts: DraftRecord): void {
  if (Object.keys(drafts).length === 0) {
    storage.remove(DRAFTS_KEY);
    return;
  }

  storage.setJson(DRAFTS_KEY, drafts);
}

export function readRoomDraft(storage: LocalStorageAdapter, roomId: string): string {
  const key = roomKey(roomId);
  if (key === '') {
    return '';
  }

  return readDrafts(storage)[key] ?? '';
}

export function saveRoomDraft(storage: LocalStorageAdapter, roomId: string, text: string): void {
  const key = roomKey(roomId);
  if (key === '') {
    return;
  }

  const drafts = readDrafts(storage);
  if (text === '') {
    delete drafts[key];
  } else {
    drafts[key] = text;
  }
  writeDrafts(storage, drafts);
}

export function clearRoomDraft(storage: LocalStorageAdapter, roomId: string): void {
  saveRoomDraft(storage, roomId, '');
}
```

- [ ] **Step 4: Run the draft helper test to verify it passes**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/drafts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit draft helper**

```bash
rtk git add chat/src/chat/drafts.ts chat/src/chat/drafts.test.ts
rtk git commit -m "feat(chat): add room draft storage"
```

---

### Task 2: Structured Send Results and Stale Room Guards

**Files:**
- Modify: `chat/src/chat/chatStore.ts`
- Modify: `chat/src/chat/chatStore.test.ts`

- [ ] **Step 1: Add failing chat store tests for send results and stale room loads**

Append these tests inside the existing `describe('chatStore', () => { ... })` block in `chat/src/chat/chatStore.test.ts`:

```ts
  it('returns structured text send results for success and failure', async () => {
    const successApi = createApi();
    const failingApi = createApi({
      createToRoom: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', successApi);

    const success = await store.sendText('hello', successApi, {
      idFactory: () => 'local-success',
      now: () => '2026-01-01T00:00:03.000Z',
    });
    const failure = await store.sendText('bye', failingApi, {
      idFactory: () => 'local-failure',
      now: () => '2026-01-01T00:00:04.000Z',
    });

    expect(success).toEqual({ ok: true, localId: 'local-success', serverId: 'm3' });
    expect(failure).toEqual({ ok: false, localId: 'local-failure', stage: 'send', error: 'send failed' });
  });

  it('returns upload-stage and send-stage file results separately', async () => {
    const uploadFailure = vi.fn(async () => {
      throw new Error('upload failed');
    });
    const sendFailureApi = createApi({
      createToRoom: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const uploadSuccess = vi.fn(async (_file: File, onProgress?: (progress: number) => void) => {
      onProgress?.(0.5);
      return { id: 'file-1', name: 'hello.txt' };
    });
    const progress = vi.fn();
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());

    const uploadResult = await store.sendFile(
      new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      { uploadFile: uploadFailure },
      createApi(),
      { idFactory: () => 'local-upload', now: () => '2026-01-01T00:00:03.000Z' },
      progress,
    );
    const sendResult = await store.sendFile(
      new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      { uploadFile: uploadSuccess },
      sendFailureApi,
      { idFactory: () => 'local-send', now: () => '2026-01-01T00:00:04.000Z' },
      progress,
    );

    expect(uploadResult).toEqual({ ok: false, stage: 'upload', error: 'upload failed' });
    expect(sendResult).toEqual({ ok: false, localId: 'local-send', stage: 'send', error: 'send failed' });
    expect(progress).toHaveBeenCalledWith(0.5);
  });

  it('ignores stale initial and newer responses after the active room changes', async () => {
    let resolveRoom1: (messages: ChatMessage[]) => void = () => {
      throw new Error('room-1 resolver was not set');
    };
    const room1Response = new Promise<ChatMessage[]>((resolve) => {
      resolveRoom1 = resolve;
    });
    const api = createApi({
      roomTimeline: vi.fn(async (roomId) => {
        if (roomId === 'room-1') {
          return room1Response;
        }
        return [{ ...message('m8'), roomId: 'room-2' }];
      }),
    });
    const store = useChatStore();

    const firstLoad = store.loadInitial('room-1', api);
    await store.loadInitial('room-2', api);
    resolveRoom1([{ ...message('m1'), roomId: 'room-1' }]);
    await firstLoad;

    expect(store.roomId).toBe('room-2');
    expect(store.timeline.map((entry) => entry.message.roomId)).toEqual(['room-2']);
  });
```

- [ ] **Step 2: Run the targeted store tests to verify they fail**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/chatStore.test.ts
```

Expected: FAIL because `sendText()` and `sendFile()` return `void`, progress is not passed, and stale responses are applied.

- [ ] **Step 3: Add structured result types and pass upload progress**

In `chat/src/chat/chatStore.ts`, add these interfaces after `FileUploadLike`:

```ts
export type SendTextResult =
  | { ok: true; localId: string; serverId: string }
  | { ok: false; localId?: string; stage: 'send'; error: string };

export type SendFileResult =
  | { ok: true; localId: string; serverId: string }
  | { ok: false; localId?: string; stage: 'upload' | 'send'; error: string };
```

Replace `uploadWith` with:

```ts
function uploadWith(uploadApi: FileUploadLike, file: File, onProgress?: (progress: number) => void): Promise<DriveFile> {
  if (uploadApi.uploadFile != null) {
    return uploadApi.uploadFile(file, onProgress);
  }

  if (uploadApi.upload != null) {
    return uploadApi.upload(file, onProgress);
  }

  throw new Error('Upload transport is not configured');
}
```

- [ ] **Step 4: Return send results from `sendText()`**

Replace the `sendText` action body signature and return paths with:

```ts
    async sendText(text: string, api: ChatApiLike = createDefaultChatApi(), options: SendOptions = {}): Promise<SendTextResult> {
      if (this.roomId == null || text.trim() === '') {
        return { ok: false, stage: 'send', error: 'Message is empty or room is not selected' };
      }

      const localId = (options.idFactory ?? defaultIdFactory)();
      const capturedRoomId = this.roomId;
      const capturedReply = this.replyTarget;
      const capturedQuote = this.quoteTarget;
      const pending = createPendingMessage({
        localId,
        roomId: capturedRoomId,
        text: text.trim(),
        replyId: capturedReply?.id,
        quoteId: capturedQuote?.id,
        createdAt: (options.now ?? (() => new Date().toISOString()))(),
      });

      pending.localMessage = withComposerContext(pending.localMessage, capturedReply, capturedQuote);
      this.outgoing = [...this.outgoing, pending];
      this.timeline = mergeTimeline(this.timeline, [{ ...pending.localMessage }]);
      this.timeline = this.timeline.map((entry) => entry.message.id === localId ? { kind: 'pending', localId, message: pending.localMessage, status: 'pending' } : entry);
      this.clearComposerContext();

      try {
        const serverMessage = withComposerContext(await api.createToRoom(pending.payload), capturedReply, capturedQuote);
        if (this.roomId !== capturedRoomId) {
          return { ok: true, localId, serverId: serverMessage.id };
        }
        this.outgoing = sendPendingMessage(this.outgoing, localId, serverMessage.id);
        this.timeline = replacePendingMessage(this.timeline, localId, serverMessage);
        return { ok: true, localId, serverId: serverMessage.id };
      } catch (error) {
        const message = messageFromError(error);
        if (this.roomId === capturedRoomId) {
          this.outgoing = failPendingMessage(this.outgoing, localId, message);
          this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'failed', error: message } : entry);
          this.error = message;
        }
        return { ok: false, localId, stage: 'send', error: message };
      }
    },
```

- [ ] **Step 5: Return send results from `sendFile()`**

Replace the `sendFile` action signature and its upload call with:

```ts
    async sendFile(
      file: File,
      uploadApi: FileUploadLike = createDefaultFileApi(),
      api: ChatApiLike = createDefaultChatApi(),
      options: SendOptions = {},
      onProgress?: (progress: number) => void,
    ): Promise<SendFileResult> {
      if (this.roomId == null) {
        return { ok: false, stage: 'send', error: 'Room is not selected' };
      }

      const capturedRoomId = this.roomId;
      let uploaded: DriveFile;
      try {
        uploaded = normalizeUploadedFile(await uploadWith(uploadApi, file, onProgress));
      } catch (error) {
        const message = messageFromError(error);
        this.error = message;
        return { ok: false, stage: 'upload', error: message };
      }

      const localId = (options.idFactory ?? defaultIdFactory)();
      const capturedReply = this.replyTarget;
      const capturedQuote = this.quoteTarget;
      const pending = createPendingMessage({
        localId,
        roomId: capturedRoomId,
        fileId: uploaded.id,
        replyId: capturedReply?.id,
        quoteId: capturedQuote?.id,
        createdAt: (options.now ?? (() => new Date().toISOString()))(),
      });

      pending.localMessage.file = uploaded;
      pending.localMessage = withComposerContext(pending.localMessage, capturedReply, capturedQuote);
      this.outgoing = [...this.outgoing, pending];
      this.timeline = mergeTimeline(this.timeline, [{ ...pending.localMessage }]);
      this.timeline = this.timeline.map((entry) => entry.message.id === localId ? { kind: 'pending', localId, message: pending.localMessage, status: 'pending' } : entry);
      this.clearComposerContext();

      try {
        const serverMessage = withComposerContext(withUploadedFile(await api.createToRoom(pending.payload), uploaded), capturedReply, capturedQuote);
        if (this.roomId !== capturedRoomId) {
          return { ok: true, localId, serverId: serverMessage.id };
        }
        this.outgoing = sendPendingMessage(this.outgoing, localId, serverMessage.id);
        this.timeline = replacePendingMessage(this.timeline, localId, serverMessage);
        return { ok: true, localId, serverId: serverMessage.id };
      } catch (error) {
        const message = messageFromError(error);
        if (this.roomId === capturedRoomId) {
          this.outgoing = failPendingMessage(this.outgoing, localId, message);
          this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'failed', error: message } : entry);
          this.error = message;
        }
        return { ok: false, localId, stage: 'send', error: message };
      }
    },
```

- [ ] **Step 6: Guard stale timeline loads**

In `loadInitial()`, capture the requested room and only apply results for that room:

```ts
      const requestedRoomId = roomId;
      this.roomId = requestedRoomId;

      try {
        const messages = await api.roomTimeline(requestedRoomId, { limit: DEFAULT_PAGE_SIZE });
        if (this.roomId !== requestedRoomId) {
          return;
        }
        this.timeline = mergeTimeline([], messages);
        this.hasMoreOlder = messages.length > 0;
      } catch (error) {
        if (this.roomId === requestedRoomId) {
          this.error = messageFromError(error);
        }
      } finally {
        if (this.roomId === requestedRoomId) {
          this.loading = false;
        }
      }
```

In `loadOlder()` and `loadNewer()`, add `const requestedRoomId = this.roomId;` after guard checks, use `requestedRoomId` in the API call, and wrap timeline/error/final loading state mutations with `if (this.roomId === requestedRoomId)`.

- [ ] **Step 7: Run the targeted store tests to verify they pass**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/chatStore.test.ts src/chat/outgoingQueue.test.ts src/chat/timelineMerge.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit structured send results**

```bash
rtk git add chat/src/chat/chatStore.ts chat/src/chat/chatStore.test.ts
rtk git commit -m "feat(chat): return send results"
```

---

### Task 3: Controlled Composer Drafts and Object URL Cleanup

**Files:**
- Create: `chat/src/chat/components/MessageComposer.test.ts`
- Modify: `chat/src/chat/components/MessageComposer.vue`
- Modify: `chat/src/i18n/messages.en.ts`
- Modify: `chat/src/i18n/messages.zh.ts`
- Modify: `chat/src/styles/components.css`

- [ ] **Step 1: Write failing composer tests**

Create `chat/src/chat/components/MessageComposer.test.ts`:

```ts
import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MessageComposer from './MessageComposer.vue';

function renderComposer(props: Partial<InstanceType<typeof MessageComposer>['$props']> = {}) {
  return render(MessageComposer, {
    props: {
      replyTarget: null,
      quoteTarget: null,
      mentionMembers: [],
      draftText: '',
      ...props,
    },
  });
}

describe('MessageComposer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders draft text and emits draft changes', async () => {
    const { emitted, getByPlaceholderText, rerender } = renderComposer({ draftText: 'saved draft' });
    const input = getByPlaceholderText('Message') as HTMLTextAreaElement;

    expect(input.value).toBe('saved draft');

    await fireEvent.update(input, 'edited draft');

    expect(emitted('draft-change')?.at(-1)).toEqual(['edited draft']);

    await rerender({ draftText: 'restored room draft' });

    expect(input.value).toBe('restored room draft');
  });

  it('keeps failed uploads in the composer and allows retry', async () => {
    const sendFileRequest = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, stage: 'upload', error: 'upload failed' })
      .mockResolvedValueOnce({ ok: true, localId: 'local-file', serverId: 'm9' });
    renderComposer({ sendFileRequest });
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('upload failed')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }));

    await waitFor(() => {
      expect(sendFileRequest).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('upload failed')).not.toBeInTheDocument();
  });

  it('shows a file size validation error before sending', async () => {
    const sendFileRequest = vi.fn();
    renderComposer({ sendFileRequest });
    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.bin', { type: 'application/octet-stream' });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [oversized] } });

    expect(screen.getByText('File is larger than 25 MB.')).toBeInTheDocument();
    expect(sendFileRequest).not.toHaveBeenCalled();
  });

  it('revokes preview object URLs when uploads are removed and component unmounts', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const { unmount } = renderComposer();
    const image = new File(['image'], 'photo.png', { type: 'image/png' });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [image] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [image] } });
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run composer tests to verify they fail**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/components/MessageComposer.test.ts
```

Expected: FAIL because the composer does not accept `draftText`, does not emit `draft-change`, has no `sendFileRequest`, does not show validation errors, and does not revoke URLs on unmount.

- [ ] **Step 3: Add i18n strings**

In `chat/src/i18n/messages.en.ts`, add:

```ts
  'files.tooLarge': 'File is larger than 25 MB.',
  'files.uploadFailed': 'Upload failed: {error}',
```

In `chat/src/i18n/messages.zh.ts`, add:

```ts
  'files.tooLarge': '文件超过 25 MB。',
  'files.uploadFailed': '上传失败：{error}',
```

- [ ] **Step 4: Update composer props and emits**

In `MessageComposer.vue`, change imports:

```ts
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import {
  addUpload,
  failUpload,
  removeUpload,
  retryUpload,
  updateUploadProgress,
  validateUploadFile,
  type UploadItem,
} from '@/files/uploadQueue';
```

Replace the props and emits declarations with:

```ts
type FileSendRequest = (
  file: File,
  onProgress: (progress: number) => void,
) => Promise<
  | { ok: true; localId: string; serverId: string }
  | { ok: false; localId?: string; stage: 'upload' | 'send'; error: string }
>;

const props = defineProps<{
  replyTarget: ChatMessage | null;
  quoteTarget: ChatMessage | null;
  mentionMembers: UserSummary[];
  draftText?: string;
  sendFileRequest?: FileSendRequest;
}>();

const emit = defineEmits<{
  send: [text: string];
  clearContext: [];
  'draft-change': [text: string];
}>();
```

- [ ] **Step 5: Add draft and upload state behavior**

In `MessageComposer.vue`, replace the `text` and upload state declarations with:

```ts
const text = ref(props.draftText ?? '');
const uploads = ref<UploadItem[]>([]);
const uploadError = ref<string | null>(null);
const showEmojiPicker = ref(false);
const avatarFailedIds = reactive(new Set<string>());
```

Add these watchers and helpers after `mentionSuggestions`:

```ts
watch(() => props.draftText, (next) => {
  const value = next ?? '';
  if (value !== text.value) {
    text.value = value;
  }
});

watch(text, (next) => {
  emit('draft-change', next);
});

function revokePreview(item: UploadItem): void {
  if (item.previewUrl != null) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function setUploadProgress(id: string, progress: number): void {
  uploads.value = updateUploadProgress(uploads.value, id, progress);
}
```

Replace `addFiles()` with:

```ts
function addFiles(files: File[]): void {
  uploadError.value = null;
  for (const file of files) {
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      uploadError.value = i18n.t('files.tooLarge');
      continue;
    }

    uploads.value = addUpload(uploads.value, { id: uploadId(), file, previewUrl: previewUrl(file) });
  }
}
```

Replace `removeUploadItem()` with:

```ts
function removeUploadItem(id: string): void {
  const item = uploads.value.find((upload) => upload.id === id);
  if (item != null) {
    revokePreview(item);
  }
  uploads.value = removeUpload(uploads.value, id);
}
```

Add:

```ts
async function sendUploadItem(item: UploadItem): Promise<void> {
  if (props.sendFileRequest == null) {
    return;
  }

  uploads.value = retryUpload(uploads.value, item.id);
  const result = await props.sendFileRequest(item.file, (progress) => setUploadProgress(item.id, progress));

  if (result.ok) {
    removeUploadItem(item.id);
    return;
  }

  if (result.stage === 'send') {
    removeUploadItem(item.id);
    return;
  }

  uploads.value = failUpload(uploads.value, item.id, result.error);
}

async function retryUploadItem(id: string): Promise<void> {
  const item = uploads.value.find((upload) => upload.id === id);
  if (item != null) {
    await sendUploadItem(item);
  }
}

onBeforeUnmount(() => {
  for (const item of uploads.value) {
    revokePreview(item);
  }
});
```

Replace `submit()` with:

```ts
async function submit(): Promise<void> {
  const value = text.value.trim();

  if (value !== '') {
    emit('send', value);
    text.value = '';
  }

  for (const item of [...uploads.value]) {
    if (item.status !== 'uploading') {
      await sendUploadItem(item);
    }
  }
}
```

- [ ] **Step 6: Update composer template for upload errors and retry**

In `MessageComposer.vue`, change:

```vue
    <UploadProgressList
      :items="uploads"
      @remove="removeUploadItem"
    />
```

to:

```vue
    <UploadProgressList
      :items="uploads"
      @remove="removeUploadItem"
      @retry="retryUploadItem"
    />
    <p
      v-if="uploadError != null"
      class="chat-error"
      role="alert"
    >
      {{ uploadError }}
    </p>
```

- [ ] **Step 7: Update upload list and preview retry events**

In `chat/src/files/components/UploadProgressList.vue`, change emits to:

```ts
defineEmits<{
  remove: [id: string];
  retry: [id: string];
}>();
```

Change the `FileUploadPreview` usage to:

```vue
    <FileUploadPreview
      v-for="item in items"
      :key="item.id"
      :item="item"
      @remove="$emit('remove', $event)"
      @retry="$emit('retry', $event)"
    />
```

In `chat/src/files/components/FileUploadPreview.vue`, change emits to:

```ts
defineEmits<{
  remove: [id: string];
  retry: [id: string];
}>();
```

Add this after the file name:

```vue
    <span
      v-if="item.status === 'failed' && item.error != null"
      class="file-upload-preview__error"
    >
      {{ item.error }}
    </span>
    <button
      v-if="item.status === 'failed'"
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('files.retryUpload')"
      @click="$emit('retry', item.id)"
    >
      <RefreshCw :size="16" />
    </button>
```

Update imports:

```ts
import { RefreshCw, X } from '@lucide/vue';
```

- [ ] **Step 8: Add failed upload preview styling**

Add this block near the existing file upload preview styles in `chat/src/styles/components.css`:

```css
.file-upload-preview__error {
  min-width: 0;
  color: #d84f4f;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 9: Run composer tests to verify they pass**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/components/MessageComposer.test.ts src/chat/components/AvatarEntrypoints.test.ts src/files/uploadQueue.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit controlled composer behavior**

```bash
rtk git add chat/src/chat/components/MessageComposer.vue chat/src/chat/components/MessageComposer.test.ts chat/src/files/components/UploadProgressList.vue chat/src/files/components/FileUploadPreview.vue chat/src/i18n/messages.en.ts chat/src/i18n/messages.zh.ts chat/src/styles/components.css
rtk git commit -m "feat(chat): preserve composer draft state"
```

---

### Task 4: Wire Drafts and File Send Requests in ChatRoomView

**Files:**
- Modify: `chat/src/chat/components/ChatRoomView.vue`
- Modify: `chat/tests/e2e/chat-ux-stability.spec.ts`
- Modify: `chat/tests/e2e/helpers.ts`

- [ ] **Step 1: Add failing e2e coverage for draft restore and failed upload retention**

Create `chat/tests/e2e/chat-ux-stability.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { authorizeSession, installTelegramMock, mockApi } from './helpers';

test('room drafts survive reload and clear after successful send', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByPlaceholder('Message').fill('saved local draft');
  await page.reload();

  await expect(page.getByPlaceholder('Message')).toHaveValue('saved local draft');

  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('saved local draft')).toBeVisible();
  await page.reload();

  await expect(page.getByPlaceholder('Message')).toHaveValue('');
});

test('upload failures stay retryable in the composer', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { failFirstUpload: true });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('Select file').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });

  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('upload failed once')).toBeVisible();
  await page.getByRole('button', { name: 'Retry upload' }).click();
  await expect(page.getByText('upload failed once')).toHaveCount(0);
});
```

- [ ] **Step 2: Extend e2e mock API options**

In `chat/tests/e2e/helpers.ts`, extend `MockApiOptions`:

```ts
export interface MockApiOptions {
  failJoinRoomId?: string;
  failSearchContext?: boolean;
  failFirstUpload?: boolean;
}
```

Inside `mockApi()`, add immediately before `await page.route('**/*', async (route) => {`:

```ts
  let uploadAttempts = 0;
```

Inside the route handler after the `headers` constant is defined, add:

```ts
    if (endpoint === 'drive/files/create') {
      uploadAttempts += 1;
      if (options.failFirstUpload === true && uploadAttempts === 1) {
        await route.fulfill({ status: 500, headers, json: { error: { code: 'UPLOAD_FAILED', message: 'upload failed once' } } });
        return;
      }

      await route.fulfill({ headers, json: { id: 'uploaded-file-1', name: 'hello.txt', type: 'text/plain', url: '/files/hello.txt' } });
      return;
    }
```

- [ ] **Step 3: Run the new e2e tests to verify they fail**

Run:

```bash
rtk npm --prefix chat run e2e -- tests/e2e/chat-ux-stability.spec.ts
```

Expected: FAIL because drafts are not wired and failed uploads do not stay in the composer.

- [ ] **Step 4: Wire drafts in ChatRoomView**

In `ChatRoomView.vue`, add imports:

```ts
import { clearRoomDraft, readRoomDraft, saveRoomDraft } from '@/chat/drafts';
```

After `const settingsStore = useSettingsStore();`, add:

```ts
const localStorageAdapter = createLocalStorageAdapter();
const composerDraft = ref('');
```

Add helpers:

```ts
function restoreComposerDraft(): void {
  composerDraft.value = roomId.value === '' ? '' : readRoomDraft(localStorageAdapter, roomId.value);
}

function handleDraftChange(text: string): void {
  composerDraft.value = text;
  if (roomId.value !== '') {
    saveRoomDraft(localStorageAdapter, roomId.value, text);
  }
}

async function handleSendText(text: string): Promise<void> {
  const result = await chatStore.sendText(text);
  if (result.ok) {
    clearRoomDraft(localStorageAdapter, roomId.value);
    composerDraft.value = '';
  } else {
    saveRoomDraft(localStorageAdapter, roomId.value, text);
    composerDraft.value = text;
  }
}

async function handleSendFile(file: File, onProgress: (progress: number) => void) {
  return chatStore.sendFile(file, undefined, undefined, undefined, onProgress);
}
```

In `loadRoom()`, after `await chatStore.loadInitial(roomId.value);`, add:

```ts
    restoreComposerDraft();
```

Change the `MessageComposer` usage to:

```vue
    <MessageComposer
      ref="composerComponent"
      data-panel-keep-open
      :reply-target="chatStore.replyTarget"
      :quote-target="chatStore.quoteTarget"
      :mention-members="allKnownMembers"
      :draft-text="composerDraft"
      :send-file-request="handleSendFile"
      @send="handleSendText"
      @draft-change="handleDraftChange"
      @clear-context="chatStore.clearComposerContext()"
    />
```

- [ ] **Step 5: Run the new e2e tests to verify they pass**

Run:

```bash
rtk npm --prefix chat run e2e -- tests/e2e/chat-ux-stability.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit draft wiring**

```bash
rtk git add chat/src/chat/components/ChatRoomView.vue chat/tests/e2e/chat-ux-stability.spec.ts chat/tests/e2e/helpers.ts
rtk git commit -m "feat(chat): restore room composer drafts"
```

---

### Task 5: Header More Menu and Reachable Room Management

**Files:**
- Modify: `chat/src/chat/components/ChatHeader.vue`
- Modify: `chat/src/chat/components/ChatRoomView.vue`
- Modify: `chat/src/i18n/messages.en.ts`
- Modify: `chat/src/i18n/messages.zh.ts`
- Modify: `chat/src/styles/components.css`
- Modify: `chat/tests/e2e/chat-happy-path.spec.ts`
- Modify: `chat/tests/e2e/chat-ux-stability.spec.ts`

- [ ] **Step 1: Add failing e2e assertions for management entry**

Append this test to `chat/tests/e2e/chat-ux-stability.spec.ts`:

```ts
test('room management opens from the room header more menu', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByRole('button', { name: 'More room actions' }).click();
  await page.getByRole('menuitem', { name: 'Manage room' }).click();

  await expect(page.locator('.side-panel', { hasText: 'Manage room' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave room' })).toBeVisible();
});
```

In `chat/tests/e2e/chat-happy-path.spec.ts`, replace:

```ts
  await expect(page.getByRole('button', { name: 'Manage room' })).toHaveCount(0);
```

with:

```ts
  await page.getByRole('button', { name: 'More room actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Manage room' })).toBeVisible();
  await page.getByRole('button', { name: 'More room actions' }).click();
```

- [ ] **Step 2: Run e2e to verify management entry fails**

Run:

```bash
rtk npm --prefix chat run e2e -- tests/e2e/chat-ux-stability.spec.ts tests/e2e/chat-happy-path.spec.ts
```

Expected: FAIL because the header has no more menu or manage action.

- [ ] **Step 3: Add i18n strings**

In `chat/src/i18n/messages.en.ts`, add:

```ts
  'common.more': 'More',
  'chat.moreActions': 'More room actions',
```

In `chat/src/i18n/messages.zh.ts`, add:

```ts
  'common.more': '更多',
  'chat.moreActions': '更多房间操作',
```

- [ ] **Step 4: Replace ChatHeader with compact actions**

Update `ChatHeader.vue` script:

```ts
import { ref } from 'vue';
import { ArrowLeft, EllipsisVertical, Heart, KeyRound, Search, Settings, Users } from '@lucide/vue';
import { i18n } from '@/i18n';

defineProps<{
  roomId: string;
  title: string;
  degraded?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  search: [];
  keySearch: [];
  favorites: [];
  members: [];
  manage: [];
}>();

const showMore = ref(false);

function selectMore(action: 'keySearch' | 'favorites' | 'manage'): void {
  showMore.value = false;
  emit(action);
}
```

Replace the `.chat-header__actions` template with:

```vue
    <div class="chat-header__actions">
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.search')"
        @click="$emit('search')"
      >
        <Search :size="18" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('rooms.members')"
        @click="$emit('members')"
      >
        <Users :size="18" />
      </button>
      <div class="chat-header__more">
        <button
          class="chat-icon-button"
          type="button"
          :aria-label="i18n.t('chat.moreActions')"
          aria-haspopup="menu"
          :aria-expanded="showMore ? 'true' : 'false'"
          @click="showMore = !showMore"
        >
          <EllipsisVertical :size="18" />
        </button>
        <div
          v-if="showMore"
          class="chat-header__more-menu"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            @click="selectMore('favorites')"
          >
            <Heart :size="16" />
            <span>{{ i18n.t('chat.favorites') }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            @click="selectMore('keySearch')"
          >
            <KeyRound :size="16" />
            <span>{{ i18n.t('chat.keySearch') }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            @click="selectMore('manage')"
          >
            <Settings :size="16" />
            <span>{{ i18n.t('rooms.manage') }}</span>
          </button>
        </div>
      </div>
    </div>
```

- [ ] **Step 5: Wire manage event in ChatRoomView**

In `ChatRoomView.vue`, add to `ChatHeader`:

```vue
        @manage="toggleManage"
```

Add helper:

```ts
function toggleManage(): void {
  activePanel.value = activePanel.value === 'manage' ? null : 'manage';
}
```

- [ ] **Step 6: Add header menu CSS**

In `chat/src/styles/components.css`, add near `.chat-header__actions`:

```css
.chat-header__more {
  position: relative;
}

.chat-header__more-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  min-width: 176px;
  display: grid;
  gap: 4px;
  padding: 6px;
  border: 1px solid rgba(120, 144, 164, 0.24);
  border-radius: 8px;
  background: var(--tg-panel);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.chat-header__more-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  color: var(--tg-text);
  background: transparent;
  font: inherit;
  text-align: left;
}

.chat-header__more-menu button:hover,
.chat-header__more-menu button:focus-visible {
  background: rgba(42, 171, 238, 0.12);
  outline: none;
}
```

- [ ] **Step 7: Run e2e to verify management entry passes**

Run:

```bash
rtk npm --prefix chat run e2e -- tests/e2e/chat-ux-stability.spec.ts tests/e2e/chat-happy-path.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit header actions**

```bash
rtk git add chat/src/chat/components/ChatHeader.vue chat/src/chat/components/ChatRoomView.vue chat/src/i18n/messages.en.ts chat/src/i18n/messages.zh.ts chat/src/styles/components.css chat/tests/e2e/chat-happy-path.spec.ts chat/tests/e2e/chat-ux-stability.spec.ts
rtk git commit -m "feat(chat): expose room management actions"
```

---

### Task 6: Destructive Action Confirmations

**Files:**
- Modify: `chat/src/chat/components/MessageActions.vue`
- Modify: `chat/src/rooms/components/RoomManagementPanel.vue`
- Modify: `chat/src/chat/components/MessageActions.test.ts`
- Create: `chat/src/rooms/components/RoomManagementPanel.test.ts`
- Modify: `chat/src/i18n/messages.en.ts`
- Modify: `chat/src/i18n/messages.zh.ts`

- [ ] **Step 1: Add failing confirmation tests**

Append to `chat/src/chat/components/MessageActions.test.ts`:

```ts
  it('confirms before emitting delete', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { emitted } = render(MessageActions, {
      props: {
        message,
        canDelete: true,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));
    expect(emitted('delete')).toBeUndefined();

    await fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));
    expect(emitted('delete')).toEqual([['m1']]);
    expect(confirm).toHaveBeenCalledWith('Delete this message?');
  });
```

Create `chat/src/rooms/components/RoomManagementPanel.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import RoomManagementPanel from './RoomManagementPanel.vue';

describe('RoomManagementPanel', () => {
  it('confirms leave and delete before emitting destructive actions', async () => {
    const confirm = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { emitted } = render(RoomManagementPanel, {
      props: {
        roomId: 'room-1',
        error: null,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(emitted('leave')).toEqual([[]]);
    expect(emitted('delete')).toEqual([[]]);
    expect(confirm).toHaveBeenCalledWith('Leave this room?');
    expect(confirm).toHaveBeenCalledWith('Delete this room?');
  });
});
```

- [ ] **Step 2: Run confirmation tests to verify they fail**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/components/MessageActions.test.ts src/rooms/components/RoomManagementPanel.test.ts
```

Expected: FAIL because delete/leave actions emit without confirmation.

- [ ] **Step 3: Add confirmation i18n**

In `messages.en.ts`, add:

```ts
  'chat.confirmDeleteMessage': 'Delete this message?',
  'rooms.confirmLeave': 'Leave this room?',
  'rooms.confirmDelete': 'Delete this room?',
```

In `messages.zh.ts`, add:

```ts
  'chat.confirmDeleteMessage': '删除这条消息？',
  'rooms.confirmLeave': '离开这个房间？',
  'rooms.confirmDelete': '删除这个房间？',
```

- [ ] **Step 4: Add confirmation to MessageActions**

In `MessageActions.vue`, add:

```ts
function confirmDelete(): void {
  if (globalThis.confirm(i18n.t('chat.confirmDeleteMessage'))) {
    emit('delete', props.message.id);
  }
}
```

Change the delete button click:

```vue
      @click="confirmDelete"
```

- [ ] **Step 5: Add confirmation to RoomManagementPanel**

In `RoomManagementPanel.vue`, replace `defineEmits` with:

```ts
const emit = defineEmits<{
  update: [params: RoomUpdateParams];
  mute: [];
  leave: [];
  delete: [];
  invite: [];
}>();

function confirmLeave(): void {
  if (globalThis.confirm(i18n.t('rooms.confirmLeave'))) {
    emit('leave');
  }
}

function confirmDelete(): void {
  if (globalThis.confirm(i18n.t('rooms.confirmDelete'))) {
    emit('delete');
  }
}
```

Change leave and delete button handlers:

```vue
        @click="confirmLeave"
```

```vue
        @click="confirmDelete"
```

Also change heading:

```vue
    <h2>{{ i18n.t('rooms.manage') }}</h2>
```

- [ ] **Step 6: Run confirmation tests to verify they pass**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/components/MessageActions.test.ts src/rooms/components/RoomManagementPanel.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit confirmations**

```bash
rtk git add chat/src/chat/components/MessageActions.vue chat/src/chat/components/MessageActions.test.ts chat/src/rooms/components/RoomManagementPanel.vue chat/src/rooms/components/RoomManagementPanel.test.ts chat/src/i18n/messages.en.ts chat/src/i18n/messages.zh.ts
rtk git commit -m "feat(chat): confirm destructive actions"
```

---

### Task 7: State-Driven Realtime, Polling, and Visibility Catch-Up

**Files:**
- Modify: `chat/src/realtime/realtimeClient.ts`
- Modify: `chat/src/realtime/realtimeClient.test.ts`
- Modify: `chat/src/realtime/realtimeStore.ts`
- Modify: `chat/src/realtime/realtimeStore.test.ts`
- Modify: `chat/src/realtime/pollingFallback.ts`
- Modify: `chat/src/realtime/pollingFallback.test.ts`
- Modify: `chat/src/chat/components/ChatRoomView.vue`
- Modify: `chat/tests/e2e/chat-happy-path.spec.ts`

- [ ] **Step 1: Add failing realtime tests**

Append to `chat/src/realtime/realtimeStore.test.ts`:

```ts
  it('starts degraded polling once and stops polling when realtime reconnects', () => {
    const realtime = createRealtime();
    const polling = createPolling();
    const store = useRealtimeStore();

    store.startRoom('room-1', { realtime, polling, lastSeenId: () => 'm1', appendMessages: vi.fn() });
    store.markDegraded();
    store.markDegraded();
    store.markConnected();

    expect(polling.start).toHaveBeenCalledOnce();
    expect(polling.start).toHaveBeenCalledWith('room-1', 'm1');
    expect(polling.stop).toHaveBeenCalledOnce();
    expect(store.status).toBe('connected');
  });
```

Append to `chat/src/realtime/pollingFallback.test.ts`:

```ts
  it('restarting the same room replaces the previous timer instead of duplicating polling', async () => {
    const roomTimeline = vi.fn(async () => []);
    const polling = createPollingFallback({ roomTimeline, intervalMs: 1000 });

    polling.start('room-1', 'm1');
    polling.start('room-1', 'm1');
    await vi.advanceTimersByTimeAsync(1000);

    expect(roomTimeline).toHaveBeenCalledTimes(1);
  });
```

Append to `chat/src/realtime/realtimeClient.test.ts`:

```ts
  it('notifies listeners when the socket opens', () => {
    FakeWebSocket.instances = [];
    const opened = vi.fn();
    const client = createRealtimeClient({ tokenProvider: () => 'secret-token', WebSocketImpl: FakeWebSocket });

    client.onOpen(opened);
    client.connect();
    FakeWebSocket.instances[0]?.onopen?.();

    expect(opened).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: Run realtime tests to verify they fail**

Run:

```bash
rtk npm --prefix chat run test:run -- src/realtime
```

Expected: FAIL because `markConnected()` and `onOpen()` do not exist, and polling start is not idempotent.

- [ ] **Step 3: Add socket open listener support**

In `realtimeClient.ts`, add to `RealtimeClient`:

```ts
  onOpen: (callback: () => void) => () => void;
```

Inside `createRealtimeClient()`, add:

```ts
  const openListeners = new Set<() => void>();
```

Inside `nextSocket.onopen`, after `socketOpen = true;`, add:

```ts
        for (const listener of openListeners) {
          listener();
        }
```

Add the returned method:

```ts
    onOpen: (callback) => {
      openListeners.add(callback);
      return () => openListeners.delete(callback);
    },
```

- [ ] **Step 4: Update realtimeStore open wiring and idempotent degradation**

In `realtimeStore.ts`, add to `RealtimeClientLike`:

```ts
  onOpen?: (callback: () => void) => () => void;
```

Add module variable:

```ts
let unsubscribeOpen: (() => void) | null = null;
```

In `startRoom()`, before `onSocketFailure`, add:

```ts
      unsubscribeOpen = nextDependencies.realtime.onOpen?.(() => {
        this.markConnected();
      }) ?? null;
```

Replace `markDegraded()` with:

```ts
    markDegraded() {
      if (dependencies == null || this.roomId == null || this.status === 'degraded') {
        return;
      }

      this.status = 'degraded';
      dependencies.polling.start(this.roomId, dependencies.lastSeenId() ?? null);
    },

    markConnected() {
      if (dependencies == null || this.roomId == null) {
        return;
      }

      if (this.status === 'degraded') {
        dependencies.polling.stop();
      }
      this.status = 'connected';
    },
```

In `stopRoom()`, add cleanup:

```ts
      unsubscribeOpen?.();
```

and reset:

```ts
      unsubscribeOpen = null;
```

- [ ] **Step 5: Make polling start idempotent**

In `pollingFallback.ts`, replace `start` with:

```ts
    start: (nextRoomId, nextLastSeenId) => {
      clearTimer();
      roomId = nextRoomId;
      lastSeenId = nextLastSeenId ?? null;
      intervalMs = baseIntervalMs;
      schedule();
    },
```

In `stop`, add:

```ts
      socketFailures = 0;
      intervalMs = baseIntervalMs;
```

- [ ] **Step 6: Remove fixed newer polling and add visibility catch-up**

In `ChatRoomView.vue`, remove `newerPollTimer`, `stopNewerPolling()`, and `startNewerPolling()`.

Add:

```ts
async function catchUpVisibleRoom(): Promise<void> {
  if (roomId.value === '' || globalThis.document.visibilityState !== 'visible') {
    return;
  }

  await chatStore.loadNewer();
}

function handleVisibilityChange(): void {
  if (globalThis.document.visibilityState === 'visible') {
    void catchUpVisibleRoom();
  }
}
```

In `loadRoom()`, remove `stopNewerPolling();` and `startNewerPolling();`.

In `onMounted`, add:

```ts
  globalThis.document.addEventListener('visibilitychange', handleVisibilityChange);
```

In `onBeforeUnmount`, remove `stopNewerPolling();` and add:

```ts
  globalThis.document.removeEventListener('visibilitychange', handleVisibilityChange);
```

- [ ] **Step 7: Move the fixed-polling assertion out of the happy path**

In `chat/tests/e2e/chat-happy-path.spec.ts`, remove this assertion because foreground fixed polling is intentionally removed:

```ts
  await expect(page.getByText('latest')).toBeVisible();
```

The visibility restore test in Task 10 covers the `latest` catch-up message.

- [ ] **Step 8: Run realtime tests**

Run:

```bash
rtk npm --prefix chat run test:run -- src/realtime
```

Expected: PASS.

- [ ] **Step 9: Run chat room e2e smoke test**

Run:

```bash
rtk npm --prefix chat run e2e -- tests/e2e/chat-happy-path.spec.ts tests/e2e/chat-ux-stability.spec.ts
```

Expected: PASS. The happy path no longer depends on fixed foreground polling for the `latest` message.

- [ ] **Step 10: Commit realtime scheduling**

```bash
rtk git add chat/src/realtime/realtimeClient.ts chat/src/realtime/realtimeClient.test.ts chat/src/realtime/realtimeStore.ts chat/src/realtime/realtimeStore.test.ts chat/src/realtime/pollingFallback.ts chat/src/realtime/pollingFallback.test.ts chat/src/chat/components/ChatRoomView.vue chat/tests/e2e/chat-happy-path.spec.ts
rtk git commit -m "fix(chat): avoid fixed room polling"
```

---

### Task 8: Search Pagination State and Safe Highlighting

**Files:**
- Create: `chat/src/chat/searchHighlight.ts`
- Create: `chat/src/chat/searchHighlight.test.ts`
- Modify: `chat/src/chat/chatStore.ts`
- Modify: `chat/src/chat/chatStore.test.ts`
- Modify: `chat/src/chat/components/SearchPanel.vue`
- Modify: `chat/src/i18n/messages.en.ts`
- Modify: `chat/src/i18n/messages.zh.ts`
- Modify: `chat/src/styles/components.css`

- [ ] **Step 1: Write failing search highlighting tests**

Create `chat/src/chat/searchHighlight.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { splitSearchHighlight } from './searchHighlight';

describe('splitSearchHighlight', () => {
  it('splits text into safe text parts around case-insensitive matches', () => {
    expect(splitSearchHighlight('Hello hello', 'he')).toEqual([
      { text: 'He', match: true },
      { text: 'llo ', match: false },
      { text: 'he', match: true },
      { text: 'llo', match: false },
    ]);
  });

  it('returns one non-match part for empty query and treats regex characters literally', () => {
    expect(splitSearchHighlight('a+b a+b', 'a+b')).toEqual([
      { text: 'a+b', match: true },
      { text: ' ', match: false },
      { text: 'a+b', match: true },
    ]);
    expect(splitSearchHighlight('<b>hello</b>', '')).toEqual([
      { text: '<b>hello</b>', match: false },
    ]);
  });
});
```

- [ ] **Step 2: Add failing chat store pagination test**

Append to `chat/src/chat/chatStore.test.ts`:

```ts
  it('tracks search pagination and appends load-more results without duplicates', async () => {
    const api = createApi({
      search: vi.fn(async (params) => {
        if (params.untilId === 'm30') {
          return [message('m2'), message('m3')];
        }
        return Array.from({ length: 30 }, (_value, index) => message(`m${index + 1}`));
      }),
    });
    const store = useChatStore();

    await store.loadInitial('room-1', createApi());
    await store.searchMessages({ query: 'hello' }, api);
    await store.loadMoreSearchResults(api);

    expect(store.searchHasMore).toBe(false);
    expect(store.searchResults.map((item) => item.id).filter((id) => id === 'm2')).toHaveLength(1);
    expect(store.searchResults.at(-1)?.id).toBe('m3');
  });
```

- [ ] **Step 3: Run search tests to verify they fail**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/searchHighlight.test.ts src/chat/chatStore.test.ts
```

Expected: FAIL because the helper and `loadMoreSearchResults()` do not exist.

- [ ] **Step 4: Implement search highlight helper**

Create `chat/src/chat/searchHighlight.ts`:

```ts
export interface SearchHighlightPart {
  text: string;
  match: boolean;
}

export function splitSearchHighlight(text: string, query: string): SearchHighlightPart[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [{ text, match: false }];
  }

  const parts: SearchHighlightPart[] = [];
  const lower = text.toLowerCase();
  let cursor = 0;

  for (;;) {
    const index = lower.indexOf(needle, cursor);
    if (index < 0) {
      break;
    }

    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), match: false });
    }
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }

  return parts.length === 0 ? [{ text, match: false }] : parts;
}
```

- [ ] **Step 5: Add search pagination state**

In `ChatState`, add:

```ts
  searchHasMore: boolean;
```

In state init, add:

```ts
    searchHasMore: false,
```

In `clearSearch()`, add:

```ts
      this.searchHasMore = false;
```

Replace the assignment in `searchMessages()` with:

```ts
        const existingIds = new Set(isContinuation ? this.searchResults.map((message) => message.id) : []);
        const nextResults = isContinuation ? [...this.searchResults, ...results.filter((message) => !existingIds.has(message.id))] : results;
        this.searchQuery = query;
        this.searchKey = searchKey;
        this.searchResults = nextResults;
        this.searchHasMore = results.length >= (params.limit ?? DEFAULT_PAGE_SIZE);
```

Add action:

```ts
    async loadMoreSearchResults(api: ChatApiLike = createDefaultChatApi()) {
      if (this.searchQuery == null || this.searchResults.length === 0 || !this.searchHasMore || this.searchLoading) {
        return;
      }

      await this.searchMessages({
        query: this.searchQuery,
        untilId: this.searchResults.at(-1)?.id,
      }, api);
    },
```

- [ ] **Step 6: Add SearchPanel props, empty state, load more, and highlight**

In `SearchPanel.vue`, update props and emits:

```ts
const props = defineProps<{
  query: string | null;
  results: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  search: [query: string];
  loadMore: [];
  select: [messageId: string];
}>();
```

Update imports:

```ts
import { ref, watch } from 'vue';
import { displayMessageText } from '../messageText';
import { splitSearchHighlight } from '../searchHighlight';
```

Replace `const query = ref('');` with:

```ts
const query = ref(props.query ?? '');

watch(() => props.query, (next) => {
  query.value = next ?? '';
});
```

Add helpers:

```ts
function previewText(message: ChatMessage): string {
  return displayMessageText(message.text ?? message.file?.name ?? message.id);
}

function highlightedParts(message: ChatMessage) {
  return splitSearchHighlight(previewText(message), query.value);
}
```

In the template, add after the error paragraph:

```vue
    <p
      v-if="!loading && error == null && results.length === 0 && query.trim() !== ''"
      class="app-copy"
    >
      {{ i18n.t('chat.searchEmpty') }}
    </p>
```

Replace the search result text span:

```vue
          <span class="search-result-row__text">
            <template
              v-for="(part, index) in highlightedParts(message)"
              :key="`${message.id}-${index}-${part.text}`"
            >
              <mark v-if="part.match">{{ part.text }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </span>
```

Add after the list:

```vue
    <button
      v-if="hasMore"
      class="app-button app-button-secondary"
      type="button"
      :disabled="loading"
      @click="$emit('loadMore')"
    >
      {{ i18n.t('common.loadMore') }}
    </button>
```

- [ ] **Step 7: Wire SearchPanel in ChatRoomView**

Change the `SearchPanel` usage:

```vue
      <SearchPanel
        v-if="activePanel === 'search'"
        :query="chatStore.searchQuery"
        :results="chatStore.searchResults"
        :loading="chatStore.searchLoading"
        :error="chatStore.searchError"
        :has-more="chatStore.searchHasMore"
        @search="(query) => chatStore.searchMessages({ query })"
        @load-more="chatStore.loadMoreSearchResults()"
        @select="jumpToMessage"
      />
```

- [ ] **Step 8: Add i18n and CSS**

In `messages.en.ts`, add:

```ts
  'common.loadMore': 'Load more',
  'chat.searchEmpty': 'No messages found',
```

In `messages.zh.ts`, add:

```ts
  'common.loadMore': '加载更多',
  'chat.searchEmpty': '没有找到消息',
```

In `components.css`, add:

```css
.search-result-row__text mark {
  padding: 0 2px;
  border-radius: 3px;
  color: inherit;
  background: rgba(42, 171, 238, 0.24);
}
```

- [ ] **Step 9: Run search tests**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/searchHighlight.test.ts src/chat/chatStore.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit search pagination**

```bash
rtk git add chat/src/chat/searchHighlight.ts chat/src/chat/searchHighlight.test.ts chat/src/chat/chatStore.ts chat/src/chat/chatStore.test.ts chat/src/chat/components/SearchPanel.vue chat/src/chat/components/ChatRoomView.vue chat/src/i18n/messages.en.ts chat/src/i18n/messages.zh.ts chat/src/styles/components.css
rtk git commit -m "feat(chat): paginate message search"
```

---

### Task 9: Favorite Feedback and Panel Clarity

**Files:**
- Modify: `chat/src/chat/components/ChatRoomView.vue`
- Modify: `chat/src/chat/components/FavoritePanel.vue`
- Modify: `chat/src/chat/components/AvatarEntrypoints.test.ts`
- Modify: `chat/src/i18n/messages.en.ts`
- Modify: `chat/src/i18n/messages.zh.ts`
- Modify: `chat/src/styles/components.css`

- [ ] **Step 1: Add failing component test for favorite panel unresolved state**

Append to `chat/src/chat/components/AvatarEntrypoints.test.ts`:

```ts
  it('shows unresolved favorite count while favorite users are loading', () => {
    const { getByText } = render(FavoritePanel, {
      props: {
        members: [],
        favoriteUserIds: ['user-1', 'user-2'],
        loading: true,
      },
    });

    expect(getByText('Loading 2 favorite members...')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run favorite component test to verify it fails**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/components/AvatarEntrypoints.test.ts
```

Expected: FAIL because the panel only shows generic loading text.

- [ ] **Step 3: Add favorite feedback strings**

In `messages.en.ts`, add:

```ts
  'chat.favoriteAdded': 'Favorite added',
  'chat.favoriteRemoved': 'Favorite removed',
  'chat.loadingFavorites': 'Loading {count} favorite members...',
```

In `messages.zh.ts`, add:

```ts
  'chat.favoriteAdded': '已添加特别关注',
  'chat.favoriteRemoved': '已移除特别关注',
  'chat.loadingFavorites': '正在加载 {count} 个特别关注成员...',
```

- [ ] **Step 4: Add toast state and favorite wrapper in ChatRoomView**

In `ChatRoomView.vue`, add:

```ts
const feedbackMessage = ref<string | null>(null);
let feedbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
```

Add helper:

```ts
function showFeedback(message: string): void {
  feedbackMessage.value = message;
  if (feedbackTimer != null) {
    globalThis.clearTimeout(feedbackTimer);
  }
  feedbackTimer = globalThis.setTimeout(() => {
    feedbackMessage.value = null;
    feedbackTimer = null;
  }, 1600);
}

function toggleFavoriteUser(userId: string): void {
  const wasFavorite = settingsStore.favoriteUserIds.includes(userId);
  settingsStore.toggleFavoriteUser(userId);
  showFeedback(i18n.t(wasFavorite ? 'chat.favoriteRemoved' : 'chat.favoriteAdded'));
}
```

Import i18n:

```ts
import { i18n } from '@/i18n';
```

In `onBeforeUnmount`, add:

```ts
  if (feedbackTimer != null) {
    globalThis.clearTimeout(feedbackTimer);
  }
```

In the template, add after the chat error paragraph:

```vue
    <p
      v-if="feedbackMessage != null"
      class="key-copy-toast"
      role="status"
    >
      {{ feedbackMessage }}
    </p>
```

Change `@toggle-favorite="settingsStore.toggleFavoriteUser"` in `MessageTimeline` and `MembersPanel` to:

```vue
      @toggle-favorite="toggleFavoriteUser"
```

- [ ] **Step 5: Improve FavoritePanel unresolved loading**

In `FavoritePanel.vue`, add computed:

```ts
const unresolvedFavoriteCount = computed(() => props.favoriteUserIds.filter((userId) => !props.members.some((member) => member.id === userId)).length);
```

Replace the loading empty copy:

```vue
      {{ i18n.t('chat.loadingFavorites', { count: unresolvedFavoriteCount }) }}
```

- [ ] **Step 6: Run favorite tests**

Run:

```bash
rtk npm --prefix chat run test:run -- src/chat/components/AvatarEntrypoints.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit favorite feedback**

```bash
rtk git add chat/src/chat/components/ChatRoomView.vue chat/src/chat/components/FavoritePanel.vue chat/src/chat/components/AvatarEntrypoints.test.ts chat/src/i18n/messages.en.ts chat/src/i18n/messages.zh.ts chat/src/styles/components.css
rtk git commit -m "feat(chat): show favorite feedback"
```

---

### Task 10: E2E Search Pagination and Visibility Catch-Up

**Files:**
- Modify: `chat/tests/e2e/helpers.ts`
- Modify: `chat/tests/e2e/chat-happy-path.spec.ts`
- Modify: `chat/tests/e2e/chat-ux-stability.spec.ts`

- [ ] **Step 1: Extend mock options for search pagination and request counting**

In `chat/tests/e2e/helpers.ts`, extend `MockApiOptions`:

```ts
  paginatedSearch?: boolean;
```

In the `chat/messages/search` handler before the default search response, add:

```ts
      if (options.paginatedSearch === true && body.query === 'hello') {
        if (body.untilId === 'search-30') {
          await route.fulfill({ headers, json: [
            { id: 'search-31', roomId: 'amlc1bekzi', createdAt: '2025-12-31T23:59:31.000Z', text: 'older hello result', user: { id: 'user-2', username: 'bob', name: 'Bob' } },
          ] });
          return;
        }

        await route.fulfill({ headers, json: Array.from({ length: 30 }, (_value, index) => ({
          id: `search-${index + 1}`,
          roomId: 'amlc1bekzi',
          createdAt: `2025-12-31T23:59:${String(index).padStart(2, '0')}.000Z`,
          text: `hello result ${index + 1}`,
          user: { id: 'user-1', username: 'alice', name: 'Alice' },
        })) });
        return;
      }
```

- [ ] **Step 2: Add e2e search pagination test**

Append to `chat/tests/e2e/chat-ux-stability.spec.ts`:

```ts
test('search results paginate and keep normal search isolated from key search', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page, { paginatedSearch: true });
  await authorizeSession(page);

  await page.goto('/rooms/amlc1bekzi');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search messages').fill('hello');
  await page.getByRole('button', { name: 'Search', exact: true }).last().click();

  await expect(page.locator('.search-result-row')).toHaveCount(30);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.search-result-row', { hasText: 'older hello result' })).toBeVisible();

  await page.getByRole('button', { name: 'More room actions' }).click();
  await page.getByRole('menuitem', { name: 'Search keys' }).click();
  await expect(page.locator('.side-panel', { hasText: 'older hello result' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.search-result-row', { hasText: 'older hello result' })).toBeVisible();
});
```

- [ ] **Step 3: Add e2e visibility catch-up test**

Append to `chat/tests/e2e/chat-ux-stability.spec.ts`:

```ts
test('visible restore catches up newer messages without fixed foreground polling', async ({ page }) => {
  await installTelegramMock(page);
  await mockApi(page);
  await authorizeSession(page);

  const timelineRequests: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/chat/messages/room-timeline') && request.method() === 'POST') {
      timelineRequests.push(request.postDataJSON() as Record<string, unknown>);
    }
  });

  await page.goto('/rooms/amlc1bekzi');
  await page.waitForTimeout(3500);

  const foregroundRequests = timelineRequests.filter((body) => body.sinceId === 'm3');
  expect(foregroundRequests).toHaveLength(0);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.getByText('latest')).toBeVisible();
});
```

- [ ] **Step 4: Run e2e tests**

Run:

```bash
rtk npm --prefix chat run e2e -- tests/e2e/chat-ux-stability.spec.ts tests/e2e/chat-happy-path.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit e2e coverage**

```bash
rtk git add chat/tests/e2e/helpers.ts chat/tests/e2e/chat-happy-path.spec.ts chat/tests/e2e/chat-ux-stability.spec.ts
rtk git commit -m "test(chat): cover ux stability flows"
```

---

### Task 11: Release Checklist and Final Verification

**Files:**
- Modify: `chat/docs/release-checklist.md`

- [ ] **Step 1: Update release checklist**

In `chat/docs/release-checklist.md`, add these items under **Telegram Clients**:

```md
- [ ] Telegram iOS background restore returns to the current room and catches up newer messages.
- [ ] Returning from background does not create repeated foreground timeline polling.
```

Add these items under **Chat Features**:

```md
- [ ] Room text drafts survive refresh and room switching, then clear after successful send.
- [ ] File validation errors, upload failures, and message-send failures show distinct user-visible states.
- [ ] Failed uploads remain retryable in the composer.
- [ ] Search result pagination loads older results and keeps normal search separate from key search.
- [ ] Header actions fit on narrow mobile widths, with favorites, key search, and management reachable from more actions.
- [ ] Delete message, leave room, and delete room ask for confirmation before calling the API.
- [ ] Favorite toggles show a non-blocking status and the favorites panel distinguishes loading from empty states.
```

Add this section before **Final Commands**:

```md
## Performance Smoke

- [ ] A mocked 100-message room opens without visible layout instability.
- [ ] A mocked 300-message room scrolls, appends a new message, and loads older messages without obvious input delay on Telegram mobile.
- [ ] A mocked 1000-message room is measured and any visible jank is recorded as a follow-up virtualization decision.
- [ ] Image previews open and close without retaining stale previews after message changes.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
rtk npm --prefix chat run test:run
rtk npm --prefix chat run typecheck
rtk npm --prefix chat run e2e
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Inspect final git status**

Run:

```bash
rtk git status --short
```

Expected: only planned changes are present before the final commit.

- [ ] **Step 4: Commit checklist and any final fixes**

```bash
rtk git add chat/docs/release-checklist.md
rtk git commit -m "docs(chat): update ux stability checklist"
```

---

## Final Review Checklist

Run this checklist after Task 11:

- [ ] `chat/src/chat/drafts.ts` stores only room id to text mappings and never stores files, reply IDs, quote IDs, tokens, diagnostics, or Drive data.
- [ ] `MessageComposer.vue` clears text immediately for responsive UX, but `ChatRoomView.vue` restores draft text when `chatStore.sendText()` fails.
- [ ] Upload validation failure, upload transport failure, and message-send failure are distinguishable in UI and tests.
- [ ] `ChatRoomView.vue` no longer starts a fixed 3-second foreground newer-message interval.
- [ ] `pollingFallback.start()` is idempotent and `realtimeStore.markDegraded()` does not start duplicate polling loops.
- [ ] Search load-more uses the last result ID as `untilId`.
- [ ] Search highlighting uses Vue text interpolation and never writes HTML.
- [ ] Header actions are reachable at mobile width without overlapping the title, status label, or composer.
- [ ] Destructive confirmations leave state unchanged when cancelled.
- [ ] Release checklist contains the new draft, upload, realtime, search, management, favorite, and performance smoke paths.

## Execution Notes

Use `rtk` before shell commands in this repository.

Recommended task execution order is strict: Task 1 through Task 11. Each task has a commit so regressions can be bisected.

When implementation is complete, run:

```bash
rtk npm --prefix chat run test:run
rtk npm --prefix chat run typecheck
rtk npm --prefix chat run e2e
```
