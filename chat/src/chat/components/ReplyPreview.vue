<template>
  <div
    v-if="message != null"
    class="reply-preview"
  >
    <span>{{ label }}: {{ message.text ?? message.id }}</span>
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('common.clear')"
      @click="$emit('clear')"
    >
      <X :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';

defineProps<{
  label: string;
  message: ChatMessage | null;
}>();

defineEmits<{
  clear: [];
}>();
</script>
