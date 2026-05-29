<template>
  <div
    v-if="message != null"
    class="room-error"
    role="alert"
  >
    <span>{{ displayMessage }}</span>
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
import { computed } from 'vue';
import { i18n } from '@/i18n';

const props = defineProps<{
  message: string | null;
}>();

defineEmits<{
  clear: [];
}>();

const displayMessage = computed(() => {
  const message = props.message;
  if (message == null) {
    return '';
  }

  if (/not found|no such room|NO_SUCH_ROOM|HTTP_404/i.test(message)) {
    return i18n.t('rooms.notFound');
  }

  return message;
});
</script>
