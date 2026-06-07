<template>
  <TelegramOnly v-if="!canRenderMiniApp" />
  <LoginGate v-else />
  <aside
    v-if="updatePromptVisible"
    class="app-update-banner"
    role="status"
    aria-live="polite"
  >
    <span>{{ i18n.t('appUpdate.available', { version: remoteUpdateVersion ?? '' }) }}</span>
    <button
      class="app-update-banner__button"
      type="button"
      @click="reloadForUpdate"
    >
      {{ i18n.t('appUpdate.refresh') }}
    </button>
    <button
      class="app-update-banner__dismiss"
      type="button"
      :aria-label="i18n.t('appUpdate.dismiss')"
      @click="dismissUpdatePrompt"
    >
      x
    </button>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import LoginGate from './auth/components/LoginGate.vue';
import TelegramOnly from './auth/components/TelegramOnly.vue';
import { i18n } from './i18n';
import { useSettingsStore } from './settings/settingsStore';
import { resolveTelegramGateEnvironment, shouldRenderMiniApp } from './telegram/environmentGate';
import { isTelegramEnvironment, readyTelegram } from './telegram/telegram';
import { checkForAppUpdate } from './update/updateChecker';

const TELEGRAM_BRIDGE_RECOVERY_DELAY_MS = 250;
const TELEGRAM_BRIDGE_RECOVERY_MAX_ATTEMPTS = 8;

const settings = useSettingsStore();
const initialTelegramEnvironment = isTelegramEnvironment();
const isTelegram = ref(resolveTelegramGateEnvironment(initialTelegramEnvironment));
const canRenderMiniApp = computed(() => shouldRenderMiniApp(isTelegram.value));
const remoteUpdateVersion = ref<string | null>(null);
const dismissedUpdateVersion = ref<string | null>(null);
const updatePromptVisible = computed(() => remoteUpdateVersion.value != null && dismissedUpdateVersion.value !== remoteUpdateVersion.value);
let hasLiveTelegramEnvironment = initialTelegramEnvironment;
let telegramBridgeRecoveryAttempts = 0;
let telegramBridgeRecoveryTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
let updateCheckInFlight = false;

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
    void checkAppUpdate();
  }
}

function handlePageShow(): void {
  recoverTelegramEnvironment();
  void checkAppUpdate();
}

async function checkAppUpdate(): Promise<void> {
  if (updateCheckInFlight) {
    return;
  }

  updateCheckInFlight = true;
  try {
    const result = await checkForAppUpdate();
    if (result.updateAvailable && result.remoteVersion != null) {
      remoteUpdateVersion.value = result.remoteVersion;
    }
  } finally {
    updateCheckInFlight = false;
  }
}

function dismissUpdatePrompt(): void {
  dismissedUpdateVersion.value = remoteUpdateVersion.value;
}

function reloadForUpdate(): void {
  globalThis.location.reload();
}

if (isTelegram.value) {
  readyTelegram();
}

onMounted(() => {
  settings.init();
  void checkAppUpdate();
  scheduleTelegramBridgeRecovery();
  globalThis.addEventListener('pageshow', handlePageShow);
  globalThis.document.addEventListener('visibilitychange', refreshTelegramEnvironmentWhenVisible);
});

onBeforeUnmount(() => {
  clearTelegramBridgeRecovery();
  globalThis.removeEventListener('pageshow', handlePageShow);
  globalThis.document.removeEventListener('visibilitychange', refreshTelegramEnvironmentWhenVisible);
});
</script>
