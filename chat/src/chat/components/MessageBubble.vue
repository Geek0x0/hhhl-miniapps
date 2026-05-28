<template>
  <article
    class="message-bubble"
    :class="{ 'message-bubble--pending': entry.kind === 'pending' }"
  >
    <div class="message-bubble__body">
      <p class="message-bubble__text">
        {{ entry.message.text ?? entry.message.file?.name ?? '' }}
      </p>
      <small v-if="entry.kind === 'pending'">
        {{ entry.status === 'failed' ? i18n.t('chat.failed') : i18n.t('chat.pending') }}
      </small>
      <small v-else>{{ formattedTime }}</small>
    </div>
    <MessageActions
      v-if="entry.kind === 'server'"
      :message="entry.message"
      @reply="$emit('reply', $event)"
      @quote="$emit('quote', $event)"
      @react="(messageId, reaction) => $emit('react', messageId, reaction)"
      @delete="$emit('delete', $event)"
    />
    <div
      v-else-if="entry.status === 'failed'"
      class="message-actions"
    >
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.retry')"
        @click="$emit('retry', entry.localId)"
      >
        <RefreshCw :size="16" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.clear')"
        @click="$emit('remove', entry.localId)"
      >
        <X :size="16" />
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RefreshCw, X } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';
import type { TimelineEntry } from '../timelineMerge';
import MessageActions from './MessageActions.vue';

const props = defineProps<{
  entry: TimelineEntry;
}>();

defineEmits<{
  reply: [message: ChatMessage];
  quote: [message: ChatMessage];
  react: [messageId: string, reaction: string];
  delete: [messageId: string];
  retry: [localId: string];
  remove: [localId: string];
}>();

const formattedTime = computed(() => new Date(props.entry.message.createdAt).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
}));
</script>
