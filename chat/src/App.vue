<template>
  <TelegramOnly v-if="!isTelegram" />
  <RouterView v-else />
</template>

<script setup lang="ts">
import TelegramOnly from './auth/components/TelegramOnly.vue';
import { isTelegramEnvironment, readyTelegram } from './telegram/telegram';

const isTelegram = isTelegramEnvironment();

if (isTelegram) {
  readyTelegram();
}
</script>
