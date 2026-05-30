<template>
  <article
    class="message-bubble"
    :data-message-id="entry.message.id"
    :class="{
      'message-bubble--own': isOwnMessage,
      'message-bubble--incoming': !isOwnMessage,
      'message-bubble--pending': entry.kind === 'pending',
    }"
  >
    <img
      v-if="avatarUrl != null"
      class="message-bubble__avatar"
      :class="{ 'message-bubble__avatar--clickable': !isOwnMessage }"
      :src="avatarUrl"
      referrerpolicy="no-referrer"
      alt=""
      :role="!isOwnMessage ? 'button' : undefined"
      :tabindex="!isOwnMessage ? 0 : undefined"
      @click="handleAvatarClick"
      @pointerdown="handleAvatarPointerDown"
      @pointerup="handleAvatarPointerUp"
      @pointerleave="handleAvatarPointerUp"
      @keydown.enter="handleAvatarClick"
      @keydown.space.prevent="handleAvatarClick"
      @error="useAvatarFallback($event, avatarFallbackUrl)"
    >
    <div
      v-else
      class="message-bubble__avatar message-bubble__avatar--fallback"
      :class="{ 'message-bubble__avatar--clickable': !isOwnMessage }"
      :aria-hidden="isOwnMessage ? 'true' : undefined"
      :role="!isOwnMessage ? 'button' : undefined"
      :tabindex="!isOwnMessage ? 0 : undefined"
      @click="handleAvatarClick"
      @pointerdown="handleAvatarPointerDown"
      @pointerup="handleAvatarPointerUp"
      @pointerleave="handleAvatarPointerUp"
      @keydown.enter="handleAvatarClick"
      @keydown.space.prevent="handleAvatarClick"
    >
      {{ avatarInitial }}
    </div>
    <div class="message-bubble__body">
      <div class="message-bubble__meta">
        <strong>
          {{ senderName }}
          <Heart
            v-if="isFavoriteSender"
            class="favorite-marker"
            :size="13"
            aria-hidden="true"
          />
        </strong>
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
        <template
          v-for="(part, index) in textParts"
          :key="`${part.kind}-${index}-${part.text}`"
        >
          <span v-if="part.kind === 'text'">{{ part.text }}</span>
          <span
            v-else
            class="message-mention"
          >
            <img
              v-if="part.user.avatarUrl != null"
              class="message-mention__avatar"
              :src="displayAvatarUrl(part.user) ?? ''"
              referrerpolicy="no-referrer"
              alt=""
              @error="useAvatarFallback($event, fallbackAvatarUrl(part.user))"
            >
            <span
              v-else
              class="message-mention__avatar message-mention__avatar--fallback"
              aria-hidden="true"
            >
              <span class="message-mention__initial">{{ mentionInitial(part.user) }}</span>
            </span>
            <span>{{ part.text }}</span>
          </span>
        </template>
      </p>
      <a
        v-if="linkPreview != null"
        class="message-link-preview"
        :href="linkPreview.href"
        target="_blank"
        rel="noreferrer"
      >
        <span class="message-link-preview__host">{{ linkPreview.host }}</span>
        <span class="message-link-preview__path">{{ linkPreview.path }}</span>
      </a>
      <button
        v-if="fileUrl != null && isImageFile"
        class="message-bubble__image-button"
        type="button"
        :aria-label="i18n.t('files.imagePreview')"
        @click="openImagePreview"
      >
        <img
          class="message-bubble__image"
          :src="imageSrc"
          referrerpolicy="no-referrer"
          :alt="imageAlt"
        >
      </button>
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
      <div
        v-if="displayReactions.length > 0"
        class="message-reactions"
        :aria-label="i18n.t('chat.reactions')"
      >
        <span
          v-for="reaction in displayReactions"
          :key="reaction.reaction"
          class="message-reactions__item"
          :class="{ 'message-reactions__item--own': reaction.reacted }"
        >
          <span>{{ reaction.reaction }} {{ reaction.count }}</span>
        </span>
      </div>
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
    <Teleport to="body">
      <div
        v-if="imagePreviewOpen && imageSrc !== ''"
        class="image-lightbox"
        role="dialog"
        aria-modal="true"
        :aria-label="i18n.t('files.imagePreview')"
        @click="closeImagePreview"
      >
        <button
          class="chat-icon-button image-lightbox__close"
          type="button"
          :aria-label="i18n.t('common.close')"
          @click.stop="closeImagePreview"
        >
          <X :size="18" />
        </button>
        <div
          class="image-lightbox__container"
          @click.stop
        >
          <img
            class="image-lightbox__image"
            :src="fileUrl ?? imageSrc"
            referrerpolicy="no-referrer"
            :alt="imageAlt"
          >
        </div>
      </div>
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Heart, RefreshCw, X } from '@lucide/vue';
import { i18n } from '@/i18n';
import { avatarDisplayUrl as resolveAvatarDisplayUrl, avatarFallbackUrl as resolveAvatarFallbackUrl, useAvatarFallback } from '@/shared/avatarUrl';
import type { ChatMessage, UserSummary } from '@/shared/types';
import { parseMentionText } from '../mentions';
import type { TimelineEntry } from '../timelineMerge';
import MessageActions from './MessageActions.vue';

const props = defineProps<{
  entry: TimelineEntry;
  currentUserId: string | null;
  favoriteUserIds: string[];
  mentionMembers: UserSummary[];
}>();

const emit = defineEmits<{
  reply: [message: ChatMessage];
  quote: [message: ChatMessage];
  react: [messageId: string, reaction: string];
  delete: [messageId: string];
  retry: [localId: string];
  remove: [localId: string];
  toggleFavorite: [userId: string];
  mentionUser: [username: string];
}>();

interface LinkPreview {
  href: string;
  host: string;
  path: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/i;
const LONG_PRESS_DURATION_MS = 500;
const imagePreviewOpen = ref(false);
const longPressTimer = ref<ReturnType<typeof globalThis.setTimeout> | null>(null);
const isLongPress = ref(false);

function linkPreviewFromText(text: string | null | undefined): LinkPreview | null {
  const rawMatch = text?.match(URL_PATTERN)?.[0];
  if (rawMatch == null) {
    return null;
  }

  const rawUrl = rawMatch.replace(/[),.;!?]+$/, '');

  try {
    const url = new globalThis.URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    const path = `${url.pathname}${url.search}${url.hash}`;
    return {
      href: url.href,
      host: url.hostname,
      path: path === '/' ? url.href : path,
    };
  } catch {
    return null;
  }
}

function openImagePreview(): void {
  imagePreviewOpen.value = true;
}

function closeImagePreview(): void {
  imagePreviewOpen.value = false;
}

function handleAvatarClick(): void {
  if (isOwnMessage.value || isLongPress.value) {
    isLongPress.value = false;
    return;
  }

  const username = props.entry.message.user?.username;
  if (username == null) {
    return;
  }

  emit('mentionUser', username);
}

function handleAvatarPointerDown(): void {
  if (isOwnMessage.value) {
    return;
  }

  isLongPress.value = false;
  longPressTimer.value = globalThis.setTimeout(() => {
    isLongPress.value = true;
    handleAvatarLongPress();
  }, LONG_PRESS_DURATION_MS);
}

function handleAvatarPointerUp(): void {
  if (longPressTimer.value != null) {
    globalThis.clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

function handleAvatarLongPress(): void {
  const userId = props.entry.message.user?.id;
  if (userId == null) {
    return;
  }

  const name = senderName.value;
  const isFavorite = props.favoriteUserIds.includes(userId);
  const message = isFavorite
    ? i18n.t('chat.confirmRemoveFavorite', { name })
    : i18n.t('chat.confirmAddFavorite', { name });

  if (globalThis.confirm(message)) {
    emit('toggleFavorite', userId);
  }
}

onBeforeUnmount(() => {
  if (longPressTimer.value != null) {
    globalThis.clearTimeout(longPressTimer.value);
  }
});

const formattedTime = computed(() => new Date(props.entry.message.createdAt).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
}));

function displayAvatarUrl(user: UserSummary | null | undefined): string | null {
  return resolveAvatarDisplayUrl(user?.avatarUrl, user?.avatarFallbackUrl);
}

function fallbackAvatarUrl(user: UserSummary | null | undefined): string | null {
  return resolveAvatarFallbackUrl(user?.avatarUrl, user?.avatarFallbackUrl);
}

const senderName = computed(() => props.entry.message.user?.name ?? props.entry.message.user?.username ?? props.entry.message.user?.id ?? 'Unknown');
const isOwnMessage = computed(() => props.currentUserId != null && props.entry.message.user?.id === props.currentUserId);
const isFavoriteSender = computed(() => props.entry.message.user?.id != null && props.favoriteUserIds.includes(props.entry.message.user.id));
const avatarUrl = computed(() => displayAvatarUrl(props.entry.message.user));
const avatarFallbackUrl = computed(() => fallbackAvatarUrl(props.entry.message.user));
const avatarInitial = computed(() => senderName.value.trim().slice(0, 1).toUpperCase() || '?');
const linkPreview = computed(() => linkPreviewFromText(props.entry.message.text));
const textParts = computed(() => parseMentionText(props.entry.message.text ?? '', props.mentionMembers));
const displayReactions = computed(() => (props.entry.message.reactions ?? []).filter((reaction) => reaction.count > 0));
const fileUrl = computed(() => props.entry.message.file?.url ?? props.entry.message.file?.thumbnailUrl ?? null);
const imageSrc = computed(() => props.entry.message.file?.thumbnailUrl ?? props.entry.message.file?.url ?? '');
const imageAlt = computed(() => props.entry.message.file?.name ?? i18n.t('files.imagePreview'));
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

function mentionInitial(user: UserSummary): string {
  return (user.name ?? user.username).trim().slice(0, 1).toUpperCase() || '?';
}
</script>
