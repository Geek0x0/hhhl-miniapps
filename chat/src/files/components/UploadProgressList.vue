<template>
  <div
    v-if="items.length > 0"
    class="upload-progress-list"
  >
    <FileUploadPreview
      v-for="item in items"
      :key="item.id"
      :item="item"
      @remove="$emit('remove', $event)"
    />
    <div
      v-for="item in activeItems"
      :key="`${item.id}-progress`"
      class="upload-progress-list__row"
    >
      <span>{{ i18n.t('files.uploading', { name: item.file.name }) }}</span>
      <progress
        :value="item.progress"
        max="1"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { i18n } from '@/i18n';
import type { UploadItem } from '../uploadQueue';
import FileUploadPreview from './FileUploadPreview.vue';

const props = defineProps<{
  items: UploadItem[];
}>();

defineEmits<{
  remove: [id: string];
}>();

const activeItems = computed(() => props.items.filter((item) => item.status === 'uploading'));
</script>
