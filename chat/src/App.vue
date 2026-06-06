<template>
  <TelegramOnly v-if="!canRenderMiniApp" />
  <LoginGate v-else />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import LoginGate from './auth/components/LoginGate.vue';
import TelegramOnly from './auth/components/TelegramOnly.vue';
import { useSettingsStore } from './settings/settingsStore';
import { resolveTelegramGateEnvironment, shouldRenderMiniApp } from './telegram/environmentGate';
import { isTelegramEnvironment, readyTelegram } from './telegram/telegram';

const settings = useSettingsStore();
const isTelegram = ref(resolveTelegramGateEnvironment(isTelegramEnvironment()));
const canRenderMiniApp = computed(() => shouldRenderMiniApp(isTelegram.value));

function refreshTelegramEnvironment(): void {
  const detectedTelegram = isTelegramEnvironment();
  if (resolveTelegramGateEnvironment(detectedTelegram)) {
    isTelegram.value = true;
  }

  if (detectedTelegram) {
    readyTelegram();
  }
}

function refreshTelegramEnvironmentWhenVisible(): void {
  if (globalThis.document.visibilityState === 'visible') {
    refreshTelegramEnvironment();
  }
}

if (isTelegram.value) {
  readyTelegram();
}

onMounted(() => {
  settings.init();
  globalThis.addEventListener('pageshow', refreshTelegramEnvironment);
  globalThis.document.addEventListener('visibilitychange', refreshTelegramEnvironmentWhenVisible);
});

onBeforeUnmount(() => {
  globalThis.removeEventListener('pageshow', refreshTelegramEnvironment);
  globalThis.document.removeEventListener('visibilitychange', refreshTelegramEnvironmentWhenVisible);
});
</script>
