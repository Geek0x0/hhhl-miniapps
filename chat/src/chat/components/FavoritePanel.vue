<template>
  <section class="side-panel side-panel--favorites">
    <header class="side-panel__header">
      <h2>{{ i18n.t('chat.favorites') }}</h2>
      <small>{{ favoriteMembers.length }}</small>
    </header>
    <p
      v-if="loading && favoriteMembers.length === 0"
      class="app-copy"
    >
      {{ i18n.t('common.loading') }}
    </p>
    <p
      v-else-if="favoriteMembers.length === 0"
      class="app-copy"
    >
      {{ i18n.t('chat.noFavorites') }}
    </p>
    <ul
      v-else
      class="side-panel__list side-panel__list--scrollable"
    >
      <li
        v-for="member in favoriteMembers"
        :key="member.id"
        class="member-row"
      >
        <img
          v-if="member.avatarUrl != null"
          :src="displayAvatarUrl(member) ?? ''"
          referrerpolicy="no-referrer"
          alt=""
          class="member-row__avatar"
          @error="useAvatarFallback($event, fallbackAvatarUrl(member))"
        >
        <span
          v-else
          class="member-row__avatar member-row__avatar--fallback"
          aria-hidden="true"
        >
          {{ initial(member) }}
        </span>
        <span class="member-row__main">
          <strong>{{ member.name ?? member.username }}</strong>
          <small>@{{ member.username }}</small>
        </span>
        <Heart
          class="favorite-marker favorite-marker--inline"
          :size="16"
          aria-hidden="true"
        />
      </li>
    </ul>
    <p
      v-if="loading && favoriteMembers.length > 0"
      class="side-panel__loading"
    >
      {{ i18n.t('common.loading') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Heart } from '@lucide/vue';
import { i18n } from '@/i18n';
import { avatarDisplayUrl, avatarFallbackUrl, useAvatarFallback } from '@/shared/avatarUrl';
import type { UserSummary } from '@/shared/types';

const props = defineProps<{
  members: UserSummary[];
  favoriteUserIds: string[];
  loading: boolean;
}>();

const favoriteMembers = computed(() => props.members.filter((member) => props.favoriteUserIds.includes(member.id)));

function displayAvatarUrl(member: UserSummary): string | null {
  return avatarDisplayUrl(member.avatarUrl, member.avatarFallbackUrl);
}

function fallbackAvatarUrl(member: UserSummary): string | null {
  return avatarFallbackUrl(member.avatarUrl, member.avatarFallbackUrl);
}

function initial(member: UserSummary): string {
  return (member.name ?? member.username).trim().slice(0, 1).toUpperCase() || '?';
}
</script>
