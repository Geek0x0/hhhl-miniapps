<template>
  <article
    class="message-bubble"
    :class="{
      'message-bubble--own': isOwnMessage,
      'message-bubble--incoming': !isOwnMessage,
      'message-bubble--pending': entry.kind === 'pending',
    }"
  >
    <img
      v-if="avatarUrl != null"
      class="message-bubble__avatar"
      :src="avatarUrl"
      alt=""
    >
    <div
      v-else
      class="message-bubble__avatar message-bubble__avatar--fallback"
      aria-hidden="true"
    >
      {{ avatarInitial }}
    </div>
    <div class="message-bubble__body">
      <div class="message-bubble__meta">
        <strong>{{ senderName }}</strong>
        <small>{{ formattedTime }}</small>
      </div>
      <div
        v-if="reference != null"
        class="message-reference"
      >
        <strong>{{ reference.label }}</strong>
        <span>{{ reference.preview }}</span>
      </div>
      <p
        v-if="entry.message.text != null"
        class="message-bubble__text"
      >
        {{ entry.message.text }}
      </p>
      <a
        v-if="fileUrl != null && isImageFile"
        class="message-bubble__image-link"
        :href="fileUrl"
        target="_blank"
        rel="noreferrer"
      >
        <img
          class="message-bubble__image"
          :src="imageSrc"
          :alt="entry.message.file?.name ?? ''"
        >
      </a>
      <a
        v-else-if="entry.message.file != null && fileUrl != null"
        class="message-file-link"
        :href="fileUrl"
        target="_blank"
        rel="noreferrer"
      >
        {{ entry.message.file.name }}
      </a>
      <p
        v-else-if="entry.message.text == null && entry.message.file != null"
        class="message-bubble__text"
      >
        {{ entry.message.file.name }}
      </p>
      <small v-if="entry.kind === 'pending'">
        {{ entry.status === 'failed' ? i18n.t('chat.failed') : i18n.t('chat.pending') }}
      </small>
    </div>
    <MessageActions
      v-if="entry.kind === 'server'"
      :message="entry.message"
      :can-delete="isOwnMessage"
      @reply="$emit('reply', $event)"
      @quote="$emit('quote', $event)"
      @react="(messageId, reaction) => $emit('react', messageId, reaction)"
      @delete="$emit('delete', $event)"
    />
    <div
      v-else-if="entry.status === 'failed'"
      class="message-actions"
    >
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.retry')"
        @click="$emit('retry', entry.localId)"
      >
        <RefreshCw :size="16" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.clear')"
        @click="$emit('remove', entry.localId)"
      >
        <X :size="16" />
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RefreshCw, X } from '@lucide/vue';
import { i18n } from '@/i18n';
import type { ChatMessage } from '@/shared/types';
import type { TimelineEntry } from '../timelineMerge';
import MessageActions from './MessageActions.vue';

const props = defineProps<{
  entry: TimelineEntry;
  currentUserId: string | null;
}>();

defineEmits<{
  reply: [message: ChatMessage];
  quote: [message: ChatMessage];
  react: [messageId: string, reaction: string];
  delete: [messageId: string];
  retry: [localId: string];
  remove: [localId: string];
}>();

const formattedTime = computed(() => new Date(props.entry.message.createdAt).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
}));
const senderName = computed(() => props.entry.message.user?.name ?? props.entry.message.user?.username ?? props.entry.message.user?.id ?? 'Unknown');
const isOwnMessage = computed(() => props.currentUserId != null && props.entry.message.user?.id === props.currentUserId);
const avatarUrl = computed(() => props.entry.message.user?.avatarUrl ?? null);
const avatarInitial = computed(() => senderName.value.trim().slice(0, 1).toUpperCase() || '?');
const fileUrl = computed(() => props.entry.message.file?.url ?? props.entry.message.file?.thumbnailUrl ?? null);
const imageSrc = computed(() => props.entry.message.file?.thumbnailUrl ?? props.entry.message.file?.url ?? '');
const isImageFile = computed(() => {
  const file = props.entry.message.file;
  if (file == null) {
    return false;
  }

  return file.type?.startsWith('image/') === true || /\.(?:apng|avif|bmp|gif|jpe?g|png|webp)$/i.test(file.name);
});
const reference = computed(() => {
  const message = props.entry.message;
  const isReply = message.reply != null || message.replyId != null;
  const target = isReply ? message.reply ?? null : message.quote ?? null;
  const id = target?.id ?? (isReply ? message.replyId : message.quoteId) ?? null;
  if (target == null && id == null) {
    return null;
  }

  const author = target?.user?.name ?? target?.user?.username ?? target?.user?.id ?? null;
  const body = target?.text ?? target?.file?.name ?? id ?? '';
  return {
    label: isReply ? i18n.t('chat.replyingTo', { name: author ?? id ?? '' }) : i18n.t('chat.quote'),
    preview: author == null ? body : `${author}: ${body}`,
  };
});
</script>
