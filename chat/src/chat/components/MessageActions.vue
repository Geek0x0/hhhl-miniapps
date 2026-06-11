<template>
  <div
    ref="actionsEl"
    class="message-actions message-actions--inline"
  >
    <button
      class="chat-icon-button message-actions__button--frameless"
      type="button"
      :aria-label="i18n.t('chat.replyingTo', { name: message.user?.name ?? message.user?.username ?? message.id })"
      @click="$emit('reply', message)"
    >
      <Reply :size="16" />
    </button>
    <button
      class="chat-icon-button message-actions__button--frameless"
      type="button"
      :aria-label="i18n.t('chat.quote')"
      @click="$emit('quote', message)"
    >
      <Quote :size="16" />
    </button>
    <button
      ref="reactionButtonEl"
      class="chat-icon-button message-actions__button--frameless"
      type="button"
      :aria-label="i18n.t('chat.reactions')"
      aria-haspopup="dialog"
      :aria-expanded="showPicker ? 'true' : 'false'"
      @click.stop="togglePicker"
    >
      <SmilePlus :size="16" />
    </button>
    <button
      v-if="canDelete"
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('chat.deleteMessage')"
      @click="confirmDelete"
    >
      <Trash2 :size="16" />
    </button>
  </div>
  <Teleport to="body">
    <div
      v-if="showPicker"
      ref="pickerEl"
      class="reaction-picker-popover"
      role="dialog"
      :aria-label="i18n.t('chat.reactions')"
      :style="pickerStyle"
      @click.stop
    >
      <ReactionPicker @select="handleReaction" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { Quote, Reply, SmilePlus, Trash2 } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';
import ReactionPicker from './ReactionPicker.vue';

const props = defineProps<{
  message: ChatMessage;
  canDelete: boolean;
}>();

const emit = defineEmits<{
  reply: [message: ChatMessage];
  quote: [message: ChatMessage];
  react: [messageId: string, reaction: string];
  delete: [messageId: string];
}>();

const showPicker = ref(false);
const actionsEl = ref<globalThis.HTMLElement | null>(null);
const reactionButtonEl = ref<globalThis.HTMLElement | null>(null);
const pickerEl = ref<globalThis.HTMLElement | null>(null);
const pickerStyle = ref<Record<string, string>>({ left: '8px', top: '8px' });
const PICKER_WIDTH_PX = 304;
const PICKER_HEIGHT_PX = 48;
const PICKER_MARGIN_PX = 8;

function updatePickerPosition(): void {
  const button = reactionButtonEl.value;
  if (button == null) {
    return;
  }

  const rect = button.getBoundingClientRect();
  const viewportWidth = globalThis.innerWidth || globalThis.document.documentElement.clientWidth || PICKER_WIDTH_PX + PICKER_MARGIN_PX * 2;
  const viewportHeight = globalThis.innerHeight || globalThis.document.documentElement.clientHeight || 640;
  const width = Math.min(PICKER_WIDTH_PX, Math.max(240, viewportWidth - PICKER_MARGIN_PX * 2));
  const maxLeft = Math.max(PICKER_MARGIN_PX, viewportWidth - width - PICKER_MARGIN_PX);
  const left = Math.min(Math.max(PICKER_MARGIN_PX, rect.right - width), maxLeft);
  const topBelow = rect.bottom + PICKER_MARGIN_PX;
  const topAbove = rect.top - PICKER_HEIGHT_PX - PICKER_MARGIN_PX;
  const top = topBelow + PICKER_HEIGHT_PX + PICKER_MARGIN_PX > viewportHeight && topAbove >= PICKER_MARGIN_PX
    ? topAbove
    : topBelow;

  pickerStyle.value = {
    left: `${left}px`,
    top: `${Math.max(PICKER_MARGIN_PX, top)}px`,
    width: `${width}px`,
  };
}

async function togglePicker(): Promise<void> {
  showPicker.value = !showPicker.value;
  if (showPicker.value) {
    await nextTick();
    updatePickerPosition();
  }
}

function handleReaction(reaction: string): void {
  emit('react', props.message.id, reaction);
  showPicker.value = false;
}

function confirmDelete(): void {
  if (globalThis.confirm(i18n.t('chat.confirmDeleteMessage'))) {
    emit('delete', props.message.id);
  }
}

function handleClickOutside(event: globalThis.MouseEvent): void {
  const target = event.target as globalThis.Node;
  if (
    showPicker.value
    && actionsEl.value != null
    && !actionsEl.value.contains(target)
    && !pickerEl.value?.contains(target)
  ) {
    showPicker.value = false;
  }
}

function handleKeydown(event: globalThis.KeyboardEvent): void {
  if (showPicker.value && event.key === 'Escape') {
    showPicker.value = false;
  }
}

function handleViewportChange(): void {
  if (showPicker.value) {
    updatePickerPosition();
  }
}

onMounted(() => {
  globalThis.document.addEventListener('click', handleClickOutside);
  globalThis.document.addEventListener('keydown', handleKeydown);
  globalThis.addEventListener('resize', handleViewportChange);
  globalThis.addEventListener('scroll', handleViewportChange, true);
});

onBeforeUnmount(() => {
  globalThis.document.removeEventListener('click', handleClickOutside);
  globalThis.document.removeEventListener('keydown', handleKeydown);
  globalThis.removeEventListener('resize', handleViewportChange);
  globalThis.removeEventListener('scroll', handleViewportChange, true);
});
</script>
