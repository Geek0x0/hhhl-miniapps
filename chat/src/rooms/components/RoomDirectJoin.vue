<template>
  <form
    class="room-panel"
    @submit.prevent="submit"
  >
    <h2>
      {{ i18n.t('rooms.directJoin') }}
    </h2>
    <div class="room-direct-join__row">
      <input
        id="room-id-input"
        v-model="roomId"
        :aria-label="i18n.t('rooms.directJoin')"
        autocomplete="off"
        class="room-direct-join__input"
        :placeholder="i18n.t('rooms.directJoinPlaceholder')"
      >
      <button
        class="app-button"
        type="submit"
        :disabled="roomId.trim() === '' || loading"
      >
        {{ i18n.t('rooms.directJoin') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { i18n } from '@/i18n';

const props = defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  join: [roomId: string];
}>();

const roomId = ref('');

function submit(): void {
  const value = roomId.value.trim();
  if (value === '' || props.loading) {
    return;
  }

  emit('join', value);
  roomId.value = '';
}
</script>
