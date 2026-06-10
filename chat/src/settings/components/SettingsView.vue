<template>
  <main class="rooms-shell">
    <header class="rooms-header">
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.back')"
        @click="router.push('/rooms')"
      >
        <ArrowLeft :size="20" />
      </button>
      <div class="rooms-header__title">
        <p class="app-eyebrow">
          dc.hhhl.cc
        </p>
        <h1>{{ i18n.t('settings.title') }}</h1>
      </div>
    </header>

    <section class="side-panel">
      <label
        class="room-direct-join__label"
        for="language-select"
      >
        {{ i18n.t('settings.language') }}
      </label>
      <select
        id="language-select"
        v-model="settings.language"
        class="room-direct-join__input"
        @change="settings.setLanguage(settings.language)"
      >
        <option value="en">
          English
        </option>
        <option value="zh">
          中文
        </option>
      </select>
      <div class="settings-field">
        <span class="room-direct-join__label">{{ i18n.t('settings.theme') }}</span>
        <div
          class="segmented-control"
          role="radiogroup"
          :aria-label="i18n.t('settings.theme')"
        >
          <button
            v-for="option in themeOptions"
            :key="option.value"
            class="segmented-control__option"
            :class="{ 'segmented-control__option--active': settings.themeMode === option.value }"
            type="button"
            role="radio"
            :aria-checked="settings.themeMode === option.value"
            @click="settings.setThemeMode(option.value)"
          >
            <component
              :is="option.icon"
              :size="16"
            />
            <span>{{ i18n.t(option.label) }}</span>
          </button>
        </div>
      </div>
      <p class="app-copy">
        {{ DC_HHHL_ORIGIN }} · {{ realtimeStore.status }} · v{{ appVersion }}
      </p>
      <div
        class="settings-field"
        aria-live="polite"
      >
        <span class="room-direct-join__label">{{ i18n.t('settings.sync') }}</span>
        <p class="app-copy">
          <strong>{{ i18n.t(syncStatusLabel) }}</strong>
        </p>
        <p
          v-if="settings.lastSyncedAt != null"
          class="app-copy"
        >
          {{ i18n.t('settings.lastSynced', { time: settings.lastSyncedAt }) }}
        </p>
        <p
          v-if="settings.syncError != null"
          class="app-copy"
          role="alert"
        >
          {{ i18n.t('settings.syncError', { error: settings.syncError }) }}
        </p>
      </div>
      <div class="app-actions settings-actions">
        <button
          class="app-button app-button-secondary"
          type="button"
          :disabled="syncBusy"
          @click="saveToDrive"
        >
          {{ i18n.t('settings.saveToDrive') }}
        </button>
        <button
          class="app-button app-button-secondary"
          type="button"
          @click="settings.clearLocalData()"
        >
          {{ i18n.t('settings.clearLocalData') }}
        </button>
        <button
          class="app-button app-button-secondary"
          type="button"
          @click="toggleDiagnostics"
        >
          {{ i18n.t('settings.diagnostics') }}
        </button>
        <button
          class="app-button"
          type="button"
          @click="logout"
        >
          {{ i18n.t('auth.logout') }}
        </button>
      </div>
      <p
        v-if="settings.lastAction != null"
        class="app-copy"
      >
        {{ i18n.t(settings.lastAction) }}
      </p>
    </section>

    <DiagnosticsPanel
      v-if="settings.debugOpen"
      :safe-diagnostics="settings.safeDiagnostics"
      :detailed-diagnostics="settings.detailedDiagnostics"
      :detail-confirmed="settings.diagnosticsDetailConfirmed"
      @confirm-detail="settings.confirmDiagnosticsDetail"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Monitor, Moon, Sun } from '@lucide/vue';
import { createAuthDependencies, useAuthStore } from '@/auth/authStore';
import { useChatStore } from '@/chat/chatStore';
import { MESSAGE_POLLING_INTERVAL_MS, MESSAGE_UPDATE_MODE } from '@/chat/messageUpdates';
import { i18n, type MessageKey } from '@/i18n';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import type { RoomSummary, UserSummary } from '@/shared/types';
import { useRealtimeStore } from '@/realtime/realtimeStore';
import { useRoomStore } from '@/rooms/roomStore';
import { getTelegramLaunchContext, isTelegramEnvironment } from '@/telegram/telegram';
import type { DiagnosticsRedactionIdentifierInput } from '../diagnostics';
import { useSettingsStore, type ThemeMode } from '../settingsStore';
import DiagnosticsPanel from './DiagnosticsPanel.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const settings = useSettingsStore();
const realtimeStore = useRealtimeStore();
const roomStore = useRoomStore();
const chatStore = useChatStore();
const telegramLaunchContext = getTelegramLaunchContext();
const appVersion = __APP_VERSION__;
const themeOptions: Array<{ value: ThemeMode; label: MessageKey; icon: typeof Monitor }> = [
  { value: 'system', label: 'settings.themeSystem', icon: Monitor },
  { value: 'light', label: 'settings.themeLight', icon: Sun },
  { value: 'dark', label: 'settings.themeDark', icon: Moon },
];

const syncStatusLabel = computed<MessageKey>(() => {
  switch (settings.syncStatus) {
    case 'loading':
      return 'settings.syncLoading';
    case 'saving':
      return 'settings.syncSaving';
    case 'synced':
      return 'settings.syncSynced';
    case 'failed':
      return 'settings.syncFailed';
    default:
      return 'settings.syncIdle';
  }
});

const syncBusy = computed(() => settings.syncStatus === 'loading' || settings.syncStatus === 'saving');

onMounted(() => settings.init());

function routeName(): string | null {
  if (typeof route.name === 'string') {
    return route.name;
  }
  return route.name == null ? null : String(route.name);
}

function routeRoomId(): string | null {
  const param = route.params.roomId;
  if (typeof param === 'string' && param.trim() !== '') {
    return param;
  }
  if (Array.isArray(param)) {
    const first = param.find((entry) => typeof entry === 'string' && entry.trim() !== '');
    if (first != null) {
      return first;
    }
  }

  return roomIdFromRoutePath(route.path);
}

function roomIdFromRoutePath(path: string): string | null {
  const normalizedPath = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  const match = /^\/rooms\/([^/]+)(?:\/|$)/.exec(normalizedPath);
  const roomId = match?.[1]?.trim();

  if (roomId == null || roomId === '') {
    return null;
  }

  try {
    return decodeURIComponent(roomId);
  } catch {
    return roomId;
  }
}

function documentVisibility(): string {
  return globalThis.document.visibilityState;
}

function chatRoomMatchesRoute(routeRoomId: string | null): boolean {
  return routeRoomId != null && chatStore.roomId === routeRoomId;
}

function realtimeRoomMatchesRoute(routeRoomId: string | null): boolean {
  return routeRoomId != null && realtimeStore.roomId === routeRoomId;
}

function messagePollingEligible(routeRoomId: string | null): boolean {
  return (
    routeRoomId != null &&
    chatStore.roomId === routeRoomId &&
    !chatStore.loading
  );
}

function activeRoomName(): string | null {
  const activeRoomId = roomStore.activeRoomId;
  if (activeRoomId == null) {
    return null;
  }
  return (
    roomStore.rooms.find((entry) => entry.room.id === activeRoomId)?.room.name ??
    (roomStore.deepLinkedRoom?.id === activeRoomId ? roomStore.deepLinkedRoom.name : null)
  );
}

function currentMemberCount(): number {
  const activeRoomId = roomStore.activeRoomId;
  if (activeRoomId == null) {
    return 0;
  }
  return roomStore.membersByRoomId[activeRoomId]?.length ?? 0;
}

function failedOutgoingCount(): number {
  return chatStore.outgoing.filter((item) => item.status === 'failed').length;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function timelineEntryKind(entry: unknown): string | null {
  const kind = recordFrom(entry)?.kind;
  return typeof kind === 'string' && kind.trim() !== '' ? kind : null;
}

function isServerTimelineEntry(entry: unknown): boolean {
  const kind = timelineEntryKind(entry);
  return kind == null || kind === 'server';
}

function messageRecordFromTimelineEntry(entry: unknown): Record<string, unknown> | null {
  const record = recordFrom(entry);
  if (record == null) {
    return null;
  }

  return recordFrom(record.message) ?? record;
}

function timelineEntryCreatedAt(entry: unknown): string | null {
  const createdAt = messageRecordFromTimelineEntry(entry)?.createdAt;
  return typeof createdAt === 'string' && createdAt.trim() !== '' ? createdAt : null;
}

function serverTimelineEntries(): unknown[] {
  return chatStore.timeline.filter(isServerTimelineEntry);
}

function pendingTimelineCount(): number {
  return chatStore.timeline.filter((entry) => timelineEntryKind(entry) === 'pending').length;
}

function lastServerMessageAt(): string | null {
  const serverEntries = serverTimelineEntries();
  for (let index = serverEntries.length - 1; index >= 0; index -= 1) {
    const createdAt = timelineEntryCreatedAt(serverEntries[index]);
    if (createdAt != null) {
      return createdAt;
    }
  }

  return null;
}

function lastTimelineEntryKind(): string | null {
  const lastEntry = chatStore.timeline.at(-1);
  if (lastEntry == null) {
    return null;
  }

  return timelineEntryKind(lastEntry) ?? 'server';
}

function addRedactionIdentifier(
  identifiers: DiagnosticsRedactionIdentifierInput[],
  value: string | null | undefined,
  caseInsensitive = false,
): void {
  if (value != null && value.trim() !== '') {
    identifiers.push({ value, caseInsensitive });
  }
}

function addRoomRedactionIdentifiers(
  identifiers: DiagnosticsRedactionIdentifierInput[],
  room: Pick<RoomSummary, 'id' | 'name'> | null | undefined,
): void {
  if (room == null) {
    return;
  }

  addRedactionIdentifier(identifiers, room.id);
  addRedactionIdentifier(identifiers, room.name, true);
}

function addUserRedactionIdentifiers(
  identifiers: DiagnosticsRedactionIdentifierInput[],
  user: Pick<UserSummary, 'id' | 'username' | 'name'> | null | undefined,
): void {
  if (user == null) {
    return;
  }

  addRedactionIdentifier(identifiers, user.id);
  addRedactionIdentifier(identifiers, user.username, true);
  addRedactionIdentifier(identifiers, user.name, true);
}

function redactionIdentifiers(): DiagnosticsRedactionIdentifierInput[] {
  const identifiers: DiagnosticsRedactionIdentifierInput[] = [];

  addUserRedactionIdentifiers(identifiers, auth.user);
  for (const favoriteUserId of settings.favoriteUserIds) {
    addRedactionIdentifier(identifiers, favoriteUserId);
  }

  for (const entry of roomStore.rooms) {
    addRoomRedactionIdentifiers(identifiers, entry.room);
  }
  for (const room of roomStore.manualRooms ?? []) {
    addRoomRedactionIdentifiers(identifiers, room);
  }
  addRoomRedactionIdentifiers(identifiers, roomStore.deepLinkedRoom);
  for (const invitation of roomStore.invitations) {
    addRoomRedactionIdentifiers(identifiers, invitation.room ?? null);
    addRedactionIdentifier(identifiers, invitation.roomId);
  }
  for (const invitation of roomStore.outboxInvitations) {
    addRoomRedactionIdentifiers(identifiers, invitation.room ?? null);
    addRedactionIdentifier(identifiers, invitation.roomId);
  }

  addRedactionIdentifier(identifiers, realtimeStore.roomId);
  addRedactionIdentifier(identifiers, routeRoomId());
  addRedactionIdentifier(identifiers, roomStore.activeRoomId);
  addRedactionIdentifier(identifiers, roomStore.pendingStartRoomId);
  addRedactionIdentifier(identifiers, chatStore.roomId);

  for (const roomId of Object.keys(roomStore.membersByRoomId)) {
    addRedactionIdentifier(identifiers, roomId);
  }
  for (const roomId of Object.keys(roomStore.membersLoadingByRoomId ?? {})) {
    addRedactionIdentifier(identifiers, roomId);
  }
  for (const roomId of Object.keys(roomStore.membersHasMoreByRoomId ?? {})) {
    addRedactionIdentifier(identifiers, roomId);
  }
  for (const members of Object.values(roomStore.membersByRoomId)) {
    for (const member of members) {
      addUserRedactionIdentifiers(identifiers, member);
    }
  }

  return identifiers;
}

function collectSettingsDiagnostics(): void {
  const currentRouteRoomId = routeRoomId();
  const currentDocumentVisibility = documentVisibility();

  settings.collectDiagnostics({
    environment: {
      appVersion,
      mode: import.meta.env.MODE,
      isDev: import.meta.env.DEV,
      instanceUrl: DC_HHHL_ORIGIN,
      telegramPresent: isTelegramEnvironment(),
      telegramPlatform: telegramLaunchContext.platform,
    },
    auth: {
      status: auth.status,
      hasUser: auth.user != null,
      userId: auth.user?.id ?? null,
      username: auth.user?.username ?? auth.user?.name ?? null,
      error: auth.error,
    },
    route: {
      name: routeName(),
      path: route.path,
      roomId: currentRouteRoomId,
    },
    realtime: {
      status: realtimeStore.status,
      roomId: realtimeStore.roomId,
    },
    rooms: {
      loading: roomStore.loading,
      roomCount: roomStore.rooms.length,
      invitationCount: roomStore.invitations.length,
      activeRoomId: roomStore.activeRoomId,
      activeRoomName: activeRoomName(),
      pendingStartRoomId: roomStore.pendingStartRoomId,
      memberCount: currentMemberCount(),
      outboxInvitationCount: roomStore.outboxInvitations.length,
      error: roomStore.error,
    },
    chat: {
      loading: chatStore.loading,
      roomId: chatStore.roomId,
      documentVisibility: currentDocumentVisibility,
      messageUpdateMode: MESSAGE_UPDATE_MODE,
      messagePollingIntervalMs: MESSAGE_POLLING_INTERVAL_MS,
      messagePollingEligible: messagePollingEligible(currentRouteRoomId),
      chatRoomMatchesRoute: chatRoomMatchesRoute(currentRouteRoomId),
      realtimeRoomMatchesRoute: realtimeRoomMatchesRoute(currentRouteRoomId),
      olderLoading: chatStore.olderLoading,
      newerLoading: chatStore.newerLoading,
      hasMoreOlder: chatStore.hasMoreOlder,
      timelineCount: chatStore.timeline.length,
      serverTimelineCount: serverTimelineEntries().length,
      pendingTimelineCount: pendingTimelineCount(),
      lastServerMessageAt: lastServerMessageAt(),
      lastTimelineEntryKind: lastTimelineEntryKind(),
      outgoingCount: chatStore.outgoing.length,
      failedOutgoingCount: failedOutgoingCount(),
      searchResultCount: chatStore.searchResults.length,
      keySearchResultCount: chatStore.keySearchResults.length,
      replyTargetPresent: chatStore.replyTarget != null,
      quoteTargetPresent: chatStore.quoteTarget != null,
      error: chatStore.error,
      searchError: chatStore.searchError,
      keySearchError: chatStore.keySearchError,
    },
    redactionIdentifiers: redactionIdentifiers(),
  });
}

function toggleDiagnostics(): void {
  settings.toggleDebug();
  if (settings.debugOpen) {
    collectSettingsDiagnostics();
  }
}

async function saveToDrive(): Promise<void> {
  await settings.saveToCloud();
}

function logout(): void {
  const dependencies = createAuthDependencies();
  settings.logout(auth, dependencies, router);
}
</script>
