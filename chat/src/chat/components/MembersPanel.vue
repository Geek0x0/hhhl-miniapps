<template>
  <section class="side-panel side-panel--members">
    <header class="side-panel__header">
      <h2>{{ i18n.t('rooms.members') }}</h2>
    </header>
    <ul
      ref="listElement"
      class="side-panel__list side-panel__list--scrollable"
      @scroll.passive="handleScroll"
    >
      <li
        v-for="member in members"
        :key="member.id"
        class="member-row"
      >
        <img
          v-if="member.avatarUrl != null"
          :src="member.avatarUrl"
          alt=""
          class="member-row__avatar"
        >
        <span>{{ member.name ?? member.username }}</span>
        <small>@{{ member.username }}</small>
      </li>
      <li
        v-if="loading"
        class="side-panel__loading"
      >
        {{ i18n.t('common.loading') }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { i18n } from '@/i18n';
import type { UserSummary } from '@/shared/types';

const props = defineProps<{
  members: UserSummary[];
  loading: boolean;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  loadMore: [];
}>();

const listElement = ref<globalThis.HTMLElement | null>(null);

function handleScroll(): void {
  const element = listElement.value;
  if (element == null || props.loading || !props.hasMore) {
    return;
  }

  if (element.scrollHeight - element.scrollTop - element.clientHeight <= 64) {
    emit('loadMore');
  }
}
</script>
