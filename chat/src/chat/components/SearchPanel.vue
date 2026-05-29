<template>
  <section class="side-panel">
    <form
      class="side-panel__form"
      @submit.prevent="$emit('search', query)"
    >
      <input
        v-model="query"
        class="room-direct-join__input"
        :aria-label="i18n.t('chat.searchPlaceholder')"
        :placeholder="i18n.t('chat.searchPlaceholder')"
      >
      <button
        class="app-button"
        type="submit"
        :disabled="query.trim() === '' || loading"
      >
        {{ i18n.t('common.search') }}
      </button>
    </form>
    <p
      v-if="error != null"
      class="chat-error"
    >
      {{ error }}
    </p>
    <ul class="side-panel__list search-results">
      <li
        v-for="message in results"
        :key="message.id"
        class="search-result-row"
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
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';

defineProps<{
  results: ChatMessage[];
  loading: boolean;
  error: string | null;
}>();

defineEmits<{
  search: [query: string];
}>();

const query = ref('');

function senderName(message: ChatMessage): string {
  return message.user?.name ?? message.user?.username ?? message.user?.id ?? 'Unknown';
}

function senderInitial(message: ChatMessage): string {
  return senderName(message).trim().slice(0, 1).toUpperCase() || '?';
}

function formattedTime(message: ChatMessage): string {
  return new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>
