<template>
  <section
    ref="timelineElement"
    class="message-timeline"
    aria-live="polite"
    @scroll.passive="handleScroll"
  >
    <p
      v-if="loadingOlder"
      class="message-timeline__loading"
    >
      {{ i18n.t('common.loading') }}
    </p>
    <p
      v-if="entries.length === 0"
      class="app-copy"
    >
      {{ i18n.t('chat.empty') }}
    </p>
    <MessageBubble
      v-for="entry in entries"
      :key="entry.kind === 'pending' ? entry.localId : entry.message.id"
      :entry="entry"
      :current-user-id="currentUserId"
      :favorite-user-ids="favoriteUserIds"
      :mention-members="mentionMembers"
      @reply="$emit('reply', $event)"
      @quote="$emit('quote', $event)"
      @react="(messageId, reaction) => $emit('react', messageId, reaction)"
      @delete="$emit('delete', $event)"
      @retry="$emit('retry', $event)"
      @remove="$emit('remove', $event)"
      @toggle-favorite="$emit('toggleFavorite', $event)"
      @mention-user="$emit('mentionUser', $event)"
    />
    <button
      v-if="hasNewMessages"
      class="message-timeline__new-messages"
      type="button"
      @click="scrollToBottomAndDismiss"
    >
      {{ i18n.t('chat.newMessages') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { i18n } from '@/i18n';
import type { ChatMessage, UserSummary } from '@/shared/types';
import type { TimelineEntry } from '../timelineMerge';
import MessageBubble from './MessageBubble.vue';

const props = defineProps<{
  entries: TimelineEntry[];
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  currentUserId: string | null;
  favoriteUserIds: string[];
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
  mentionUser: [username: string];
}>();

const timelineElement = ref<globalThis.HTMLElement | null>(null);
const hasNewMessages = ref(false);
let previousScrollHeight = 0;
let previousScrollTop = 0;
let loadingFromScroll = false;
let previousLastKey: string | null = null;
const OLDER_LOAD_THRESHOLD_PX = 160;

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
  hasNewMessages.value = false;
}

function scrollToMessage(messageId: string): boolean {
  const element = timelineElement.value;
  const target = element?.querySelector(`[data-message-id="${globalThis.CSS.escape(messageId)}"]`);
  if (!(target instanceof globalThis.HTMLElement)) {
    return false;
  }

  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('message-bubble--focused');
  globalThis.setTimeout(() => {
    target.classList.remove('message-bubble--focused');
  }, 1400);
  return true;
}

function isNearBottom(element: globalThis.HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 96;
}

async function handleScroll(): Promise<void> {
  const element = timelineElement.value;
  if (element == null) {
    return;
  }

  // Dismiss new messages indicator when scrolled to bottom
  if (isNearBottom(element)) {
    hasNewMessages.value = false;
  }

  if (props.loadingOlder || loadingFromScroll || !props.hasMoreOlder || props.entries.length === 0) {
    return;
  }

  if (element.scrollTop <= OLDER_LOAD_THRESHOLD_PX) {
    loadingFromScroll = true;
    previousScrollHeight = element.scrollHeight;
    previousScrollTop = element.scrollTop;
    emit('loadOlder');
    await nextTick();
    if (!props.loadingOlder) {
      loadingFromScroll = false;
    }
  }
}

watch(() => props.loadingOlder, async (loading, wasLoading) => {
  if (!loading && wasLoading && loadingFromScroll) {
    await nextTick();
    const element = timelineElement.value;
    if (element != null) {
      globalThis.requestAnimationFrame(() => {
        element.scrollTop = previousScrollTop + Math.max(0, element.scrollHeight - previousScrollHeight);
      });
    }
    loadingFromScroll = false;
  }
});

watch(() => props.entries.map(entryKey).join('|'), async () => {
  const element = timelineElement.value;
  const nextLastKey = props.entries.at(-1) == null ? null : entryKey(props.entries.at(-1) as TimelineEntry);
  const shouldStickToBottom = previousLastKey == null || (nextLastKey !== previousLastKey && element != null && isNearBottom(element));
  const hasNewEntry = previousLastKey != null && nextLastKey !== previousLastKey;
  previousLastKey = nextLastKey;

  if (!loadingFromScroll && shouldStickToBottom) {
    await nextTick();
    scrollToBottom();
  } else if (hasNewEntry && element != null && !isNearBottom(element)) {
    hasNewMessages.value = true;
  }
});

onMounted(async () => {
  previousLastKey = props.entries.at(-1) == null ? null : entryKey(props.entries.at(-1) as TimelineEntry);
  await nextTick();
  scrollToBottom();
});

defineExpose({ scrollToMessage });
</script>
