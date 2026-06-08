<template>
  <section class="side-panel side-panel--blocks">
    <header class="side-panel__header">
      <h2>{{ i18n.t('chat.blockManagement') }}</h2>
      <small>{{ members.length }}</small>
    </header>
    <p
      v-if="loading && members.length === 0"
      class="app-copy"
    >
      {{ i18n.t('chat.loadingMutedUsers') }}
    </p>
    <p
      v-else-if="members.length === 0"
      class="app-copy"
    >
      {{ i18n.t('chat.noBlockedUsers') }}
    </p>
    <ul
      v-else
      class="side-panel__list side-panel__list--scrollable"
    >
      <li
        v-for="member in members"
        :key="member.id"
        class="member-row"
      >
        <img
          v-if="displayAvatarUrl(member) != null"
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
          <small v-if="member.username !== member.id">@{{ member.username }}</small>
        </span>
      </li>
    </ul>
    <p
      v-if="loading && members.length > 0"
      class="side-panel__loading"
    >
      {{ i18n.t('chat.loadingMutedUsers') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';
import { avatarDisplayUrl, avatarFallbackUrl, useAvatarFallback } from '@/shared/avatarUrl';
import type { UserSummary } from '@/shared/types';

defineProps<{
  members: UserSummary[];
  loading: boolean;
}>();

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
