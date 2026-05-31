<template>
  <section class="side-panel side-panel--members">
    <header class="side-panel__header">
      <h2>{{ i18n.t('rooms.members') }}</h2>
    </header>
    <input
      v-model="query"
      class="room-direct-join__input"
      type="search"
      :aria-label="i18n.t('rooms.searchMembers')"
      :placeholder="i18n.t('rooms.searchMembers')"
    >
    <ul
      ref="listElement"
      class="side-panel__list side-panel__list--scrollable"
      @scroll.passive="handleScroll"
    >
      <li
        v-for="member in filteredMembers"
        :key="member.id"
        class="member-row"
      >
        <img
          v-if="displayAvatarUrl(member) != null && !avatarFailedIds.has(member.id)"
          :src="displayAvatarUrl(member) ?? ''"
          referrerpolicy="no-referrer"
          alt=""
          class="member-row__avatar"
          @error="handleAvatarError($event, member)"
        >
        <span
          v-else
          class="member-row__avatar member-row__avatar--fallback"
          aria-hidden="true"
        >
          {{ memberInitial(member) }}
        </span>
        <span class="member-row__main">
          <strong>{{ member.name ?? member.username }}</strong>
          <small>@{{ member.username }}</small>
        </span>
        <button
          class="favorite-toggle"
          :class="{ 'favorite-toggle--active': favoriteUserIds.includes(member.id) }"
          type="button"
          :aria-label="i18n.t('chat.toggleFavorite', { name: member.name ?? member.username })"
          :aria-pressed="favoriteUserIds.includes(member.id)"
          @click="$emit('toggleFavorite', member.id)"
        >
          <Heart :size="16" />
        </button>
      </li>
      <li
        v-if="filteredMembers.length === 0 && !loading && !hasMore"
        class="side-panel__loading"
      >
        {{ i18n.t('rooms.noMembersFound') }}
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
import { computed, reactive, ref, watch } from 'vue';
import { Heart } from '@lucide/vue';
import { i18n } from '@/i18n';
import { avatarDisplayUrl, avatarFallbackUrl } from '@/shared/avatarUrl';
import type { UserSummary } from '@/shared/types';

const props = defineProps<{
  members: UserSummary[];
  favoriteUserIds: string[];
  loading: boolean;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  loadMore: [];
  toggleFavorite: [userId: string];
}>();

const listElement = ref<globalThis.HTMLElement | null>(null);
const query = ref('');
const avatarFailedIds = reactive(new Set<string>());
let lastAutoLoadKey: string | null = null;

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, ' ');
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, '');
}

function memberSearchValues(member: UserSummary): string[] {
  const name = member.name ?? '';
  const username = member.username;

  return [
    name,
    username,
    `@${username}`,
    member.id,
    `${name} ${username}`,
    `${name} @${username}`,
  ];
}

function displayAvatarUrl(member: UserSummary): string | null {
  return avatarDisplayUrl(member.avatarUrl, member.avatarFallbackUrl);
}

function fallbackAvatarUrl(member: UserSummary): string | null {
  return avatarFallbackUrl(member.avatarUrl, member.avatarFallbackUrl);
}

function handleAvatarError(event: globalThis.Event, member: UserSummary): void {
  const element = event.currentTarget;
  if (!(element instanceof globalThis.HTMLImageElement)) {
    avatarFailedIds.add(member.id);
    return;
  }

  // If the image has a referrerpolicy but no crossorigin, try adding crossorigin first
  if (!element.hasAttribute('crossorigin') && element.getAttribute('referrerpolicy') === 'no-referrer') {
    element.setAttribute('crossorigin', 'anonymous');
    element.removeAttribute('referrerpolicy');
    const currentSrc = element.currentSrc || element.src;
    element.src = currentSrc;
    return;
  }

  // Try fallback URL
  const fallback = fallbackAvatarUrl(member);
  if (fallback != null) {
    const current = element.currentSrc || element.src;
    if (current !== fallback) {
      element.src = fallback;
      return;
    }
  }

  // All attempts failed, show the initial letter fallback
  avatarFailedIds.add(member.id);
}

function memberInitial(member: UserSummary): string {
  return (member.name ?? member.username).trim().slice(0, 1).toUpperCase() || '?';
}

const filteredMembers = computed(() => {
  const normalizedQuery = normalizeSearchText(query.value);
  if (normalizedQuery === '') {
    return props.members;
  }

  const compactQuery = compactSearchText(query.value);

  return props.members.filter((member) => memberSearchValues(member)
    .some((value) => {
      const normalizedValue = normalizeSearchText(value);
      return normalizedValue.includes(normalizedQuery)
        || (compactQuery !== '' && compactSearchText(value).includes(compactQuery));
    }));
});

watch([() => query.value, () => props.members.length, () => props.loading, () => props.hasMore], () => {
  const normalizedQuery = normalizeSearchText(query.value);
  if (normalizedQuery === '' || props.loading || !props.hasMore) {
    return;
  }

  const autoLoadKey = `${normalizedQuery}:${props.members.length}`;
  if (lastAutoLoadKey === autoLoadKey) {
    return;
  }

  lastAutoLoadKey = autoLoadKey;
  emit('loadMore');
});

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
