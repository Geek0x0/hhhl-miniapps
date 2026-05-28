<template>
  <TelegramOnly v-if="!isTelegram" />
  <LoginGate v-else />
</template>

<script setup lang="ts">
import LoginGate from './auth/components/LoginGate.vue';
import TelegramOnly from './auth/components/TelegramOnly.vue';
import { isTelegramEnvironment, readyTelegram } from './telegram/telegram';

const isTelegram = isTelegramEnvironment();

if (isTelegram) {
  readyTelegram();
}
</script>
