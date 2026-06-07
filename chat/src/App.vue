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

const TELEGRAM_BRIDGE_RECOVERY_DELAY_MS = 250;
const TELEGRAM_BRIDGE_RECOVERY_MAX_ATTEMPTS = 8;

const settings = useSettingsStore();
const initialTelegramEnvironment = isTelegramEnvironment();
const isTelegram = ref(resolveTelegramGateEnvironment(initialTelegramEnvironment));
const canRenderMiniApp = computed(() => shouldRenderMiniApp(isTelegram.value));
let hasLiveTelegramEnvironment = initialTelegramEnvironment;
let telegramBridgeRecoveryAttempts = 0;
let telegramBridgeRecoveryTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

function clearTelegramBridgeRecovery(): void {
  if (telegramBridgeRecoveryTimer == null) {
    return;
  }

  globalThis.clearTimeout(telegramBridgeRecoveryTimer);
  telegramBridgeRecoveryTimer = undefined;
}

function refreshTelegramEnvironment(): void {
  const detectedTelegram = isTelegramEnvironment();
  hasLiveTelegramEnvironment = detectedTelegram;

  if (resolveTelegramGateEnvironment(detectedTelegram)) {
    isTelegram.value = true;
  }

  if (detectedTelegram) {
    clearTelegramBridgeRecovery();
    readyTelegram();
  }
}

function scheduleTelegramBridgeRecovery(): void {
  if (
    hasLiveTelegramEnvironment ||
    telegramBridgeRecoveryTimer != null ||
    telegramBridgeRecoveryAttempts >= TELEGRAM_BRIDGE_RECOVERY_MAX_ATTEMPTS
  ) {
    return;
  }

  telegramBridgeRecoveryTimer = globalThis.setTimeout(() => {
    telegramBridgeRecoveryTimer = undefined;
    telegramBridgeRecoveryAttempts += 1;
    refreshTelegramEnvironment();
    scheduleTelegramBridgeRecovery();
  }, TELEGRAM_BRIDGE_RECOVERY_DELAY_MS);
}

function recoverTelegramEnvironment(): void {
  telegramBridgeRecoveryAttempts = 0;
  refreshTelegramEnvironment();
  scheduleTelegramBridgeRecovery();
}

function refreshTelegramEnvironmentWhenVisible(): void {
  if (globalThis.document.visibilityState === 'visible') {
    recoverTelegramEnvironment();
  }
}

if (isTelegram.value) {
  readyTelegram();
}

onMounted(() => {
  settings.init();
  scheduleTelegramBridgeRecovery();
  globalThis.addEventListener('pageshow', recoverTelegramEnvironment);
  globalThis.document.addEventListener('visibilitychange', refreshTelegramEnvironmentWhenVisible);
});

onBeforeUnmount(() => {
  clearTelegramBridgeRecovery();
  globalThis.removeEventListener('pageshow', recoverTelegramEnvironment);
  globalThis.document.removeEventListener('visibilitychange', refreshTelegramEnvironmentWhenVisible);
});
</script>
