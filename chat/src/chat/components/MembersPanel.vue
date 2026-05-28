<template>
  <section class="side-panel">
    <header class="side-panel__header">
      <h2>{{ i18n.t('rooms.members') }}</h2>
      <button
        class="app-button app-button-secondary"
        type="button"
        @click="$emit('loadMore')"
      >
        {{ i18n.t('common.loading') }}
      </button>
    </header>
    <ul class="side-panel__list">
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
    </ul>
  </section>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';
import type { UserSummary } from '@/shared/types';

defineProps<{
  members: UserSummary[];
}>();

defineEmits<{
  loadMore: [];
}>();
</script>
