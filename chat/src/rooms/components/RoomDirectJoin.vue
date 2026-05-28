<template>
  <form
    class="room-direct-join"
    @submit.prevent="submit"
  >
    <label
      class="room-direct-join__label"
      for="room-id-input"
    >
      {{ i18n.t('rooms.directJoin') }}
    </label>
    <div class="room-direct-join__row">
      <input
        id="room-id-input"
        v-model="roomId"
        autocomplete="off"
        class="room-direct-join__input"
        placeholder="roomId"
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
