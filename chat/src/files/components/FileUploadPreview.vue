<template>
  <div class="file-upload-preview">
    <img
      v-if="item.previewUrl != null"
      :src="item.previewUrl"
      :alt="i18n.t('files.imagePreview')"
      class="file-upload-preview__image"
    >
    <span class="file-upload-preview__name">{{ item.file.name }}</span>
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
import { X } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { UploadItem } from '../uploadQueue';

defineProps<{
  item: UploadItem;
}>();

defineEmits<{
  remove: [id: string];
}>();
</script>
