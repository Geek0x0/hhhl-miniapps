<template>
  <TelegramOnly v-if="!canRenderMiniApp" />
  <LoginGate v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import LoginGate from './auth/components/LoginGate.vue';
import TelegramOnly from './auth/components/TelegramOnly.vue';
import { useSettingsStore } from './settings/settingsStore';
import { shouldRenderMiniApp } from './telegram/environmentGate';
import { isTelegramEnvironment, readyTelegram } from './telegram/telegram';

const settings = useSettingsStore();
const isTelegram = isTelegramEnvironment();
const canRenderMiniApp = shouldRenderMiniApp(isTelegram);

if (isTelegram) {
  readyTelegram();
}

onMounted(() => settings.init());
</script>
