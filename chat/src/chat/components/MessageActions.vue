<template>
  <div
    ref="actionsEl"
    class="message-actions"
  >
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
import { onBeforeUnmount, onMounted, ref } from 'vue';
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
const actionsEl = ref<globalThis.HTMLElement | null>(null);

function handleReaction(reaction: string): void {
  emit('react', props.message.id, reaction);
  showPicker.value = false;
}

function handleClickOutside(event: globalThis.MouseEvent): void {
  if (showPicker.value && actionsEl.value != null && !actionsEl.value.contains(event.target as globalThis.Node)) {
    showPicker.value = false;
  }
}

function handleKeydown(event: globalThis.KeyboardEvent): void {
  if (showPicker.value && event.key === 'Escape') {
    showPicker.value = false;
  }
}

onMounted(() => {
  globalThis.document.addEventListener('click', handleClickOutside);
  globalThis.document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  globalThis.document.removeEventListener('click', handleClickOutside);
  globalThis.document.removeEventListener('keydown', handleKeydown);
});
</script>
