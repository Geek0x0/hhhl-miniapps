<template>
  <main class="chat-room-shell">
    <ChatHeader
      :room-id="roomId"
      :title="roomTitle"
      :degraded="realtimeStore.status === 'degraded'"
      @back="router.push('/rooms')"
      @search="activePanel = activePanel === 'search' ? null : 'search'"
      @members="showMembers"
      @manage="activePanel = activePanel === 'manage' ? null : 'manage'"
    />
    <SearchPanel
      v-if="activePanel === 'search'"
      :results="chatStore.searchResults"
      :loading="chatStore.searchLoading"
      :error="chatStore.searchError"
      @search="(query) => chatStore.searchMessages({ query })"
    />
    <MembersPanel
      v-if="activePanel === 'members'"
      :members="roomStore.membersByRoomId[roomId] ?? []"
      @load-more="roomStore.loadMembers(roomId)"
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
      @load-older="chatStore.loadOlder()"
      @reply="chatStore.setReplyTarget"
      @quote="chatStore.setQuoteTarget"
      @react="(messageId, reaction) => chatStore.react(messageId, reaction)"
      @delete="chatStore.deleteMessage"
      @retry="chatStore.retryMessage"
      @remove="chatStore.removeFailedMessage"
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
import { API_BASE_URL } from '@/shared/config';
import { createLocalStorageAdapter } from '@/shared/storage';
import { createChatApi } from '@/chat/chatApi';
import { createPollingFallback } from '@/realtime/pollingFallback';
import { createRealtimeClient } from '@/realtime/realtimeClient';
import { useRealtimeStore } from '@/realtime/realtimeStore';
import { useRoomStore } from '@/rooms/roomStore';
import RoomManagementPanel from '@/rooms/components/RoomManagementPanel.vue';
import ChatHeader from './ChatHeader.vue';
import MembersPanel from './MembersPanel.vue';
import MessageComposer from './MessageComposer.vue';
import MessageTimeline from './MessageTimeline.vue';
import SearchPanel from './SearchPanel.vue';
import { useChatStore } from '../chatStore';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const roomStore = useRoomStore();
const realtimeStore = useRealtimeStore();
const roomId = computed(() => String(route.params.roomId ?? ''));
const roomTitle = computed(() => roomId.value);
const activePanel = ref<'search' | 'members' | 'manage' | null>(null);

async function showMembers(): Promise<void> {
  activePanel.value = activePanel.value === 'members' ? null : 'members';
  if (activePanel.value === 'members' && roomStore.membersByRoomId[roomId.value] == null) {
    await roomStore.loadMembers(roomId.value);
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

async function loadRoom(): Promise<void> {
  if (roomId.value !== '') {
    await chatStore.loadInitial(roomId.value);
    startRealtime();
  }
}

onMounted(loadRoom);
watch(roomId, loadRoom);
onBeforeUnmount(() => realtimeStore.stopRoom());
</script>
