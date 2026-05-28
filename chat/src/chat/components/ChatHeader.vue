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
    <div class="chat-header__actions">
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.search')"
        @click="$emit('search')"
      >
        <Search :size="18" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('rooms.members')"
        @click="$emit('members')"
      >
        <Users :size="18" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.settings')"
        @click="$emit('settings')"
      >
        <Settings :size="18" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('rooms.manage')"
        @click="$emit('manage')"
      >
        <SlidersHorizontal :size="18" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ArrowLeft, Search, Settings, SlidersHorizontal, Users } from '@lucide/vue';
import { i18n } from '@/i18n';

defineProps<{
  roomId: string;
  title: string;
  degraded?: boolean;
}>();

defineEmits<{
  back: [];
  search: [];
  members: [];
  manage: [];
  settings: [];
}>();
</script>
