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
        {{ DC_HHHL_ORIGIN }} · {{ realtimeStore.status }}
      </p>
      <div class="app-actions">
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
      :diagnostics="settings.diagnostics"
    />
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Monitor, Moon, Sun } from '@lucide/vue';
import { createAuthDependencies, useAuthStore } from '@/auth/authStore';
import { i18n, type MessageKey } from '@/i18n';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { useRealtimeStore } from '@/realtime/realtimeStore';
import { useSettingsStore, type ThemeMode } from '../settingsStore';
import DiagnosticsPanel from './DiagnosticsPanel.vue';

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();
const realtimeStore = useRealtimeStore();
const themeOptions: Array<{ value: ThemeMode; label: MessageKey; icon: typeof Monitor }> = [
  { value: 'system', label: 'settings.themeSystem', icon: Monitor },
  { value: 'light', label: 'settings.themeLight', icon: Sun },
  { value: 'dark', label: 'settings.themeDark', icon: Moon },
];

onMounted(() => settings.init());

function toggleDiagnostics(): void {
  settings.toggleDebug();
  settings.collectDiagnostics({ instanceUrl: DC_HHHL_ORIGIN, realtimeStatus: realtimeStore.status });
}

function logout(): void {
  const dependencies = createAuthDependencies();
  settings.logout(auth, dependencies, router);
}
</script>
