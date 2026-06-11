<template>
  <section class="room-panel room-disclosure room-direct-join-panel">
    <h2 class="room-disclosure__heading">
      <button
        class="room-disclosure__toggle"
        type="button"
        aria-controls="room-direct-join-form"
        :aria-expanded="directJoinOpen"
        @click="directJoinOpen = !directJoinOpen"
      >
        <span>
          {{ i18n.t('rooms.directJoin') }}
        </span>
        <ChevronDown
          class="room-disclosure__icon"
          :class="{ 'is-open': directJoinOpen }"
          :size="18"
          aria-hidden="true"
        />
      </button>
    </h2>
    <Transition name="room-disclosure">
      <form
        v-if="directJoinOpen"
        id="room-direct-join-form"
        class="room-disclosure__body"
        @submit.prevent="submit"
      >
        <p class="app-copy room-panel__description">
          {{ i18n.t('rooms.directJoinPlaceholder') }}
        </p>
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
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown } from '@lucide/vue';
import { i18n } from '@/i18n';

const props = defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  join: [roomId: string];
}>();

const directJoinOpen = ref(false);
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
