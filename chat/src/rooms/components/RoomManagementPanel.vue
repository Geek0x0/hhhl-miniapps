<template>
  <section class="side-panel">
    <h2>{{ i18n.t('common.settings') }}</h2>
    <form
      class="side-panel__form"
      @submit.prevent="$emit('update', { name: name.trim(), description: description.trim() })"
    >
      <input
        v-model="name"
        class="room-direct-join__input"
        :placeholder="roomId"
      >
      <textarea
        v-model="description"
        class="message-composer__input"
        placeholder="description"
      />
      <button
        class="app-button"
        type="submit"
      >
        {{ i18n.t('common.save') }}
      </button>
    </form>
    <div class="app-actions">
      <button
        class="app-button app-button-secondary"
        type="button"
        @click="$emit('mute')"
      >
        {{ i18n.t('rooms.mute') }}
      </button>
      <button
        class="app-button app-button-secondary"
        type="button"
        @click="$emit('leave')"
      >
        {{ i18n.t('rooms.leave') }}
      </button>
      <button
        class="app-button app-button-secondary"
        type="button"
        @click="$emit('delete')"
      >
        {{ i18n.t('common.delete') }}
      </button>
      <button
        class="app-button"
        type="button"
        @click="$emit('invite')"
      >
        {{ i18n.t('rooms.invitations') }}
      </button>
    </div>
    <p
      v-if="error != null"
      class="chat-error"
    >
      {{ error }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { i18n } from '@/i18n';
import type { RoomUpdateParams } from '../roomApi';

const props = defineProps<{
  roomId: string;
  error: string | null;
}>();

defineEmits<{
  update: [params: RoomUpdateParams];
  mute: [];
  leave: [];
  delete: [];
  invite: [];
}>();

const name = ref(props.roomId);
const description = ref('');
</script>
