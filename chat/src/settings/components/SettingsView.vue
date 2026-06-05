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
      <div class="app-actions">
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
import { i18n, type MessageKey } from '@/i18n';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { useRealtimeStore } from '@/realtime/realtimeStore';
import { useRoomStore } from '@/rooms/roomStore';
import { getTelegramLaunchContext, isTelegramEnvironment } from '@/telegram/telegram';
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

function currentRoomId(): string | null {
  return roomStore.activeRoomId ?? chatStore.roomId ?? realtimeStore.roomId ?? null;
}

function currentRoomName(): string | null {
  const roomId = currentRoomId();
  if (roomId == null) {
    return null;
  }
  return roomStore.rooms.find((entry) => entry.room.id === roomId)?.room.name ?? roomStore.deepLinkedRoom?.name ?? null;
}

function currentMemberCount(): number {
  const roomId = currentRoomId();
  if (roomId == null) {
    return 0;
  }
  return roomStore.membersByRoomId[roomId]?.length ?? 0;
}

function failedOutgoingCount(): number {
  return chatStore.outgoing.filter((item) => item.status === 'failed').length;
}

function collectSettingsDiagnostics(): void {
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
    },
    realtime: {
      status: realtimeStore.status,
      roomId: realtimeStore.roomId,
    },
    rooms: {
      loading: roomStore.loading,
      roomCount: roomStore.rooms.length,
      invitationCount: roomStore.invitations.length,
      activeRoomId: currentRoomId(),
      activeRoomName: currentRoomName(),
      pendingStartRoomId: roomStore.pendingStartRoomId,
      memberCount: currentMemberCount(),
      outboxInvitationCount: roomStore.outboxInvitations.length,
      error: roomStore.error,
    },
    chat: {
      loading: chatStore.loading,
      roomId: chatStore.roomId,
      timelineCount: chatStore.timeline.length,
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
