<template>
  <section class="side-panel">
    <form
      class="side-panel__form search-panel__form"
      @submit.prevent="submitSearch"
    >
      <div class="member-picker">
        <button
          class="member-picker__trigger"
          role="combobox"
          type="button"
          :aria-label="i18n.t('chat.searchMember')"
          :aria-expanded="memberPickerOpen"
          aria-haspopup="listbox"
          aria-controls="search-member-options"
          @click="toggleMemberPicker"
        >
          <MemberAvatar
            v-if="selectedMember != null"
            :member="selectedMember"
            :failed-ids="avatarFailedIds"
            @avatar-error="handleAvatarError"
          />
          <span
            v-else
            class="member-picker__avatar member-picker__avatar--fallback"
            aria-hidden="true"
          >
            *
          </span>
          <span class="member-picker__trigger-label">{{ selectedMemberLabel }}</span>
        </button>
        <div
          v-if="memberPickerOpen"
          class="member-picker__popover"
        >
          <input
            v-model="memberQuery"
            class="room-direct-join__input"
            type="search"
            :aria-label="i18n.t('rooms.searchMembers')"
            :placeholder="i18n.t('rooms.searchMembers')"
            @keydown.enter.prevent="selectFirstFilteredMember"
            @keydown.escape.prevent="memberPickerOpen = false"
          >
          <ul
            id="search-member-options"
            class="member-picker__list"
            role="listbox"
          >
            <li
              class="member-picker__option"
              role="option"
              tabindex="0"
              :aria-selected="selectedUserId === ''"
              @click="selectMember(null)"
              @keydown.enter="selectMember(null)"
              @keydown.space.prevent="selectMember(null)"
            >
              <span
                class="member-picker__avatar member-picker__avatar--fallback"
                aria-hidden="true"
              >
                *
              </span>
              <span class="member-picker__option-main">
                <strong>{{ i18n.t('chat.searchAllMembers') }}</strong>
              </span>
            </li>
            <li
              v-for="candidate in filteredMembers"
              :key="candidate.id"
              class="member-picker__option"
              role="option"
              tabindex="0"
              :aria-selected="selectedUserId === candidate.id"
              @click="selectMember(candidate.id)"
              @keydown.enter="selectMember(candidate.id)"
              @keydown.space.prevent="selectMember(candidate.id)"
            >
              <MemberAvatar
                :member="candidate"
                :failed-ids="avatarFailedIds"
                @avatar-error="handleAvatarError"
              />
              <span class="member-picker__option-main">
                <strong>{{ candidate.name ?? candidate.username }}</strong>
                <small>@{{ candidate.username }}</small>
              </span>
            </li>
            <li
              v-if="filteredMembers.length === 0"
              class="member-picker__empty"
            >
              {{ i18n.t('rooms.noMembersFound') }}
            </li>
          </ul>
        </div>
      </div>
      <input
        v-model="query"
        class="room-direct-join__input"
        :aria-label="i18n.t('chat.searchPlaceholder')"
        :placeholder="i18n.t('chat.searchPlaceholder')"
        @focus="memberPickerOpen = false"
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
import { computed, defineComponent, h, reactive, ref, watch, type PropType } from 'vue';
import { i18n } from '@/i18n';
import { avatarDisplayUrl, avatarFallbackUrl } from '@/shared/avatarUrl';
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
const memberQuery = ref('');
const memberPickerOpen = ref(false);
const avatarFailedIds = reactive(new Set<string>());
const submittedQuery = computed(() => props.query ?? '');
const submittedUserId = computed(() => props.selectedUserId ?? '');
const canSearch = computed(() => query.value.trim() !== '' || selectedUserId.value !== '');
const canLoadMore = computed(() => props.hasMore && query.value.trim() === submittedQuery.value && selectedUserId.value === submittedUserId.value);
const selectedMember = computed(() => props.members.find((member) => member.id === selectedUserId.value) ?? null);
const selectedMemberLabel = computed(() => selectedMember.value == null ? i18n.t('chat.searchAllMembers') : memberLabel(selectedMember.value));
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

const filteredMembers = computed(() => {
  const normalizedQuery = normalizeSearchText(memberQuery.value);
  if (normalizedQuery === '') {
    return props.members;
  }

  const compactQuery = compactSearchText(memberQuery.value);

  return props.members.filter((member) => memberSearchValues(member)
    .some((value) => {
      const normalizedValue = normalizeSearchText(value);
      return normalizedValue.includes(normalizedQuery)
        || (compactQuery !== '' && compactSearchText(value).includes(compactQuery));
    }));
});

function toggleMemberPicker(): void {
  memberPickerOpen.value = !memberPickerOpen.value;
  if (memberPickerOpen.value) {
    memberQuery.value = '';
  }
}

function selectMember(userId: string | null): void {
  selectedUserId.value = userId ?? '';
  memberQuery.value = '';
  memberPickerOpen.value = false;
}

function selectFirstFilteredMember(): void {
  const first = filteredMembers.value[0];
  if (first != null) {
    selectMember(first.id);
  }
}

function submitSearch(): void {
  memberPickerOpen.value = false;
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

  element.removeAttribute('crossorigin');
  element.setAttribute('referrerpolicy', 'no-referrer');

  const fallback = fallbackAvatarUrl(member);
  if (fallback != null) {
    const current = element.currentSrc || element.src;
    if (current !== fallback) {
      element.src = fallback;
      return;
    }
  }

  avatarFailedIds.add(member.id);
}

function memberInitial(member: UserSummary): string {
  return (member.name ?? member.username).trim().slice(0, 1).toUpperCase() || '?';
}

const MemberAvatar = defineComponent({
  props: {
    member: {
      type: Object as PropType<UserSummary>,
      required: true,
    },
    failedIds: {
      type: Object as PropType<Set<string>>,
      required: true,
    },
  },
  emits: ['avatarError'],
  setup(avatarProps, { emit: avatarEmit }) {
    return () => {
      const avatarUrl = displayAvatarUrl(avatarProps.member);
      if (avatarUrl != null && !avatarProps.failedIds.has(avatarProps.member.id)) {
        return h('img', {
          src: avatarUrl,
          referrerpolicy: 'no-referrer',
          alt: '',
          class: 'member-picker__avatar',
          onError: (event: globalThis.Event) => avatarEmit('avatarError', event, avatarProps.member),
        });
      }

      return h('span', {
        class: 'member-picker__avatar member-picker__avatar--fallback',
        'aria-hidden': 'true',
      }, memberInitial(avatarProps.member));
    };
  },
});

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
