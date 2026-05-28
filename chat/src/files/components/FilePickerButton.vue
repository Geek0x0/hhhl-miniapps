<template>
  <label class="chat-icon-button file-picker-button">
    <Paperclip :size="18" />
    <span class="sr-only">{{ i18n.t('files.select') }}</span>
    <input
      class="file-picker-button__input"
      type="file"
      multiple
      @change="handleChange"
    >
  </label>
</template>

<script setup lang="ts">
/* global Event, File, HTMLInputElement */
import { Paperclip } from '@lucide/vue';
import { i18n } from '@/i18n';

const emit = defineEmits<{
  select: [files: File[]];
}>();

function handleChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  emit('select', Array.from(input.files ?? []));
  input.value = '';
}
</script>
