<template>
  <section class="room-panel room-disclosure room-create-panel">
    <h2 class="room-disclosure__heading">
      <button
        class="room-disclosure__toggle"
        type="button"
        aria-controls="room-create-form"
        :aria-expanded="createOpen"
        @click="createOpen = !createOpen"
      >
        <span>{{ i18n.t('rooms.create') }}</span>
        <ChevronDown
          class="room-disclosure__icon"
          :class="{ 'is-open': createOpen }"
          :size="18"
          aria-hidden="true"
        />
      </button>
    </h2>
    <Transition name="room-disclosure">
      <form
        v-if="createOpen"
        id="room-create-form"
        class="room-disclosure__body"
        @submit.prevent="submit"
      >
        <div class="room-create-dialog__row">
          <input
            v-model="name"
            class="room-direct-join__input"
            :aria-label="i18n.t('rooms.name')"
            :placeholder="i18n.t('rooms.create')"
          >
          <span aria-hidden="true" />
          <select
            v-model="joinMode"
            class="room-direct-join__input"
            :aria-label="i18n.t('rooms.joinMode')"
          >
            <option value="public">
              {{ i18n.t('rooms.joinModePublic') }}
            </option>
            <option value="invite">
              {{ i18n.t('rooms.joinModeInvite') }}
            </option>
          </select>
        </div>
        <textarea
          v-model="description"
          class="message-composer__input"
          :aria-label="i18n.t('rooms.description')"
          :placeholder="i18n.t('rooms.description')"
        />
        <button
          class="app-button"
          type="submit"
          :disabled="name.trim() === ''"
        >
          {{ i18n.t('rooms.create') }}
        </button>
      </form>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { RoomCreateParams } from '../roomApi';

const emit = defineEmits<{
  create: [params: RoomCreateParams];
}>();

const name = ref('');
const description = ref('');
const joinMode = ref('public');
const createOpen = ref(false);

function submit(): void {
  if (name.value.trim() === '') {
    return;
  }

  emit('create', { name: name.value.trim(), description: description.value.trim(), joinMode: joinMode.value });
  name.value = '';
  description.value = '';
}
</script>
