<template>
  <form
    class="message-composer"
    @submit.prevent="submit"
  >
    <ReplyPreview
      :label="i18n.t('chat.replyingTo', { name: replyTarget?.user?.name ?? replyTarget?.user?.username ?? replyTarget?.id ?? '' })"
      :message="replyTarget"
      @clear="$emit('clearContext')"
    />
    <ReplyPreview
      :label="i18n.t('chat.quote')"
      :message="quoteTarget"
      @clear="$emit('clearContext')"
    />
    <div class="message-composer__row">
      <textarea
        v-model="text"
        class="message-composer__input"
        :placeholder="i18n.t('chat.composerPlaceholder')"
        rows="1"
      />
      <button
        class="chat-icon-button chat-icon-button--send"
        type="submit"
        :aria-label="i18n.t('common.send')"
        :disabled="text.trim() === ''"
      >
        <Send :size="18" />
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Send } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';
import ReplyPreview from './ReplyPreview.vue';

defineProps<{
  replyTarget: ChatMessage | null;
  quoteTarget: ChatMessage | null;
}>();

const emit = defineEmits<{
  send: [text: string];
  clearContext: [];
}>();

const text = ref('');

function submit(): void {
  const value = text.value.trim();
  if (value === '') {
    return;
  }

  emit('send', value);
  text.value = '';
}
</script>
