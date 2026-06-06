import { defineStore } from 'pinia';
import { ApiClient } from '@/api/apiClient';
import { API_BASE_URL, DEFAULT_PAGE_SIZE } from '@/shared/config';
import { normalizeDriveFile } from '@/shared/driveFile';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { ChatMessage, DriveFile, PaginationParams } from '@/shared/types';
import { createUuid } from '@/shared/uuid';
import { createFileApi } from '@/files/fileApi';
import { createChatApi, type CreateRoomMessageParams, type SearchMessagesParams } from './chatApi';
import { createPendingMessage, failPendingMessage, removePendingMessage, retryPendingMessage, sendPendingMessage, type OutgoingMessage } from './outgoingQueue';
import { mergeTimeline, removeTimelineMessage, replacePendingMessage, type TimelineEntry } from './timelineMerge';

export interface ChatApiLike {
  roomTimeline: (roomId: string, params?: PaginationParams) => Promise<ChatMessage[]>;
  createToRoom: (params: CreateRoomMessageParams) => Promise<ChatMessage>;
  delete: (messageId: string) => Promise<unknown>;
  react: (messageId: string, reaction: string) => Promise<unknown>;
  unreact: (messageId: string) => Promise<unknown>;
  search: (params: SearchMessagesParams) => Promise<ChatMessage[]>;
  show?: (messageId: string) => Promise<ChatMessage>;
  context?: (messageId: string) => Promise<ChatMessage[]>;
}

export interface SendOptions {
  idFactory?: () => string;
  now?: () => string;
}

export interface FileUploadLike {
  uploadFile?: (file: File, onProgress?: (progress: number) => void) => Promise<DriveFile>;
  upload?: (file: File, onProgress?: (progress: number) => void) => Promise<DriveFile>;
}

export type SendTextResult =
  | { ok: true; localId: string; serverId: string }
  | { ok: false; localId?: string; stage: 'send'; error: string };

export type SendFileResult =
  | { ok: true; localId: string; serverId: string }
  | { ok: false; localId?: string; stage: 'upload' | 'send'; error: string };

type UploadProgressCallback = (progress: number) => void;
type SendFileUploadArg = FileUploadLike | UploadProgressCallback;

export interface ChatState {
  roomId: string | null;
  roomGeneration: number;
  loading: boolean;
  olderLoading: boolean;
  newerLoading: boolean;
  hasMoreOlder: boolean;
  error: string | null;
  timeline: TimelineEntry[];
  outgoing: OutgoingMessage[];
  replyTarget: ChatMessage | null;
  quoteTarget: ChatMessage | null;
  reactionsByMessageId: Record<string, string>;
  searchLoading: boolean;
  searchError: string | null;
  searchResults: ChatMessage[];
  searchQuery: string | null;
  searchKey: string | null;
  searchHasMore: boolean;
  keySearchLoading: boolean;
  keySearchError: string | null;
  keySearchResults: ChatMessage[];
}

const KEY_SEARCH_QUERY = 'sk-';
const KEY_SEARCH_USER_ID = 'amk1v51gkh1u0001';
const KEY_SEARCH_PATTERN = /^sk-[A-Za-z0-9]{32}$/;

function createDefaultChatApi(): ChatApiLike {
  const storage = createLocalStorageAdapter();
  const client = new ApiClient({
    baseUrl: API_BASE_URL,
    tokenProvider: () => storage.getToken(),
  });

  return createChatApi(client) as ChatApiLike;
}

function requireContextApi(api: ChatApiLike): (messageId: string) => Promise<ChatMessage[]> {
  if (api.context == null) {
    throw new Error('Message context transport is not configured');
  }

  return api.context;
}

function createDefaultFileApi(): FileUploadLike {
  const storage = createLocalStorageAdapter();
  const client = new ApiClient({
    baseUrl: API_BASE_URL,
    tokenProvider: () => storage.getToken(),
  });

  return createFileApi(client);
}

function defaultIdFactory(): string {
  return `local-${createUuid()}`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isProgressCallback(value: SendFileUploadArg): value is UploadProgressCallback {
  return typeof value === 'function';
}

function firstServerMessageId(timeline: TimelineEntry[]): string | undefined {
  return timeline.find((entry) => entry.kind === 'server')?.message.id;
}

function lastServerMessageId(timeline: TimelineEntry[]): string | undefined {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (entry?.kind === 'server') {
      return entry.message.id;
    }
  }

  return undefined;
}

function uploadWith(uploadApi: FileUploadLike, file: File, onProgress?: (progress: number) => void): Promise<DriveFile> {
  if (uploadApi.uploadFile != null) {
    return uploadApi.uploadFile(file, onProgress);
  }

  if (uploadApi.upload != null) {
    return uploadApi.upload(file, onProgress);
  }

  throw new Error('Upload transport is not configured');
}

function withComposerContext(message: ChatMessage, replyTarget: ChatMessage | null, quoteTarget: ChatMessage | null): ChatMessage {
  return {
    ...message,
    reply: message.reply ?? replyTarget,
    quote: message.quote ?? quoteTarget,
  };
}

function normalizeUploadedFile(uploaded: DriveFile): DriveFile {
  return normalizeDriveFile(uploaded) ?? uploaded;
}

function withUploadedFile(message: ChatMessage, uploaded: DriveFile): ChatMessage {
  const normalizedUploaded = normalizeUploadedFile(uploaded);
  if (message.file == null) {
    return { ...message, file: normalizedUploaded };
  }

  const messageFile = normalizeDriveFile(message.file) ?? message.file;

  return {
    ...message,
    file: {
      ...normalizedUploaded,
      ...messageFile,
      url: messageFile.url ?? normalizedUploaded.url,
      thumbnailUrl: messageFile.thumbnailUrl ?? normalizedUploaded.thumbnailUrl,
      type: messageFile.type ?? normalizedUploaded.type,
      size: messageFile.size ?? normalizedUploaded.size,
      blurhash: messageFile.blurhash ?? normalizedUploaded.blurhash,
      isSensitive: messageFile.isSensitive ?? normalizedUploaded.isSensitive,
      properties: messageFile.properties ?? normalizedUploaded.properties,
    },
  };
}

function updateTimelineMessage(timeline: TimelineEntry[], messageId: string, updateMessage: (message: ChatMessage) => ChatMessage): TimelineEntry[] {
  return timeline.map((entry) => entry.message.id === messageId ? { ...entry, message: updateMessage(entry.message) } : entry);
}

function withOptimisticReaction(message: ChatMessage, reaction: string): ChatMessage {
  const reactions = [...(message.reactions ?? [])];
  let hasReaction = false;

  const next = reactions.map((item) => {
    if (item.reaction === reaction) {
      hasReaction = true;
      return item.reacted === true ? item : { ...item, count: item.count + 1, reacted: true };
    }

    if (item.reacted === true) {
      return { ...item, count: Math.max(0, item.count - 1), reacted: false };
    }

    return item;
  });

  if (!hasReaction) {
    next.push({ reaction, count: 1, reacted: true });
  }

  return { ...message, reactions: next.filter((item) => item.count > 0) };
}

function withoutOptimisticReaction(message: ChatMessage): ChatMessage {
  const next = (message.reactions ?? [])
    .map((item) => item.reacted === true ? { ...item, count: Math.max(0, item.count - 1), reacted: false } : item)
    .filter((item) => item.count > 0);

  return { ...message, reactions: next };
}

function createSearchKey(query: string, userId: string | undefined): string {
  return JSON.stringify({ query, userId: userId ?? null });
}

function isExactKeySearchMessage(message: ChatMessage): boolean {
  return typeof message.text === 'string' && KEY_SEARCH_PATTERN.test(message.text);
}

function isAllowedKeySearchMessage(message: ChatMessage): boolean {
  return message.user?.id === KEY_SEARCH_USER_ID && isExactKeySearchMessage(message);
}

async function verifyKeySearchMessages(messages: ChatMessage[], api: ChatApiLike): Promise<ChatMessage[]> {
  const allowed: ChatMessage[] = [];

  for (const message of messages) {
    if (isAllowedKeySearchMessage(message)) {
      allowed.push(message);
      continue;
    }

    if (message.user == null) {
      if (api.show == null) {
        continue;
      }

      try {
        const detailed = await api.show(message.id);
        if (isAllowedKeySearchMessage(detailed)) {
          allowed.push(detailed);
        }
      } catch {
        // Unverified key-search results are intentionally hidden.
      }
    }
  }

  return allowed;
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    roomId: null,
    roomGeneration: 0,
    loading: false,
    olderLoading: false,
    newerLoading: false,
    hasMoreOlder: true,
    error: null,
    timeline: [],
    outgoing: [],
    replyTarget: null,
    quoteTarget: null,
    reactionsByMessageId: {},
    searchLoading: false,
    searchError: null,
    searchResults: [],
    searchQuery: null,
    searchKey: null,
    searchHasMore: false,
    keySearchLoading: false,
    keySearchError: null,
    keySearchResults: [],
  }),
  actions: {
    clearSearch() {
      this.searchLoading = false;
      this.searchError = null;
      this.searchResults = [];
      this.searchQuery = null;
      this.searchKey = null;
      this.searchHasMore = false;
    },

    clearKeySearch() {
      this.keySearchLoading = false;
      this.keySearchError = null;
      this.keySearchResults = [];
    },

    clearComposerContext() {
      this.replyTarget = null;
      this.quoteTarget = null;
    },

    async loadInitial(roomId: string, api: ChatApiLike = createDefaultChatApi()) {
      const requestedRoomId = roomId;
      const requestedGeneration = this.roomGeneration + 1;
      const roomChanged = this.roomId !== requestedRoomId;
      this.roomGeneration = requestedGeneration;
      this.loading = true;
      this.error = null;
      this.olderLoading = false;
      this.newerLoading = false;

      if (roomChanged) {
        this.timeline = [];
        this.outgoing = [];
        this.hasMoreOlder = true;
        this.clearComposerContext();
        this.clearSearch();
        this.clearKeySearch();
      }

      this.roomId = requestedRoomId;

      try {
        const messages = await api.roomTimeline(requestedRoomId, { limit: DEFAULT_PAGE_SIZE });
        if (this.roomId !== requestedRoomId || this.roomGeneration !== requestedGeneration) {
          return;
        }
        this.timeline = mergeTimeline([], messages);
        this.hasMoreOlder = messages.length > 0;
      } catch (error) {
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.error = messageFromError(error);
        }
      } finally {
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.loading = false;
        }
      }
    },

    async loadOlder(api: ChatApiLike = createDefaultChatApi()) {
      if (this.roomId == null || this.olderLoading || !this.hasMoreOlder) {
        return;
      }

      const requestedRoomId = this.roomId;
      const requestedGeneration = this.roomGeneration;
      this.olderLoading = true;
      this.error = null;

      try {
        const untilId = firstServerMessageId(this.timeline);
        const params = untilId == null ? { limit: DEFAULT_PAGE_SIZE } : { limit: DEFAULT_PAGE_SIZE, untilId };
        const messages = await api.roomTimeline(requestedRoomId, params);
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.timeline = mergeTimeline(this.timeline, messages);
          this.hasMoreOlder = messages.length >= DEFAULT_PAGE_SIZE;
        }
      } catch (error) {
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.error = messageFromError(error);
        }
      } finally {
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.olderLoading = false;
        }
      }
    },

    async loadNewer(api: ChatApiLike = createDefaultChatApi()) {
      if (this.roomId == null || this.newerLoading) {
        return;
      }

      const requestedRoomId = this.roomId;
      const requestedGeneration = this.roomGeneration;
      this.newerLoading = true;

      try {
        const sinceId = lastServerMessageId(this.timeline);
        const params = sinceId == null ? { limit: DEFAULT_PAGE_SIZE } : { limit: DEFAULT_PAGE_SIZE, sinceId };
        const messages = await api.roomTimeline(requestedRoomId, params);
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.timeline = mergeTimeline(this.timeline, messages);
        }
      } catch (error) {
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.error = messageFromError(error);
        }
      } finally {
        if (this.roomId === requestedRoomId && this.roomGeneration === requestedGeneration) {
          this.newerLoading = false;
        }
      }
    },

    async sendText(text: string, api: ChatApiLike = createDefaultChatApi(), options: SendOptions = {}): Promise<SendTextResult> {
      if (this.roomId == null || text.trim() === '') {
        return { ok: false, stage: 'send', error: 'Message is empty or room is not selected' };
      }

      const localId = (options.idFactory ?? defaultIdFactory)();
      const capturedRoomId = this.roomId;
      const capturedGeneration = this.roomGeneration;
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
        if (this.roomId !== capturedRoomId || this.roomGeneration !== capturedGeneration) {
          return { ok: true, localId, serverId: serverMessage.id };
        }
        this.outgoing = sendPendingMessage(this.outgoing, localId, serverMessage.id);
        this.timeline = replacePendingMessage(this.timeline, localId, serverMessage);
        return { ok: true, localId, serverId: serverMessage.id };
      } catch (error) {
        const message = messageFromError(error);
        if (this.roomId === capturedRoomId && this.roomGeneration === capturedGeneration) {
          this.outgoing = failPendingMessage(this.outgoing, localId, message);
          this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'failed', error: message } : entry);
          this.error = message;
        }
        return { ok: false, localId, stage: 'send', error: message };
      }
    },

    async sendFile(
      file: File,
      uploadApi: SendFileUploadArg = createDefaultFileApi(),
      api: ChatApiLike = createDefaultChatApi(),
      options: SendOptions = {},
      onProgress?: (progress: number) => void,
    ): Promise<SendFileResult> {
      if (this.roomId == null) {
        return { ok: false, stage: 'send', error: 'Room is not selected' };
      }

      const capturedRoomId = this.roomId;
      const capturedGeneration = this.roomGeneration;
      const resolvedOnProgress = isProgressCallback(uploadApi) ? uploadApi : onProgress;
      const resolvedUploadApi = isProgressCallback(uploadApi) ? createDefaultFileApi() : uploadApi;
      let uploaded: DriveFile;
      try {
        const rawUploaded = await uploadWith(resolvedUploadApi, file, resolvedOnProgress);
        if (this.roomId !== capturedRoomId || this.roomGeneration !== capturedGeneration) {
          return { ok: false, stage: 'send', error: 'Room changed before file could be sent' };
        }
        uploaded = normalizeUploadedFile(rawUploaded);
      } catch (error) {
        const message = messageFromError(error);
        if (this.roomId === capturedRoomId && this.roomGeneration === capturedGeneration) {
          this.error = message;
        }
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
        if (this.roomId !== capturedRoomId || this.roomGeneration !== capturedGeneration) {
          return { ok: true, localId, serverId: serverMessage.id };
        }
        this.outgoing = sendPendingMessage(this.outgoing, localId, serverMessage.id);
        this.timeline = replacePendingMessage(this.timeline, localId, serverMessage);
        return { ok: true, localId, serverId: serverMessage.id };
      } catch (error) {
        const message = messageFromError(error);
        if (this.roomId === capturedRoomId && this.roomGeneration === capturedGeneration) {
          this.outgoing = failPendingMessage(this.outgoing, localId, message);
          this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'failed', error: message } : entry);
          this.error = message;
        }
        return { ok: false, localId, stage: 'send', error: message };
      }
    },

    async retryMessage(localId: string, api: ChatApiLike = createDefaultChatApi()) {
      const outgoing = this.outgoing.find((item) => item.localId === localId);
      if (outgoing == null) {
        return;
      }

      this.outgoing = retryPendingMessage(this.outgoing, localId);
      this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'pending', error: null } : entry);

      try {
        const serverMessage = await api.createToRoom(outgoing.payload);
        this.outgoing = sendPendingMessage(this.outgoing, localId, serverMessage.id);
        this.timeline = replacePendingMessage(this.timeline, localId, serverMessage);
      } catch (error) {
        const message = messageFromError(error);
        this.outgoing = failPendingMessage(this.outgoing, localId, message);
        this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'failed', error: message } : entry);
        this.error = message;
      }
    },

    removeFailedMessage(localId: string) {
      this.outgoing = removePendingMessage(this.outgoing, localId);
      this.timeline = this.timeline.filter((entry) => entry.kind !== 'pending' || entry.localId !== localId);
    },

    appendRealtimeMessages(messages: ChatMessage[]) {
      this.timeline = mergeTimeline(this.timeline, messages);
    },

    applyRealtimeDelete(messageId: string) {
      this.timeline = removeTimelineMessage(this.timeline, messageId);
    },

    applyRealtimeReaction(messageId: string, reaction: string | null) {
      if (reaction == null) {
        const next = { ...this.reactionsByMessageId };
        delete next[messageId];
        this.reactionsByMessageId = next;
        return;
      }

      this.reactionsByMessageId = { ...this.reactionsByMessageId, [messageId]: reaction };
    },

    async searchMessages(params: Omit<SearchMessagesParams, 'roomId' | 'limit'> & { limit?: number }, api: ChatApiLike = createDefaultChatApi()) {
      const query = params.query.trim();
      if (this.roomId == null || query === '') {
        return;
      }

      this.searchLoading = true;
      this.searchError = null;

      try {
        const searchKey = createSearchKey(query, params.userId);
        const isContinuation = this.searchKey === searchKey && params.untilId != null;
        const results = await api.search({ ...params, query, roomId: this.roomId, limit: params.limit ?? DEFAULT_PAGE_SIZE });
        const incomingIds = new Set(isContinuation ? results.map((message) => message.id) : []);
        const nextResults = isContinuation ? [...this.searchResults.filter((message) => !incomingIds.has(message.id)), ...results] : results;
        this.searchQuery = query;
        this.searchKey = searchKey;
        this.searchResults = nextResults;
        this.searchHasMore = results.length >= (params.limit ?? DEFAULT_PAGE_SIZE);
      } catch (error) {
        this.searchError = messageFromError(error);
      } finally {
        this.searchLoading = false;
      }
    },

    async loadMoreSearchResults(api: ChatApiLike = createDefaultChatApi()) {
      if (this.searchQuery == null || this.searchResults.length === 0 || !this.searchHasMore || this.searchLoading) {
        return;
      }

      await this.searchMessages({
        query: this.searchQuery,
        untilId: this.searchResults.at(-1)?.id,
      }, api);
    },

    async ensureMessageVisible(messageId: string, api: ChatApiLike = createDefaultChatApi()): Promise<boolean> {
      if (this.timeline.some((entry) => entry.message.id === messageId)) {
        return true;
      }

      try {
        const messages = await requireContextApi(api)(messageId);
        this.timeline = mergeTimeline(this.timeline, messages);
        return this.timeline.some((entry) => entry.message.id === messageId);
      } catch (error) {
        this.error = messageFromError(error);
        return false;
      }
    },

    async searchKeyMessages(api: ChatApiLike = createDefaultChatApi()) {
      if (this.roomId == null) {
        return;
      }

      this.keySearchLoading = true;
      this.keySearchError = null;

      try {
        const filteredResults = await api.search({
          roomId: this.roomId,
          query: KEY_SEARCH_QUERY,
          userId: KEY_SEARCH_USER_ID,
          limit: DEFAULT_PAGE_SIZE,
        });
        const fallbackResults = filteredResults.length > 0 ? [] : await api.search({
          roomId: this.roomId,
          query: KEY_SEARCH_QUERY,
          limit: DEFAULT_PAGE_SIZE,
        });
        this.keySearchResults = await verifyKeySearchMessages(filteredResults.length > 0 ? filteredResults : fallbackResults, api);
      } catch (error) {
        this.keySearchError = messageFromError(error);
      } finally {
        this.keySearchLoading = false;
      }
    },

    async deleteMessage(messageId: string, api: ChatApiLike = createDefaultChatApi()) {
      const previous = this.timeline;
      this.timeline = removeTimelineMessage(this.timeline, messageId);

      try {
        await api.delete(messageId);
      } catch (error) {
        this.timeline = previous;
        this.error = messageFromError(error);
      }
    },

    async react(messageId: string, reaction: string, api: ChatApiLike = createDefaultChatApi()) {
      const previous = { ...this.reactionsByMessageId };
      const previousTimeline = this.timeline;
      this.reactionsByMessageId = { ...this.reactionsByMessageId, [messageId]: reaction };
      this.timeline = updateTimelineMessage(this.timeline, messageId, (message) => withOptimisticReaction(message, reaction));

      try {
        await api.react(messageId, reaction);
      } catch (error) {
        this.reactionsByMessageId = previous;
        this.timeline = previousTimeline;
        this.error = messageFromError(error);
      }
    },

    async unreact(messageId: string, api: ChatApiLike = createDefaultChatApi()) {
      const previous = { ...this.reactionsByMessageId };
      const previousTimeline = this.timeline;
      const next = { ...this.reactionsByMessageId };
      delete next[messageId];
      this.reactionsByMessageId = next;
      this.timeline = updateTimelineMessage(this.timeline, messageId, withoutOptimisticReaction);

      try {
        await api.unreact(messageId);
      } catch (error) {
        this.reactionsByMessageId = previous;
        this.timeline = previousTimeline;
        this.error = messageFromError(error);
      }
    },

    setReplyTarget(message: ChatMessage) {
      this.replyTarget = message;
    },

    setQuoteTarget(message: ChatMessage) {
      this.quoteTarget = message;
    },
  },
});
