<template>
  <section
    class="message-timeline"
    aria-live="polite"
  >
    <button
      class="app-button app-button-secondary message-timeline__older"
      type="button"
      @click="$emit('loadOlder')"
    >
      {{ i18n.t('common.loading') }}
    </button>
    <p
      v-if="entries.length === 0"
      class="app-copy"
    >
      {{ i18n.t('chat.empty') }}
    </p>
    <MessageBubble
      v-for="entry in entries"
      :key="entry.kind === 'pending' ? entry.localId : entry.message.id"
      :entry="entry"
      @reply="$emit('reply', $event)"
      @quote="$emit('quote', $event)"
      @react="(messageId, reaction) => $emit('react', messageId, reaction)"
      @delete="$emit('delete', $event)"
      @retry="$emit('retry', $event)"
      @remove="$emit('remove', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';
import type { TimelineEntry } from '../timelineMerge';
import MessageBubble from './MessageBubble.vue';

defineProps<{
  entries: TimelineEntry[];
}>();

defineEmits<{
  loadOlder: [];
  reply: [message: ChatMessage];
  quote: [message: ChatMessage];
  react: [messageId: string, reaction: string];
  delete: [messageId: string];
  retry: [localId: string];
  remove: [localId: string];
}>();
</script>
