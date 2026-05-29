<template>
  <main class="chat-room-shell">
    <ChatHeader
      :room-id="roomId"
      :title="roomTitle"
      :degraded="realtimeStore.status === 'degraded'"
      @back="router.push('/rooms')"
      @search="activePanel = activePanel === 'search' ? null : 'search'"
      @key-search="handleKeySearch"
      @favorites="showFavorites"
      @members="showMembers"
    />
    <SearchPanel
      v-if="activePanel === 'search'"
      :results="chatStore.searchResults"
      :loading="chatStore.searchLoading"
      :error="chatStore.searchError"
      @search="(query) => chatStore.searchMessages({ query })"
    />
    <KeySearchPanel
      v-if="activePanel === 'keySearch'"
      :results="chatStore.searchResults"
      :loading="chatStore.searchLoading"
      :error="chatStore.searchError"
    />
    <MembersPanel
      v-if="activePanel === 'members'"
      :members="roomStore.membersByRoomId[roomId] ?? []"
      :favorite-user-ids="settingsStore.favoriteUserIds"
      :loading="roomStore.membersLoadingByRoomId[roomId] === true"
      :has-more="roomStore.membersHasMoreByRoomId[roomId] !== false"
      @load-more="roomStore.loadMoreMembers(roomId)"
      @toggle-favorite="settingsStore.toggleFavoriteUser"
    />
    <FavoritePanel
      v-if="activePanel === 'favorites'"
      :members="allKnownMembers"
      :favorite-user-ids="settingsStore.favoriteUserIds"
    />
    <RoomManagementPanel
      v-if="activePanel === 'manage'"
      :room-id="roomId"
      :error="roomStore.error"
      @update="(params) => roomStore.updateRoom(roomId, params)"
      @mute="roomStore.muteRoom(roomId)"
      @leave="roomStore.leaveRoom(roomId)"
      @delete="roomStore.deleteRoom(roomId)"
      @invite="roomStore.createInvitation(roomId)"
    />
    <p
      v-if="chatStore.error != null"
      class="chat-error"
      role="alert"
    >
      {{ chatStore.error }}
    </p>
    <MessageTimeline
      :entries="chatStore.timeline"
      :loading-older="chatStore.olderLoading"
      :has-more-older="chatStore.hasMoreOlder"
      :current-user-id="authStore.user?.id ?? null"
      :favorite-user-ids="settingsStore.favoriteUserIds"
      @load-older="chatStore.loadOlder()"
      @reply="chatStore.setReplyTarget"
      @quote="chatStore.setQuoteTarget"
      @react="(messageId, reaction) => chatStore.react(messageId, reaction)"
      @delete="chatStore.deleteMessage"
      @retry="chatStore.retryMessage"
      @remove="chatStore.removeFailedMessage"
      @toggle-favorite="settingsStore.toggleFavoriteUser"
    />
    <MessageComposer
      :reply-target="chatStore.replyTarget"
      :quote-target="chatStore.quoteTarget"
      @send="chatStore.sendText"
      @send-file="chatStore.sendFile"
      @clear-context="chatStore.clearComposerContext()"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiClient } from '@/api/apiClient';
import { useAuthStore } from '@/auth/authStore';
import { API_BASE_URL } from '@/shared/config';
import { createLocalStorageAdapter } from '@/shared/storage';
import { createChatApi } from '@/chat/chatApi';
import { createPollingFallback } from '@/realtime/pollingFallback';
import { createRealtimeClient } from '@/realtime/realtimeClient';
import { useRealtimeStore } from '@/realtime/realtimeStore';
import { useRoomStore } from '@/rooms/roomStore';
import { useSettingsStore } from '@/settings/settingsStore';
import RoomManagementPanel from '@/rooms/components/RoomManagementPanel.vue';
import ChatHeader from './ChatHeader.vue';
import FavoritePanel from './FavoritePanel.vue';
import MembersPanel from './MembersPanel.vue';
import MessageComposer from './MessageComposer.vue';
import MessageTimeline from './MessageTimeline.vue';
import SearchPanel from './SearchPanel.vue';
import KeySearchPanel from './KeySearchPanel.vue';
import { useChatStore } from '../chatStore';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const roomStore = useRoomStore();
const realtimeStore = useRealtimeStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const roomId = computed(() => String(route.params.roomId ?? ''));
const roomTitle = computed(() => roomStore.rooms.find((entry) => entry.room.id === roomId.value)?.room.name ?? roomId.value);
const activePanel = ref<'search' | 'keySearch' | 'favorites' | 'members' | 'manage' | null>(null);

const allKnownMembers = computed(() => {
  const membersFromStore = roomStore.membersByRoomId[roomId.value] ?? [];
  const seenIds = new Set(membersFromStore.map((m) => m.id));
  const uniqueTimelineUsers = chatStore.timeline.reduce<typeof membersFromStore>((acc, entry) => {
    const user = entry.message.user;
    if (user != null && !seenIds.has(user.id)) {
      seenIds.add(user.id);
      acc.push(user);
    }
    return acc;
  }, []);
  return [...membersFromStore, ...uniqueTimelineUsers];
});
let newerPollTimer: ReturnType<typeof globalThis.setInterval> | null = null;

async function ensureMembersLoaded(): Promise<void> {
  if (roomStore.membersByRoomId[roomId.value] == null) {
    await roomStore.loadMoreMembers(roomId.value);
  }
}

async function showMembers(): Promise<void> {
  activePanel.value = activePanel.value === 'members' ? null : 'members';
  if (activePanel.value === 'members') {
    await ensureMembersLoaded();
  }
}

async function showFavorites(): Promise<void> {
  activePanel.value = activePanel.value === 'favorites' ? null : 'favorites';
  if (activePanel.value === 'favorites') {
    await ensureMembersLoaded();
  }
}

function handleKeySearch(): void {
  if (activePanel.value === 'keySearch') {
    activePanel.value = null;
  } else {
    activePanel.value = 'keySearch';
    chatStore.searchMessages({ query: 'sk-' });
  }
}

function startRealtime(): void {
  const storage = createLocalStorageAdapter();
  const client = new ApiClient({ baseUrl: API_BASE_URL, tokenProvider: () => storage.getToken() });
  const chatApi = createChatApi(client);
  const realtime = createRealtimeClient({ tokenProvider: () => storage.getToken() });
  const polling = createPollingFallback({
    roomTimeline: chatApi.roomTimeline,
    onMessages: (_roomId, messages) => chatStore.appendRealtimeMessages(messages),
    onStatus: () => realtimeStore.markDegraded(),
  });

  realtimeStore.startRoom(roomId.value, {
    realtime,
    polling,
    lastSeenId: () => chatStore.timeline.at(-1)?.message.id,
    appendMessages: (_roomId, messages) => chatStore.appendRealtimeMessages(messages),
    deleteMessage: (messageId) => chatStore.applyRealtimeDelete(messageId),
    applyReaction: (messageId, reaction) => chatStore.applyRealtimeReaction(messageId, reaction),
  });
}

function stopNewerPolling(): void {
  if (newerPollTimer != null) {
    globalThis.clearInterval(newerPollTimer);
    newerPollTimer = null;
  }
}

function startNewerPolling(): void {
  stopNewerPolling();
  void chatStore.loadNewer();
  newerPollTimer = globalThis.setInterval(() => {
    void chatStore.loadNewer();
  }, 3000);
}

async function loadRoom(): Promise<void> {
  if (roomId.value !== '') {
    realtimeStore.stopRoom();
    stopNewerPolling();
    await roomStore.ensureRoomVisible(roomId.value);
    await chatStore.loadInitial(roomId.value);
    startRealtime();
    startNewerPolling();
  }
}

onMounted(loadRoom);
watch(roomId, loadRoom);
onBeforeUnmount(() => {
  stopNewerPolling();
  realtimeStore.stopRoom();
});
</script>
