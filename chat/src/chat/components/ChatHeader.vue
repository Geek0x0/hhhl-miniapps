<template>
  <header class="chat-header">
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('rooms.title')"
      @click="$emit('back')"
    >
      <ArrowLeft :size="20" />
    </button>
    <div class="chat-header__title">
      <strong>{{ title }}</strong>
      <small>{{ roomId }}</small>
    </div>
    <span
      v-if="degraded"
      class="chat-header__status"
    >
      {{ i18n.t('realtime.polling') }}
    </span>
  </header>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue';
import { i18n } from '@/i18n';

defineProps<{
  roomId: string;
  title: string;
  degraded?: boolean;
}>();

defineEmits<{
  back: [];
}>();
</script>
