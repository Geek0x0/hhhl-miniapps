<template>
  <div
    v-if="message != null"
    class="room-error"
    role="alert"
  >
    <span>{{ message }}</span>
    <button
      class="app-button app-button-secondary"
      type="button"
      @click="$emit('clear')"
    >
      {{ i18n.t('common.clear') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';

defineProps<{
  message: string | null;
}>();

defineEmits<{
  clear: [];
}>();
</script>
