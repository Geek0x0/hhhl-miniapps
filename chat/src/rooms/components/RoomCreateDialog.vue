<template>
  <form
    class="room-panel"
    @submit.prevent="submit"
  >
    <h2>{{ i18n.t('rooms.create') }}</h2>
    <input
      v-model="name"
      class="room-direct-join__input"
      :aria-label="i18n.t('rooms.name')"
      :placeholder="i18n.t('rooms.create')"
    >
    <textarea
      v-model="description"
      class="message-composer__input"
      :aria-label="i18n.t('rooms.description')"
      :placeholder="i18n.t('rooms.description')"
    />
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
    <button
      class="app-button"
      type="submit"
      :disabled="name.trim() === ''"
    >
      {{ i18n.t('rooms.create') }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { i18n } from '@/i18n';
import type { RoomCreateParams } from '../roomApi';

const emit = defineEmits<{
  create: [params: RoomCreateParams];
}>();

const name = ref('');
const description = ref('');
const joinMode = ref('public');

function submit(): void {
  if (name.value.trim() === '') {
    return;
  }

  emit('create', { name: name.value.trim(), description: description.value.trim(), joinMode: joinMode.value });
  name.value = '';
  description.value = '';
}
</script>
