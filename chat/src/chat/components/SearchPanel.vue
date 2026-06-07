<template>
  <section class="side-panel">
    <form
      class="side-panel__form search-panel__form"
      @submit.prevent="submitSearch"
    >
      <select
        v-model="selectedUserId"
        class="room-direct-join__input"
        :aria-label="i18n.t('chat.searchMember')"
      >
        <option value="">
          {{ i18n.t('chat.searchAllMembers') }}
        </option>
        <option
          v-for="member in members"
          :key="member.id"
          :value="member.id"
        >
          {{ memberLabel(member) }}
        </option>
      </select>
      <input
        v-model="query"
        class="room-direct-join__input"
        :aria-label="i18n.t('chat.searchPlaceholder')"
        :placeholder="i18n.t('chat.searchPlaceholder')"
      >
      <button
        class="app-button"
        type="submit"
        :disabled="!canSearch || loading"
      >
        {{ i18n.t('common.search') }}
      </button>
    </form>
    <p
      v-if="error != null"
      class="chat-error"
    >
      {{ error }}
    </p>
    <p
      v-if="!loading && error == null && results.length === 0 && canSearch"
      class="app-copy"
    >
      {{ i18n.t('chat.searchEmpty') }}
    </p>
    <ul class="side-panel__list side-panel__list--scrollable search-results">
      <li
        v-for="message in results"
        :key="message.id"
        class="search-result-row search-result-row--clickable"
        role="button"
        tabindex="0"
        @click="$emit('select', message.id)"
        @keydown.enter="$emit('select', message.id)"
        @keydown.space.prevent="$emit('select', message.id)"
      >
        <span
          class="search-result-row__avatar"
          aria-hidden="true"
        >
          {{ senderInitial(message) }}
        </span>
        <span class="search-result-row__main">
          <span class="search-result-row__meta">
            <strong>{{ senderName(message) }}</strong>
            <small>{{ formattedTime(message) }}</small>
          </span>
          <span class="search-result-row__text">
            <template
              v-for="(part, index) in highlightedParts(message)"
              :key="`${message.id}-${index}-${part.text}`"
            >
              <mark v-if="part.match">{{ part.text }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </span>
        </span>
      </li>
    </ul>
    <button
      v-if="canLoadMore"
      class="app-button app-button-secondary"
      type="button"
      :disabled="loading"
      @click="$emit('loadMore')"
    >
      {{ i18n.t('common.loadMore') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { i18n } from '@/i18n';
import { formatMessageTimestamp } from '@/shared/time';
import type { ChatMessage, UserSummary } from '@/shared/types';
import { displayMessageText } from '../messageText';
import { splitSearchHighlight } from '../searchHighlight';

const props = defineProps<{
  query: string | null;
  selectedUserId: string | null;
  members: UserSummary[];
  results: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}>();

const query = ref(props.query ?? '');
const selectedUserId = ref(props.selectedUserId ?? '');
const submittedQuery = computed(() => props.query ?? '');
const submittedUserId = computed(() => props.selectedUserId ?? '');
const canSearch = computed(() => query.value.trim() !== '' || selectedUserId.value !== '');
const canLoadMore = computed(() => props.hasMore && query.value.trim() === submittedQuery.value && selectedUserId.value === submittedUserId.value);
const emit = defineEmits<{
  search: [params: { query: string; userId?: string }];
  loadMore: [];
  select: [messageId: string];
}>();

watch(() => props.query, (next) => {
  query.value = next ?? '';
});

watch(() => props.selectedUserId, (next) => {
  selectedUserId.value = next ?? '';
});

function submitSearch(): void {
  const userId = selectedUserId.value.trim();
  emit('search', {
    query: query.value,
    ...(userId === '' ? {} : { userId }),
  });
}

function memberLabel(member: UserSummary): string {
  const name = member.name ?? member.username;
  return name === member.username ? `@${member.username}` : `${name} @${member.username}`;
}

function senderName(message: ChatMessage): string {
  return message.user?.name ?? message.user?.username ?? message.user?.id ?? 'Unknown';
}

function senderInitial(message: ChatMessage): string {
  return senderName(message).trim().slice(0, 1).toUpperCase() || '?';
}

function formattedTime(message: ChatMessage): string {
  return formatMessageTimestamp(message.createdAt);
}

function previewText(message: ChatMessage): string {
  return displayMessageText(message.text ?? message.file?.name ?? message.id);
}

function highlightedParts(message: ChatMessage) {
  return splitSearchHighlight(previewText(message), submittedQuery.value);
}
</script>
