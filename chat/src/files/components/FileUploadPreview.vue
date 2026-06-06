<template>
  <div class="file-upload-preview">
    <img
      v-if="item.previewUrl != null"
      :src="item.previewUrl"
      :alt="i18n.t('files.imagePreview')"
      class="file-upload-preview__image"
    >
    <span class="file-upload-preview__name">{{ item.file.name }}</span>
    <span
      v-if="item.status === 'failed' && item.error != null"
      class="file-upload-preview__error"
    >
      {{ i18n.t('files.uploadFailed', { error: item.error }) }}
    </span>
    <button
      v-if="item.status === 'failed'"
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('files.retryUpload')"
      @click="$emit('retry', item.id)"
    >
      <RefreshCw :size="16" />
    </button>
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('common.clear')"
      @click="$emit('remove', item.id)"
    >
      <X :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, X } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { UploadItem } from '../uploadQueue';

defineProps<{
  item: UploadItem;
}>();

defineEmits<{
  remove: [id: string];
  retry: [id: string];
}>();
</script>
