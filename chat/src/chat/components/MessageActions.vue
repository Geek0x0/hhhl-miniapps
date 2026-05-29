<template>
  <div class="message-actions">
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('chat.replyingTo', { name: message.user?.name ?? message.user?.username ?? message.id })"
      @click="$emit('reply', message)"
    >
      <Reply :size="16" />
    </button>
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('chat.quote')"
      @click="$emit('quote', message)"
    >
      <Quote :size="16" />
    </button>
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('chat.reactions')"
      @click="showPicker = !showPicker"
    >
      <SmilePlus :size="16" />
    </button>
    <button
      v-if="canDelete"
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('chat.deleteMessage')"
      @click="$emit('delete', message.id)"
    >
      <Trash2 :size="16" />
    </button>
    <ReactionPicker
      v-if="showPicker"
      @select="handleReaction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Quote, Reply, SmilePlus, Trash2 } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';
import ReactionPicker from './ReactionPicker.vue';

const props = defineProps<{
  message: ChatMessage;
  canDelete: boolean;
}>();

const emit = defineEmits<{
  reply: [message: ChatMessage];
  quote: [message: ChatMessage];
  react: [messageId: string, reaction: string];
  delete: [messageId: string];
}>();

const showPicker = ref(false);

function handleReaction(reaction: string): void {
  emit('react', props.message.id, reaction);
  showPicker.value = false;
}
</script>
