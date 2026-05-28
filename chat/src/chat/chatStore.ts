import { defineStore } from 'pinia';
import { ApiClient } from '@/api/apiClient';
import { API_BASE_URL, DEFAULT_PAGE_SIZE } from '@/shared/config';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { ChatMessage, DriveFile, PaginationParams } from '@/shared/types';
import { createFileApi } from '@/files/fileApi';
import { createChatApi, type CreateRoomMessageParams } from './chatApi';
import { createPendingMessage, failPendingMessage, removePendingMessage, retryPendingMessage, sendPendingMessage, type OutgoingMessage } from './outgoingQueue';
import { mergeTimeline, removeTimelineMessage, replacePendingMessage, type TimelineEntry } from './timelineMerge';

export interface ChatApiLike {
  roomTimeline: (roomId: string, params?: PaginationParams) => Promise<ChatMessage[]>;
  createToRoom: (params: CreateRoomMessageParams) => Promise<ChatMessage>;
  delete: (messageId: string) => Promise<unknown>;
  react: (messageId: string, reaction: string) => Promise<unknown>;
  unreact: (messageId: string) => Promise<unknown>;
}

export interface SendOptions {
  idFactory?: () => string;
  now?: () => string;
}

export interface FileUploadLike {
  uploadFile?: (file: File, onProgress?: (progress: number) => void) => Promise<DriveFile>;
  upload?: (file: File, onProgress?: (progress: number) => void) => Promise<DriveFile>;
}

export interface ChatState {
  roomId: string | null;
  loading: boolean;
  error: string | null;
  timeline: TimelineEntry[];
  outgoing: OutgoingMessage[];
  replyTarget: ChatMessage | null;
  quoteTarget: ChatMessage | null;
  reactionsByMessageId: Record<string, string>;
}

function createDefaultChatApi(): ChatApiLike {
  const storage = createLocalStorageAdapter();
  const client = new ApiClient({
    baseUrl: API_BASE_URL,
    tokenProvider: () => storage.getToken(),
  });

  return createChatApi(client) as ChatApiLike;
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
  return `local-${crypto.randomUUID()}`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function firstServerMessageId(timeline: TimelineEntry[]): string | undefined {
  return timeline.find((entry) => entry.kind === 'server')?.message.id;
}

function uploadWith(uploadApi: FileUploadLike, file: File): Promise<DriveFile> {
  if (uploadApi.uploadFile != null) {
    return uploadApi.uploadFile(file);
  }

  if (uploadApi.upload != null) {
    return uploadApi.upload(file);
  }

  throw new Error('Upload transport is not configured');
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    roomId: null,
    loading: false,
    error: null,
    timeline: [],
    outgoing: [],
    replyTarget: null,
    quoteTarget: null,
    reactionsByMessageId: {},
  }),
  actions: {
    clearComposerContext() {
      this.replyTarget = null;
      this.quoteTarget = null;
    },

    async loadInitial(roomId: string, api: ChatApiLike = createDefaultChatApi()) {
      const roomChanged = this.roomId !== roomId;
      this.loading = true;
      this.error = null;

      if (roomChanged) {
        this.timeline = [];
        this.outgoing = [];
        this.clearComposerContext();
      }

      this.roomId = roomId;

      try {
        const messages = await api.roomTimeline(roomId, { limit: DEFAULT_PAGE_SIZE });
        this.timeline = mergeTimeline([], messages);
      } catch (error) {
        this.error = messageFromError(error);
      } finally {
        this.loading = false;
      }
    },

    async loadOlder(api: ChatApiLike = createDefaultChatApi()) {
      if (this.roomId == null) {
        return;
      }

      const untilId = firstServerMessageId(this.timeline);
      const params = untilId == null ? { limit: DEFAULT_PAGE_SIZE } : { limit: DEFAULT_PAGE_SIZE, untilId };
      const messages = await api.roomTimeline(this.roomId, params);
      this.timeline = mergeTimeline(this.timeline, messages);
    },

    async sendText(text: string, api: ChatApiLike = createDefaultChatApi(), options: SendOptions = {}) {
      if (this.roomId == null || text.trim() === '') {
        return;
      }

      const localId = (options.idFactory ?? defaultIdFactory)();
      const pending = createPendingMessage({
        localId,
        roomId: this.roomId,
        text: text.trim(),
        replyId: this.replyTarget?.id,
        quoteId: this.quoteTarget?.id,
        createdAt: (options.now ?? (() => new Date().toISOString()))(),
      });

      this.outgoing = [...this.outgoing, pending];
      this.timeline = mergeTimeline(this.timeline, [{ ...pending.localMessage }]);
      this.timeline = this.timeline.map((entry) => entry.message.id === localId ? { kind: 'pending', localId, message: pending.localMessage, status: 'pending' } : entry);

      try {
        const serverMessage = await api.createToRoom(pending.payload);
        this.outgoing = sendPendingMessage(this.outgoing, localId, serverMessage.id);
        this.timeline = replacePendingMessage(this.timeline, localId, serverMessage);
        this.clearComposerContext();
      } catch (error) {
        const message = messageFromError(error);
        this.outgoing = failPendingMessage(this.outgoing, localId, message);
        this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'failed', error: message } : entry);
        this.error = message;
      }
    },

    async sendFile(file: File, uploadApi: FileUploadLike = createDefaultFileApi(), api: ChatApiLike = createDefaultChatApi(), options: SendOptions = {}) {
      if (this.roomId == null) {
        return;
      }

      const uploaded = await uploadWith(uploadApi, file);
      const localId = (options.idFactory ?? defaultIdFactory)();
      const pending = createPendingMessage({
        localId,
        roomId: this.roomId,
        fileId: uploaded.id,
        replyId: this.replyTarget?.id,
        quoteId: this.quoteTarget?.id,
        createdAt: (options.now ?? (() => new Date().toISOString()))(),
      });

      pending.localMessage.file = uploaded;
      this.outgoing = [...this.outgoing, pending];
      this.timeline = mergeTimeline(this.timeline, [{ ...pending.localMessage }]);
      this.timeline = this.timeline.map((entry) => entry.message.id === localId ? { kind: 'pending', localId, message: pending.localMessage, status: 'pending' } : entry);

      try {
        const serverMessage = await api.createToRoom(pending.payload);
        this.outgoing = sendPendingMessage(this.outgoing, localId, serverMessage.id);
        this.timeline = replacePendingMessage(this.timeline, localId, serverMessage);
        this.clearComposerContext();
      } catch (error) {
        const message = messageFromError(error);
        this.outgoing = failPendingMessage(this.outgoing, localId, message);
        this.timeline = this.timeline.map((entry) => entry.kind === 'pending' && entry.localId === localId ? { ...entry, status: 'failed', error: message } : entry);
        this.error = message;
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
      this.reactionsByMessageId = { ...this.reactionsByMessageId, [messageId]: reaction };

      try {
        await api.react(messageId, reaction);
      } catch (error) {
        this.reactionsByMessageId = previous;
        this.error = messageFromError(error);
      }
    },

    async unreact(messageId: string, api: ChatApiLike = createDefaultChatApi()) {
      const previous = { ...this.reactionsByMessageId };
      const next = { ...this.reactionsByMessageId };
      delete next[messageId];
      this.reactionsByMessageId = next;

      try {
        await api.unreact(messageId);
      } catch (error) {
        this.reactionsByMessageId = previous;
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
