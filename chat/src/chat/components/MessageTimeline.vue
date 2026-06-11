<template>
  <section
    ref="timelineElement"
    class="message-timeline"
    aria-live="polite"
    @scroll.passive="handleScroll"
  >
    <p
      v-if="loadingOlder"
      class="message-timeline__loading message-timeline__loading--readable ui-skeleton"
      aria-live="polite"
    >
      <span>{{ i18n.t('common.loading') }}</span>
    </p>
    <p
      v-else-if="loading && visibleEntries.length === 0"
      class="message-timeline__loading message-timeline__loading--readable ui-skeleton"
      aria-live="polite"
    >
      <span>{{ i18n.t('chat.loading') }}</span>
    </p>
    <div
      v-else-if="visibleEntries.length === 0"
      class="message-timeline__empty ui-empty-state"
    >
      <strong>{{ i18n.t('chat.empty') }}</strong>
    </div>
    <MessageBubble
      v-for="entry in visibleEntries"
      :key="entry.kind === 'pending' ? entry.localId : entry.message.id"
      :entry="entry"
      :current-user-id="currentUserId"
      :favorite-user-ids="favoriteUserIds"
      :muted-user-ids="mutedUserIds"
      :mention-members="mentionMembers"
      @reply="$emit('reply', $event)"
      @quote="$emit('quote', $event)"
      @react="(messageId, reaction) => $emit('react', messageId, reaction)"
      @delete="$emit('delete', $event)"
      @retry="$emit('retry', $event)"
      @remove="$emit('remove', $event)"
      @toggle-favorite="$emit('toggleFavorite', $event)"
      @mute-user="$emit('muteUser', $event)"
      @mention-user="$emit('mentionUser', $event)"
    />
    <button
      v-if="newMessageCount > 0"
      class="message-timeline__new-messages"
      type="button"
      @click="scrollToBottomAndDismiss"
    >
      {{ i18n.t('chat.newMessages', { count: newMessageCount }) }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { i18n } from '@/i18n';
import type { ChatMessage, UserSummary } from '@/shared/types';
import { isMessageFromMutedUser } from '../messageFilters';
import type { TimelineEntry } from '../timelineMerge';
import MessageBubble from './MessageBubble.vue';

const props = defineProps<{
  entries: TimelineEntry[];
  loading?: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  currentUserId: string | null;
  favoriteUserIds: string[];
  mutedUserIds: string[];
  mentionMembers: UserSummary[];
}>();

const emit = defineEmits<{
  loadOlder: [];
  reply: [message: ChatMessage];
  quote: [message: ChatMessage];
  react: [messageId: string, reaction: string];
  delete: [messageId: string];
  retry: [localId: string];
  remove: [localId: string];
  toggleFavorite: [userId: string];
  muteUser: [userId: string];
  mentionUser: [username: string];
}>();

const timelineElement = ref<globalThis.HTMLElement | null>(null);
const newMessageCount = ref(0);
let loadingFromScroll = false;
let previousLastKey: string | null = null;
const OLDER_LOAD_THRESHOLD_PX = 160;

type ScrollAnchor = {
  messageId: string | null;
  top: number;
  scrollHeight: number;
  scrollTop: number;
};

let scrollAnchor: ScrollAnchor | null = null;

const visibleEntries = computed(() => props.entries.filter((entry) => (
  !isMessageFromMutedUser(entry.message, props.mutedUserIds, props.currentUserId)
)));

function entryKey(entry: TimelineEntry): string {
  return entry.kind === 'pending' ? entry.localId : entry.message.id;
}

function scrollToBottom(): void {
  const element = timelineElement.value;
  if (element != null) {
    element.scrollTop = element.scrollHeight;
  }
}

function scrollToBottomAndDismiss(): void {
  scrollToBottom();
  newMessageCount.value = 0;
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function scrollToMessage(messageId: string): boolean {
  const element = timelineElement.value;
  const target = element?.querySelector(`[data-message-id="${globalThis.CSS.escape(messageId)}"]`);
  if (!(target instanceof globalThis.HTMLElement)) {
    return false;
  }

  target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  target.classList.add('message-bubble--focused');
  globalThis.setTimeout(() => {
    target.classList.remove('message-bubble--focused');
  }, 1400);
  return true;
}

function isNearBottom(element: globalThis.HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 96;
}

function messageElements(element: globalThis.HTMLElement): globalThis.HTMLElement[] {
  return Array.from(element.querySelectorAll<globalThis.HTMLElement>('[data-message-id]'));
}

function messageElementById(element: globalThis.HTMLElement, messageId: string): globalThis.HTMLElement | null {
  return messageElements(element).find((messageElement) => messageElement.dataset.messageId === messageId) ?? null;
}

function relativeTop(container: globalThis.HTMLElement, target: globalThis.HTMLElement): number {
  return target.getBoundingClientRect().top - container.getBoundingClientRect().top;
}

function captureScrollAnchor(element: globalThis.HTMLElement): ScrollAnchor {
  const containerRect = element.getBoundingClientRect();
  const anchorElement = messageElements(element).find((messageElement) => {
    const rect = messageElement.getBoundingClientRect();
    return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
  });

  return {
    messageId: anchorElement?.dataset.messageId ?? null,
    top: anchorElement == null ? 0 : relativeTop(element, anchorElement),
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  };
}

function restoreScrollAnchor(): void {
  const element = timelineElement.value;
  const anchor = scrollAnchor;
  scrollAnchor = null;

  if (element == null || anchor == null) {
    loadingFromScroll = false;
    return;
  }

  // Synchronously restore scroll position immediately after DOM update
  // to minimize visual jump. The nextTick in the watcher already waited for the DOM.
  const anchorElement = anchor.messageId == null ? null : messageElementById(element, anchor.messageId);

  if (anchorElement != null) {
    element.scrollTop = anchor.scrollTop + relativeTop(element, anchorElement) - anchor.top;
  } else {
    element.scrollTop = anchor.scrollTop + Math.max(0, element.scrollHeight - anchor.scrollHeight);
  }

  loadingFromScroll = false;
}

function handleScroll(): void {
  const element = timelineElement.value;
  if (element == null) {
    return;
  }

  // Dismiss new messages indicator when scrolled to bottom
  if (isNearBottom(element)) {
    newMessageCount.value = 0;
  }

  if (props.loadingOlder || loadingFromScroll || !props.hasMoreOlder || props.entries.length === 0) {
    return;
  }

  if (element.scrollTop <= OLDER_LOAD_THRESHOLD_PX) {
    loadingFromScroll = true;
    scrollAnchor = captureScrollAnchor(element);
    emit('loadOlder');
  }
}

watch(() => props.loadingOlder, async (loading, wasLoading) => {
  if (!loading && wasLoading && loadingFromScroll) {
    await nextTick();
    restoreScrollAnchor();
  }
});

watch(() => visibleEntries.value.map(entryKey).join('|'), async () => {
  const element = timelineElement.value;
  const nextLastKey = visibleEntries.value.at(-1) == null ? null : entryKey(visibleEntries.value.at(-1) as TimelineEntry);
  const nextKeys = visibleEntries.value.map(entryKey);
  const previousLastIndex = previousLastKey == null ? -1 : nextKeys.indexOf(previousLastKey);
  const appendedCount = previousLastKey == null || nextLastKey === previousLastKey
    ? 0
    : previousLastIndex >= 0
      ? Math.max(0, nextKeys.length - previousLastIndex - 1)
      : 1;
  const shouldStickToBottom = previousLastKey == null || (nextLastKey !== previousLastKey && element != null && isNearBottom(element));
  const hasNewEntry = previousLastKey != null && nextLastKey !== previousLastKey;
  previousLastKey = nextLastKey;

  if (!loadingFromScroll && shouldStickToBottom) {
    newMessageCount.value = 0;
    await nextTick();
    scrollToBottom();
  } else if (hasNewEntry && element != null && !isNearBottom(element)) {
    newMessageCount.value += Math.max(1, appendedCount);
  }
});

onMounted(async () => {
  previousLastKey = visibleEntries.value.at(-1) == null ? null : entryKey(visibleEntries.value.at(-1) as TimelineEntry);
  await nextTick();
  scrollToBottom();
});

defineExpose({ scrollToMessage });
</script>
