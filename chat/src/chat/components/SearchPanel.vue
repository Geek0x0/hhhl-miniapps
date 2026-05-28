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
    <p class="app-copy">
      {{ results.length }}
    </p>
    <ul class="side-panel__list">
      <li
        v-for="message in results"
        :key="message.id"
      >
        {{ message.text ?? message.id }}
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
</script>
