<template>
  <main class="chat-room-shell">
    <div data-panel-region>
      <ChatHeader
        :room-id="roomId"
        :title="roomTitle"
        :degraded="realtimeStore.status === 'degraded'"
        :can-manage-room="canManageRoom"
        @back="router.push('/rooms')"
        @search="toggleSearch"
        @key-search="handleKeySearch"
        @favorites="showFavorites"
        @members="showMembers"
        @block-manage="showBlockManagement"
        @manage="toggleManage"
      />
      <SearchPanel
        v-if="activePanel === 'search'"
        :query="chatStore.searchQuery"
        :selected-user-id="chatStore.searchUserId"
        :members="allKnownMembers"
        :results="visibleSearchResults"
        :loading="chatStore.searchLoading"
        :error="chatStore.searchError"
        :has-more="chatStore.searchHasMore"
        @search="(params) => chatStore.searchMessages(params)"
        @load-more="chatStore.loadMoreSearchResults()"
        @select="jumpToMessage"
      />
      <KeySearchPanel
        v-if="activePanel === 'keySearch'"
        :results="visibleKeySearchResults"
        :loading="chatStore.keySearchLoading"
        :error="chatStore.keySearchError"
      />
      <MembersPanel
        v-if="activePanel === 'members'"
        :members="allKnownMembers"
        :favorite-user-ids="settingsStore.favoriteUserIds"
        :loading="roomStore.membersLoadingByRoomId[roomId] === true"
        :has-more="roomStore.membersHasMoreByRoomId[roomId] !== false"
        @load-more="roomStore.loadMoreMembers(roomId)"
        @toggle-favorite="toggleFavoriteUser"
      />
      <FavoritePanel
        v-if="activePanel === 'favorites'"
        :members="allKnownMembers"
        :favorite-user-ids="settingsStore.favoriteUserIds"
        :loading="favoriteMembersResolving"
      />
      <BlockedUsersPanel
        v-if="activePanel === 'blocks'"
        :members="mutedUsers"
        :loading="roomStore.userMutesLoadingByRoomId[roomId] === true"
      />
      <RoomManagementPanel
        v-if="activePanel === 'manage' && canManageRoom"
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
    <p
      v-if="feedbackMessage != null"
      class="key-copy-toast"
      role="status"
    >
      {{ feedbackMessage }}
    </p>
    <MessageTimeline
      ref="timelineComponent"
      :entries="chatStore.timeline"
      :loading-older="chatStore.olderLoading"
      :has-more-older="chatStore.hasMoreOlder"
      :current-user-id="authStore.user?.id ?? null"
      :favorite-user-ids="settingsStore.favoriteUserIds"
      :muted-user-ids="mutedUserIds"
      :mention-members="allKnownMembers"
      @load-older="chatStore.loadOlder()"
      @reply="chatStore.setReplyTarget"
      @quote="chatStore.setQuoteTarget"
      @react="(messageId, reaction) => chatStore.react(messageId, reaction)"
      @delete="chatStore.deleteMessage"
      @retry="chatStore.retryMessage"
      @remove="chatStore.removeFailedMessage"
      @toggle-favorite="toggleFavoriteUser"
      @mute-user="muteUser"
      @mention-user="handleMentionUser"
    />
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
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiClient } from '@/api/apiClient';
import { useAuthStore } from '@/auth/authStore';
import { deliverKeySearchResultToBot } from '@/bot/keyDelivery';
import { API_BASE_URL } from '@/shared/config';
import { createLocalStorageAdapter } from '@/shared/storage';
import { createChatApi } from '@/chat/chatApi';
import { clearRoomDraft, readRoomDraft, saveRoomDraft } from '@/chat/drafts';
import { createPollingFallback } from '@/realtime/pollingFallback';
import { createRealtimeClient } from '@/realtime/realtimeClient';
import { useRealtimeStore } from '@/realtime/realtimeStore';
import { useRoomStore } from '@/rooms/roomStore';
import { useSettingsStore } from '@/settings/settingsStore';
import type { ChatMessage, UserSummary } from '@/shared/types';
import { createUserApi } from '@/users/userApi';
import { i18n } from '@/i18n';
import RoomManagementPanel from '@/rooms/components/RoomManagementPanel.vue';
import BlockedUsersPanel from './BlockedUsersPanel.vue';
import ChatHeader from './ChatHeader.vue';
import FavoritePanel from './FavoritePanel.vue';
import MembersPanel from './MembersPanel.vue';
import MessageComposer from './MessageComposer.vue';
import MessageTimeline from './MessageTimeline.vue';
import SearchPanel from './SearchPanel.vue';
import KeySearchPanel from './KeySearchPanel.vue';
import { filterMutedMessages } from '../messageFilters';
import { useChatStore } from '../chatStore';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const roomStore = useRoomStore();
const realtimeStore = useRealtimeStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const localStorageAdapter = createLocalStorageAdapter();
const composerDraft = ref('');
const feedbackMessage = ref<string | null>(null);
const roomId = computed(() => String(route.params.roomId ?? ''));
const activeRoomEntry = computed(() => roomStore.rooms.find((entry) => entry.room.id === roomId.value) ?? null);
const roomTitle = computed(() => activeRoomEntry.value?.room.name ?? roomId.value);
const canManageRoom = computed(() => activeRoomEntry.value?.sources.includes('owned') === true);
const activePanel = ref<'search' | 'keySearch' | 'favorites' | 'members' | 'blocks' | 'manage' | null>(null);
const favoriteMembersResolving = ref(false);
const favoriteUsersById = ref<Record<string, UserSummary>>({});
const mentionUsersByUsername = ref<Record<string, UserSummary>>({});
const resolvingMentionUsernames = ref(new Set<string>());
const timelineComponent = ref<{ scrollToMessage: (messageId: string) => boolean } | null>(null);
const composerComponent = ref<{ appendMention: (username: string) => void } | null>(null);
const MENTION_USERNAME_PATTERN = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9_]{1,32})/g;
const suppressedEmptyDraftsByRoomId = new Map<string, number>();
const draftRevisionsByRoomId = new Map<string, number>();
let feedbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let lastAutoKeySearchRouteKey: string | null = null;

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

  if (authStore.user != null) {
    addUser(authStore.user);
  }

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

  for (const user of roomStore.userMutesByRoomId[roomId.value] ?? []) {
    addUser(user);
  }

  for (const user of Object.values(mentionUsersByUsername.value)) {
    addUser(user);
  }

  return [...usersById.values()];
});

const mutedUsers = computed(() => roomStore.userMutesByRoomId[roomId.value] ?? []);
const mutedUserIds = computed(() => mutedUsers.value.map((user) => user.id));
const currentUserId = computed(() => authStore.user?.id ?? null);
const visibleSearchResults = computed<ChatMessage[]>(() => filterMutedMessages(chatStore.searchResults, mutedUserIds.value, currentUserId.value));
const visibleKeySearchResults = computed<ChatMessage[]>(() => filterMutedMessages(chatStore.keySearchResults, mutedUserIds.value, currentUserId.value));

function createUserApiClient() {
  const storage = createLocalStorageAdapter();
  const client = new ApiClient({ baseUrl: API_BASE_URL, tokenProvider: () => storage.getToken() });
  return createUserApi(client);
}

async function ensureAllMembersLoaded(): Promise<void> {
  await roomStore.loadAllMembers(roomId.value);
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

function handleMentionUser(username: string): void {
  if (composerComponent.value != null) {
    composerComponent.value.appendMention(username);
  }
}

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

function userSummaryForMute(userId: string): UserSummary {
  const knownUser = allKnownMembers.value.find((member) => member.id === userId);
  return knownUser ?? { id: userId, username: userId, name: null, avatarUrl: null, avatarFallbackUrl: null };
}

async function muteUser(userId: string): Promise<void> {
  if (roomId.value === '' || mutedUserIds.value.includes(userId)) {
    return;
  }

  await roomStore.muteUser(roomId.value, userSummaryForMute(userId));
  if (mutedUserIds.value.includes(userId)) {
    showFeedback(i18n.t('chat.blockedUserAdded'));
  }
}

function restoreComposerDraft(): void {
  composerDraft.value = roomId.value === '' ? '' : readRoomDraft(localStorageAdapter, roomId.value);
}

function handleDraftChange(text: string): void {
  if (roomId.value !== '' && text === '' && consumeSuppressedEmptyDraft(roomId.value)) {
    composerDraft.value = '';
    return;
  }

  composerDraft.value = text;
  if (roomId.value !== '') {
    incrementDraftRevision(roomId.value);
    saveRoomDraft(localStorageAdapter, roomId.value, text);
  }
}

async function handleSendText(text: string): Promise<void> {
  const submittedRoomId = roomId.value;
  const submittedRevision = draftRevision(submittedRoomId);
  if (submittedRoomId !== '') {
    saveRoomDraft(localStorageAdapter, submittedRoomId, text);
    suppressNextEmptyDraft(submittedRoomId);
  }

  const result = await chatStore.sendText(text);
  await nextTick();
  if (submittedRoomId === '') {
    return;
  }

  const ownsSubmittedDraft = draftRevision(submittedRoomId) === submittedRevision;
  if (result.ok) {
    if (ownsSubmittedDraft) {
      clearRoomDraft(localStorageAdapter, submittedRoomId);
      if (roomId.value === submittedRoomId) {
        composerDraft.value = '';
      }
    }
  } else {
    if (ownsSubmittedDraft) {
      saveRoomDraft(localStorageAdapter, submittedRoomId, text);
      if (roomId.value === submittedRoomId) {
        composerDraft.value = text;
      }
    }
  }
}

async function handleSendFile(file: globalThis.File, onProgress: (progress: number) => void) {
  const submittedRoomId = roomId.value;
  const submittedGeneration = chatStore.roomGeneration;
  const result = await chatStore.sendFile(file, onProgress);
  if (
    !result.ok &&
    result.stage === 'upload' &&
    roomId.value === submittedRoomId &&
    chatStore.roomGeneration === submittedGeneration &&
    chatStore.error === result.error
  ) {
    chatStore.error = null;
  }
  return result;
}

function suppressNextEmptyDraft(roomId: string): void {
  suppressedEmptyDraftsByRoomId.set(roomId, (suppressedEmptyDraftsByRoomId.get(roomId) ?? 0) + 1);
}

function consumeSuppressedEmptyDraft(roomId: string): boolean {
  const count = suppressedEmptyDraftsByRoomId.get(roomId) ?? 0;
  if (count <= 0) {
    return false;
  }

  if (count === 1) {
    suppressedEmptyDraftsByRoomId.delete(roomId);
  } else {
    suppressedEmptyDraftsByRoomId.set(roomId, count - 1);
  }
  return true;
}

function draftRevision(roomId: string): number {
  return roomId === '' ? 0 : draftRevisionsByRoomId.get(roomId) ?? 0;
}

function incrementDraftRevision(roomId: string): void {
  draftRevisionsByRoomId.set(roomId, draftRevision(roomId) + 1);
}

async function showMembers(): Promise<void> {
  activePanel.value = activePanel.value === 'members' ? null : 'members';
  if (activePanel.value === 'members') {
    await ensureAllMembersLoaded();
  }
}

async function showFavorites(): Promise<void> {
  activePanel.value = activePanel.value === 'favorites' ? null : 'favorites';
  if (activePanel.value === 'favorites') {
    await ensureFavoriteMembersLoaded();
  }
}

async function showBlockManagement(): Promise<void> {
  activePanel.value = activePanel.value === 'blocks' ? null : 'blocks';
  if (activePanel.value === 'blocks') {
    await roomStore.loadUserMutes(roomId.value);
  }
}

async function toggleSearch(): Promise<void> {
  activePanel.value = activePanel.value === 'search' ? null : 'search';
  if (activePanel.value === 'search') {
    await ensureAllMembersLoaded();
  }
}

function handleKeySearch(): void {
  if (activePanel.value === 'keySearch') {
    activePanel.value = null;
  } else {
    activePanel.value = 'keySearch';
    chatStore.searchKeyMessages();
  }
}

function autoKeySearchValues(): string[] {
  const value = route.query.autoKeySearch;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' ? [value] : [];
}

function shouldAutoKeySearch(): boolean {
  return autoKeySearchValues().some((value) => value === '1' || value === 'true' || value === 'sendToBot');
}

function shouldDeliverAutoKeySearchToBot(): boolean {
  return autoKeySearchValues().includes('sendToBot');
}

async function maybeAutoKeySearch(): Promise<void> {
  if (!shouldAutoKeySearch() || roomId.value === '' || chatStore.roomId !== roomId.value) {
    return;
  }

  const routeKey = `${roomId.value}:${JSON.stringify(route.query.autoKeySearch)}`;
  if (lastAutoKeySearchRouteKey === routeKey) {
    return;
  }

  lastAutoKeySearchRouteKey = routeKey;
  const requestedRoomId = roomId.value;
  const shouldDeliverToBot = shouldDeliverAutoKeySearchToBot();
  activePanel.value = 'keySearch';
  await chatStore.searchKeyMessages();

  if (shouldDeliverToBot && roomId.value === requestedRoomId) {
    await deliverKeySearchResultToBot({
      roomId: requestedRoomId,
      message: chatStore.keySearchResults[0] ?? null,
      ...(chatStore.keySearchError == null ? {} : { failed: true }),
    });
  }
}

function toggleManage(): void {
  if (!canManageRoom.value) {
    activePanel.value = null;
    return;
  }

  activePanel.value = activePanel.value === 'manage' ? null : 'manage';
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

async function catchUpVisibleRoom(): Promise<void> {
  if (
    roomId.value === '' ||
    chatStore.roomId !== roomId.value ||
    chatStore.loading ||
    globalThis.document.visibilityState !== 'visible'
  ) {
    return;
  }

  await chatStore.loadNewer();
}

function handleVisibilityChange(): void {
  if (globalThis.document.visibilityState === 'visible') {
    void catchUpVisibleRoom();
  }
}

async function loadRoom(): Promise<void> {
  if (roomId.value !== '') {
    realtimeStore.stopRoom();
    await roomStore.ensureRoomVisible(roomId.value);
    await chatStore.loadInitial(roomId.value);
    restoreComposerDraft();
    void ensureAllMembersLoaded();
    void roomStore.loadUserMutes(roomId.value);
    startRealtime();
    void maybeAutoKeySearch();
  }
}

onMounted(() => {
  void loadRoom();
  globalThis.document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  globalThis.document.addEventListener('visibilitychange', handleVisibilityChange);
});
watch(roomId, loadRoom);
watch(() => route.query.autoKeySearch, () => {
  void maybeAutoKeySearch();
});
watch(() => chatStore.timeline.map((entry) => `${entry.message.id}:${entry.message.text ?? ''}`).join('|'), ensureMentionUsersLoaded);
onBeforeUnmount(() => {
  realtimeStore.stopRoom();
  globalThis.document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  globalThis.document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (feedbackTimer != null) {
    globalThis.clearTimeout(feedbackTimer);
  }
});
</script>
