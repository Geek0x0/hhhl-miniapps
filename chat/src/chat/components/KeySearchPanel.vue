<template>
  <section class="side-panel">
    <p
      v-if="error != null"
      class="chat-error"
    >
      {{ error }}
    </p>
    <p
      v-if="loading"
      class="side-panel__loading"
    >
      {{ i18n.t('common.loading') }}
    </p>
    <ul class="side-panel__list side-panel__list--scrollable search-results">
      <li
        v-for="message in results"
        :key="message.id"
        class="search-result-row search-result-row--clickable"
        @click="copyText(message)"
      >
        <span
          class="search-result-row__avatar"
          aria-hidden="true"
        >
          {{ senderInitial(message) }}
        </span>
        <span class="search-result-row__main">
          <span class="search-result-row__meta">
            <strong>{{ senderName(message) }}</strong>
            <small>{{ formattedTime(message) }}</small>
          </span>
          <span class="search-result-row__text">{{ message.text ?? message.file?.name ?? message.id }}</span>
        </span>
      </li>
    </ul>
    <p
      v-if="copiedMessage"
      class="key-search-panel__toast"
    >
      {{ copiedMessage }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';

defineProps<{
  results: ChatMessage[];
  loading: boolean;
  error: string | null;
}>();

const copiedMessage = ref('');
let toastTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

onUnmounted(() => {
  if (toastTimer != null) {
    globalThis.clearTimeout(toastTimer);
  }
});

function senderName(message: ChatMessage): string {
  return message.user?.name ?? message.user?.username ?? message.user?.id ?? 'Unknown';
}

function senderInitial(message: ChatMessage): string {
  return senderName(message).trim().slice(0, 1).toUpperCase() || '?';
}

function formattedTime(message: ChatMessage): string {
  return new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function copyText(message: ChatMessage): Promise<void> {
  const text = message.text ?? message.file?.name ?? message.id;
  try {
    await globalThis.navigator.clipboard.writeText(text);
    showToast(i18n.t('chat.copiedToClipboard'));
  } catch {
    showToast(i18n.t('chat.copyFailed'));
  }
}

function showToast(msg: string): void {
  copiedMessage.value = msg;
  if (toastTimer != null) {
    globalThis.clearTimeout(toastTimer);
  }
  toastTimer = globalThis.setTimeout(() => {
    copiedMessage.value = '';
  }, 2000);
}
</script>

<style scoped>
.search-result-row--clickable {
  cursor: pointer;
}

.search-result-row--clickable:active {
  opacity: 0.7;
}

.key-search-panel__toast {
  text-align: center;
  font-size: 0.82rem;
  color: var(--tg-hint);
  margin: 4px 0 0;
}
</style>
