<template>
  <main class="chat-room-shell">
    <div data-panel-region>
      <ChatHeader
        :room-id="roomId"
        :title="roomTitle"
        :degraded="realtimeStore.status === 'degraded'"
        @back="router.push('/rooms')"
        @search="toggleSearch"
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
        @select="jumpToMessage"
      />
      <KeySearchPanel
        v-if="activePanel === 'keySearch'"
        :results="chatStore.keySearchResults"
        :loading="chatStore.keySearchLoading"
        :error="chatStore.keySearchError"
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
        :loading="favoriteMembersResolving"
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
    </div>
    <p
      v-if="chatStore.error != null"
      class="chat-error"
      role="alert"
    >
      {{ chatStore.error }}
    </p>
    <MessageTimeline
      ref="timelineComponent"
      :entries="chatStore.timeline"
      :loading-older="chatStore.olderLoading"
      :has-more-older="chatStore.hasMoreOlder"
      :current-user-id="authStore.user?.id ?? null"
      :favorite-user-ids="settingsStore.favoriteUserIds"
      :mention-members="allKnownMembers"
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
      data-panel-keep-open
      :reply-target="chatStore.replyTarget"
      :quote-target="chatStore.quoteTarget"
      :mention-members="allKnownMembers"
      @send="chatStore.sendText"
      @send-file="chatStore.sendFile"
      @clear-context="chatStore.clearComposerContext()"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
import type { UserSummary } from '@/shared/types';
import { createUserApi } from '@/users/userApi';
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
const favoriteMembersResolving = ref(false);
const favoriteUsersById = ref<Record<string, UserSummary>>({});
const mentionUsersByUsername = ref<Record<string, UserSummary>>({});
const resolvingMentionUsernames = ref(new Set<string>());
const timelineComponent = ref<{ scrollToMessage: (messageId: string) => boolean } | null>(null);
const MENTION_USERNAME_PATTERN = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9_]{1,32})/g;

function mergeUserSummary(current: UserSummary | undefined, incoming: UserSummary): UserSummary {
  if (current == null) {
    return incoming;
  }

  return {
    ...current,
    ...incoming,
    username: incoming.username || current.username,
    name: incoming.name ?? current.name,
    avatarUrl: incoming.avatarUrl ?? current.avatarUrl,
    avatarFallbackUrl: incoming.avatarFallbackUrl ?? current.avatarFallbackUrl,
  };
}

const allKnownMembers = computed(() => {
  const usersById = new Map<string, UserSummary>();
  const addUser = (user: UserSummary) => {
    usersById.set(user.id, mergeUserSummary(usersById.get(user.id), user));
  };

  for (const member of roomStore.membersByRoomId[roomId.value] ?? []) {
    addUser(member);
  }

  for (const entry of chatStore.timeline) {
    const user = entry.message.user;
    if (user != null) {
      addUser(user);
    }
  }

  for (const user of Object.values(favoriteUsersById.value)) {
    addUser(user);
  }

  for (const user of Object.values(mentionUsersByUsername.value)) {
    addUser(user);
  }

  return [...usersById.values()];
});
let newerPollTimer: ReturnType<typeof globalThis.setInterval> | null = null;

function createUserApiClient() {
  const storage = createLocalStorageAdapter();
  const client = new ApiClient({ baseUrl: API_BASE_URL, tokenProvider: () => storage.getToken() });
  return createUserApi(client);
}

async function ensureMembersLoaded(): Promise<void> {
  if (roomStore.membersByRoomId[roomId.value] == null) {
    await roomStore.loadMoreMembers(roomId.value);
  }
}

function missingFavoriteMemberIds(): string[] {
  const knownIds = new Set(allKnownMembers.value.map((member) => member.id));
  return settingsStore.favoriteUserIds.filter((userId) => !knownIds.has(userId));
}

async function ensureFavoriteMembersLoaded(): Promise<void> {
  if (settingsStore.favoriteUserIds.length === 0) {
    return;
  }

  favoriteMembersResolving.value = true;

  try {
    const missingUserIds = missingFavoriteMemberIds();
    if (activePanel.value === 'favorites' && missingUserIds.length > 0) {
      const users = await createUserApiClient().show({ userIds: missingUserIds, detail: false });
      favoriteUsersById.value = {
        ...favoriteUsersById.value,
        ...Object.fromEntries(users.map((user) => [user.id, user])),
      };
    }
  } finally {
    favoriteMembersResolving.value = false;
  }
}

function mentionedUsernamesFromTimeline(): string[] {
  const usernames = new Set<string>();

  for (const entry of chatStore.timeline) {
    const text = entry.message.text;
    if (text == null) {
      continue;
    }

    for (const match of text.matchAll(MENTION_USERNAME_PATTERN)) {
      const username = match[2];
      if (username != null) {
        usernames.add(username.toLowerCase());
      }
    }
  }

  return [...usernames];
}

function knownMentionUsernames(): Set<string> {
  return new Set(allKnownMembers.value.map((member) => member.username.toLowerCase()));
}

async function resolveMentionUsername(username: string): Promise<void> {
  resolvingMentionUsernames.value.add(username);

  try {
    const users = await createUserApiClient().show({ username, detail: false });
    const user = users.find((candidate) => candidate.username.toLowerCase() === username) ?? users[0];
    if (user != null) {
      mentionUsersByUsername.value = {
        ...mentionUsersByUsername.value,
        [user.username.toLowerCase()]: user,
      };
    }
  } finally {
    resolvingMentionUsernames.value.delete(username);
  }
}

function ensureMentionUsersLoaded(): void {
  const knownUsernames = knownMentionUsernames();
  const missingUsernames = mentionedUsernamesFromTimeline()
    .filter((username) => !knownUsernames.has(username) && !resolvingMentionUsernames.value.has(username));

  for (const username of missingUsernames) {
    void resolveMentionUsername(username);
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
    await ensureFavoriteMembersLoaded();
  }
}

function toggleSearch(): void {
  activePanel.value = activePanel.value === 'search' ? null : 'search';
}

function handleKeySearch(): void {
  if (activePanel.value === 'keySearch') {
    activePanel.value = null;
  } else {
    activePanel.value = 'keySearch';
    chatStore.searchKeyMessages();
  }
}

function handleDocumentPointerDown(event: globalThis.PointerEvent): void {
  if (activePanel.value == null) {
    return;
  }

  const target = event.target;
  if (!(target instanceof globalThis.Element)) {
    return;
  }

  if (target.closest('[data-panel-region], [data-panel-keep-open]') != null) {
    return;
  }

  activePanel.value = null;
}

async function jumpToMessage(messageId: string): Promise<void> {
  const visible = await chatStore.ensureMessageVisible(messageId);
  if (!visible) {
    return;
  }

  await nextTick();
  if (timelineComponent.value?.scrollToMessage(messageId) === true) {
    activePanel.value = null;
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
    void ensureMembersLoaded();
    startRealtime();
    startNewerPolling();
  }
}

onMounted(() => {
  void loadRoom();
  globalThis.document.addEventListener('pointerdown', handleDocumentPointerDown, true);
});
watch(roomId, loadRoom);
watch(() => chatStore.timeline.map((entry) => `${entry.message.id}:${entry.message.text ?? ''}`).join('|'), ensureMentionUsersLoaded);
onBeforeUnmount(() => {
  stopNewerPolling();
  realtimeStore.stopRoom();
  globalThis.document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
});
</script>
