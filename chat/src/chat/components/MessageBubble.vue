<template>
  <article
    class="message-bubble"
    :data-message-id="entry.message.id"
    :class="{
      'message-bubble--own': isOwnMessage,
      'message-bubble--incoming': !isOwnMessage,
      'message-bubble--pending': entry.kind === 'pending',
      'message-bubble--sending': entry.kind === 'pending' && entry.status !== 'failed',
      'message-bubble--failed': entry.kind === 'pending' && entry.status === 'failed',
      'message-bubble--referenced': reference != null,
    }"
  >
    <img
      v-if="avatarUrl != null && !avatarLoadFailed"
      ref="avatarButtonEl"
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
      @error="handleAvatarError"
    >
    <div
      v-else
      ref="avatarButtonEl"
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
        <strong class="message-reference__label">{{ reference.label }}</strong>
        <span class="message-reference__preview">{{ reference.preview }}</span>
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
        v-if="fileUrl != null && isImageFile && !imageLoadFailed"
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
          @error="handleMessageImageError"
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
          class="image-lightbox__toolbar"
          @click.stop
        >
          <button
            class="chat-icon-button image-lightbox__control"
            type="button"
            :aria-label="i18n.t('files.zoomOut')"
            :disabled="imagePreviewScale <= IMAGE_PREVIEW_MIN_SCALE"
            @click="zoomImagePreviewOut"
          >
            <ZoomOut :size="18" />
          </button>
          <button
            class="chat-icon-button image-lightbox__control"
            type="button"
            :aria-label="i18n.t('files.resetZoom')"
            :disabled="imagePreviewScale === 1"
            @click="resetImagePreviewZoom"
          >
            <RotateCcw :size="18" />
          </button>
          <button
            class="chat-icon-button image-lightbox__control"
            type="button"
            :aria-label="i18n.t('files.zoomIn')"
            :disabled="imagePreviewScale >= IMAGE_PREVIEW_MAX_SCALE"
            @click="zoomImagePreviewIn"
          >
            <ZoomIn :size="18" />
          </button>
        </div>
        <div
          ref="imagePreviewContainerEl"
          class="image-lightbox__container"
          :class="{
            'image-lightbox__container--pannable': imagePreviewPannable,
            'image-lightbox__container--panning': imagePreviewPan != null,
          }"
          @click.stop
          @pointerdown="handleImagePreviewPointerDown"
          @pointermove="handleImagePreviewPointerMove"
          @pointerup="handleImagePreviewPointerEnd"
          @pointercancel="handleImagePreviewPointerEnd"
          @lostpointercapture="handleImagePreviewPointerEnd"
        >
          <img
            class="image-lightbox__image"
            :src="previewImageSrc"
            referrerpolicy="no-referrer"
            :alt="imageAlt"
            draggable="false"
            :style="imagePreviewStyle"
            @load="handleImagePreviewLoad"
            @error="handleMessageImageError"
          >
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="senderMenuOpen"
        ref="senderMenuEl"
        class="sender-action-menu"
        role="menu"
        :style="senderMenuStyle"
        @click.stop
      >
        <button
          type="button"
          role="menuitem"
          @click="selectFavoriteAction"
        >
          <Star :size="16" />
          <span>{{ favoriteActionLabel }}</span>
        </button>
        <button
          v-if="canMuteSender"
          type="button"
          role="menuitem"
          @click="selectMuteAction"
        >
          <UserX :size="16" />
          <span>{{ i18n.t('chat.blockUser') }}</span>
        </button>
      </div>
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Heart, RefreshCw, RotateCcw, Star, UserX, X, ZoomIn, ZoomOut } from '@lucide/vue';
import { i18n } from '@/i18n';
import { avatarDisplayUrl as resolveAvatarDisplayUrl, avatarFallbackUrl as resolveAvatarFallbackUrl, useAvatarFallback } from '@/shared/avatarUrl';
import { imageProxyUrl, previewProxyUrl } from '@/shared/mediaProxy';
import { formatMessageTimestamp } from '@/shared/time';
import type { ChatMessage, UserSummary } from '@/shared/types';
import { displayMessageText } from '../messageText';
import { parseMentionText } from '../mentions';
import type { TimelineEntry } from '../timelineMerge';
import MessageActions from './MessageActions.vue';

const props = defineProps<{
  entry: TimelineEntry;
  currentUserId: string | null;
  favoriteUserIds: string[];
  mutedUserIds: string[];
  mentionMembers: UserSummary[];
  mentionMembersByUsername?: Map<string, UserSummary>;
}>();

const emit = defineEmits<{
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

interface LinkPreview {
  href: string;
  host: string;
  path: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/i;
const LONG_PRESS_DURATION_MS = 500;
const IMAGE_PREVIEW_MIN_SCALE = 1;
const IMAGE_PREVIEW_MAX_SCALE = 4;
const IMAGE_PREVIEW_SCALE_STEP = 0.25;
const IMAGE_PREVIEW_VERTICAL_GAP = 96;

interface ImagePreviewSize {
  width: number;
  height: number;
}

interface ImagePreviewPanState {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
}

const imagePreviewOpen = ref(false);
const imagePreviewScale = ref(1);
const imagePreviewNaturalSize = ref<ImagePreviewSize | null>(null);
const imagePreviewViewportSize = ref<ImagePreviewSize>(getImagePreviewViewportSize());
const imagePreviewContainerEl = ref<globalThis.HTMLElement | null>(null);
const imagePreviewPan = ref<ImagePreviewPanState | null>(null);
const longPressTimer = ref<ReturnType<typeof globalThis.setTimeout> | null>(null);
const isLongPress = ref(false);
const senderMenuOpen = ref(false);
const senderMenuStyle = ref<Record<string, string>>({ left: '8px', top: '8px' });
const avatarButtonEl = ref<globalThis.HTMLElement | null>(null);
const senderMenuEl = ref<globalThis.HTMLElement | null>(null);
const avatarLoadFailed = ref(false);
const imageSourceIndex = ref(0);
const imageLoadFailed = ref(false);
let globalListenersAttached = false;

watch(() => props.entry.message.user?.avatarUrl, () => {
  avatarLoadFailed.value = false;
});

watch(() => [props.entry.message.file?.url, props.entry.message.file?.thumbnailUrl], () => {
  imageSourceIndex.value = 0;
  imageLoadFailed.value = false;
  imagePreviewOpen.value = false;
  imagePreviewScale.value = 1;
  imagePreviewNaturalSize.value = null;
  resetImagePreviewPan();
});

function handleAvatarError(event: globalThis.Event): void {
  const element = event.currentTarget;
  if (!(element instanceof globalThis.HTMLImageElement)) {
    avatarLoadFailed.value = true;
    return;
  }

  element.removeAttribute('crossorigin');
  element.setAttribute('referrerpolicy', 'no-referrer');

  // Try fallback URL
  const fallback = resolveAvatarFallbackUrl(element.currentSrc || element.src, avatarFallbackUrl.value);
  if (fallback != null) {
    const current = element.currentSrc || element.src;
    if (current !== fallback) {
      element.src = fallback;
      return;
    }
  }

  // All attempts failed, show the initial letter fallback
  avatarLoadFailed.value = true;
}

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
  imagePreviewScale.value = 1;
  imagePreviewNaturalSize.value = null;
  resetImagePreviewPan();
  updateImagePreviewViewportSize();
  imagePreviewOpen.value = true;
}

function closeImagePreview(): void {
  imagePreviewOpen.value = false;
  imagePreviewScale.value = 1;
  imagePreviewNaturalSize.value = null;
  resetImagePreviewPan();
}

function clampImagePreviewScale(scale: number): number {
  return Math.min(IMAGE_PREVIEW_MAX_SCALE, Math.max(IMAGE_PREVIEW_MIN_SCALE, scale));
}

function zoomImagePreviewIn(): void {
  imagePreviewScale.value = clampImagePreviewScale(imagePreviewScale.value + IMAGE_PREVIEW_SCALE_STEP);
}

function zoomImagePreviewOut(): void {
  imagePreviewScale.value = clampImagePreviewScale(imagePreviewScale.value - IMAGE_PREVIEW_SCALE_STEP);
  if (imagePreviewScale.value <= IMAGE_PREVIEW_MIN_SCALE) {
    resetImagePreviewPan();
  }
}

function resetImagePreviewZoom(): void {
  imagePreviewScale.value = 1;
  resetImagePreviewPan();
}

function getImagePreviewViewportSize(): ImagePreviewSize {
  const documentElement = globalThis.document?.documentElement;
  const viewportWidth = globalThis.innerWidth || documentElement?.clientWidth || 320;
  const viewportHeight = globalThis.innerHeight || documentElement?.clientHeight || 640;

  return {
    width: Math.max(1, viewportWidth),
    height: Math.max(1, viewportHeight - IMAGE_PREVIEW_VERTICAL_GAP),
  };
}

function updateImagePreviewViewportSize(): void {
  imagePreviewViewportSize.value = getImagePreviewViewportSize();
}

function resetImagePreviewPan(): void {
  imagePreviewPan.value = null;
}

function handleImagePreviewPointerDown(event: globalThis.PointerEvent): void {
  if (!imagePreviewPannable.value || event.button !== 0) {
    return;
  }

  const element = imagePreviewContainerEl.value;
  if (element == null) {
    return;
  }

  imagePreviewPan.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScrollLeft: element.scrollLeft,
    startScrollTop: element.scrollTop,
  };
  element.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handleImagePreviewPointerMove(event: globalThis.PointerEvent): void {
  const pan = imagePreviewPan.value;
  const element = imagePreviewContainerEl.value;
  if (pan == null || element == null || event.pointerId !== pan.pointerId) {
    return;
  }

  element.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startX);
  element.scrollTop = pan.startScrollTop - (event.clientY - pan.startY);
  event.preventDefault();
}

function handleImagePreviewPointerEnd(event: globalThis.PointerEvent): void {
  const pan = imagePreviewPan.value;
  if (pan == null || event.pointerId !== pan.pointerId) {
    return;
  }

  imagePreviewContainerEl.value?.releasePointerCapture?.(event.pointerId);
  resetImagePreviewPan();
}

function handleImagePreviewLoad(event: globalThis.Event): void {
  const element = event.currentTarget;
  if (!(element instanceof globalThis.HTMLImageElement)) {
    return;
  }

  const width = element.naturalWidth || element.width;
  const height = element.naturalHeight || element.height;
  if (width <= 0 || height <= 0) {
    return;
  }

  updateImagePreviewViewportSize();
  imagePreviewNaturalSize.value = { width, height };
}

function handleMessageImageError(): void {
  imagePreviewNaturalSize.value = null;
  resetImagePreviewPan();

  if (imageSourceIndex.value < imageSources.value.length - 1) {
    imageSourceIndex.value += 1;
    return;
  }

  imageLoadFailed.value = true;
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

  void openSenderMenu();
}

async function openSenderMenu(): Promise<void> {
  senderMenuOpen.value = true;
  await nextTick();
  updateSenderMenuPosition();
}

function closeSenderMenu(): void {
  senderMenuOpen.value = false;
}

function updateSenderMenuPosition(): void {
  const avatar = avatarButtonEl.value;
  if (avatar == null) {
    return;
  }

  const rect = avatar.getBoundingClientRect();
  const viewportWidth = globalThis.innerWidth || globalThis.document.documentElement.clientWidth || 320;
  const viewportHeight = globalThis.innerHeight || globalThis.document.documentElement.clientHeight || 640;
  const width = Math.min(220, Math.max(172, viewportWidth - 16));
  const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8));
  const menuHeight = senderMenuEl.value?.offsetHeight ?? 88;
  const topBelow = rect.bottom + 8;
  const topAbove = rect.top - menuHeight - 8;
  const top = topBelow + menuHeight + 8 > viewportHeight && topAbove >= 8 ? topAbove : topBelow;

  senderMenuStyle.value = {
    left: `${left}px`,
    top: `${Math.max(8, top)}px`,
    width: `${width}px`,
  };
}

function selectFavoriteAction(): void {
  const userId = props.entry.message.user?.id;
  if (userId != null) {
    emit('toggleFavorite', userId);
  }
  closeSenderMenu();
}

function selectMuteAction(): void {
  const userId = props.entry.message.user?.id;
  if (userId != null) {
    emit('muteUser', userId);
  }
  closeSenderMenu();
}

function handleDocumentClick(event: globalThis.MouseEvent): void {
  const target = event.target;
  if (!(target instanceof globalThis.Node) || !senderMenuOpen.value) {
    return;
  }

  if (senderMenuEl.value?.contains(target) === true || avatarButtonEl.value?.contains(target) === true) {
    return;
  }

  closeSenderMenu();
}

function handleKeydown(event: globalThis.KeyboardEvent): void {
  if (senderMenuOpen.value && event.key === 'Escape') {
    closeSenderMenu();
  }
}

function handleViewportChange(): void {
  if (senderMenuOpen.value) {
    updateSenderMenuPosition();
  }

  if (imagePreviewOpen.value) {
    updateImagePreviewViewportSize();
  }
}

function addGlobalListeners(): void {
  if (globalListenersAttached) {
    return;
  }

  globalThis.document.addEventListener('click', handleDocumentClick);
  globalThis.document.addEventListener('keydown', handleKeydown);
  globalThis.addEventListener('resize', handleViewportChange);
  globalThis.addEventListener('scroll', handleViewportChange, true);
  globalListenersAttached = true;
}

function removeGlobalListeners(): void {
  if (!globalListenersAttached) {
    return;
  }

  globalThis.document.removeEventListener('click', handleDocumentClick);
  globalThis.document.removeEventListener('keydown', handleKeydown);
  globalThis.removeEventListener('resize', handleViewportChange);
  globalThis.removeEventListener('scroll', handleViewportChange, true);
  globalListenersAttached = false;
}

function syncGlobalListeners(): void {
  if (senderMenuOpen.value || imagePreviewOpen.value) {
    addGlobalListeners();
  } else {
    removeGlobalListeners();
  }
}

watch([senderMenuOpen, imagePreviewOpen], syncGlobalListeners);

onBeforeUnmount(() => {
  if (longPressTimer.value != null) {
    globalThis.clearTimeout(longPressTimer.value);
  }
  removeGlobalListeners();
});

const formattedTime = computed(() => formatMessageTimestamp(props.entry.message.createdAt));

function displayAvatarUrl(user: UserSummary | null | undefined): string | null {
  return resolveAvatarDisplayUrl(user?.avatarUrl, user?.avatarFallbackUrl);
}

function fallbackAvatarUrl(user: UserSummary | null | undefined): string | null {
  return resolveAvatarFallbackUrl(user?.avatarUrl, user?.avatarFallbackUrl);
}

const senderName = computed(() => props.entry.message.user?.name ?? props.entry.message.user?.username ?? props.entry.message.user?.id ?? 'Unknown');
const isOwnMessage = computed(() => props.currentUserId != null && props.entry.message.user?.id === props.currentUserId);
const isFavoriteSender = computed(() => props.entry.message.user?.id != null && props.favoriteUserIds.includes(props.entry.message.user.id));
const canMuteSender = computed(() => {
  const userId = props.entry.message.user?.id;
  return userId != null && !isOwnMessage.value && !props.mutedUserIds.includes(userId);
});
const favoriteActionLabel = computed(() => i18n.t(isFavoriteSender.value ? 'chat.removeFavorite' : 'chat.addFavorite'));
const avatarUrl = computed(() => displayAvatarUrl(props.entry.message.user));
const avatarFallbackUrl = computed(() => fallbackAvatarUrl(props.entry.message.user));
const avatarInitial = computed(() => senderName.value.trim().slice(0, 1).toUpperCase() || '?');
const displayedText = computed(() => displayMessageText(props.entry.message.text ?? ''));
const linkPreview = computed(() => linkPreviewFromText(displayedText.value));
const textParts = computed(() => parseMentionText(displayedText.value, props.mentionMembers, props.mentionMembersByUsername));
const displayReactions = computed(() => (props.entry.message.reactions ?? []).filter((reaction) => reaction.count > 0));
const fileUrl = computed(() => props.entry.message.file?.url ?? props.entry.message.file?.thumbnailUrl ?? null);
const imageSources = computed(() => {
  const file = props.entry.message.file;
  const baseUrl = file?.url ?? file?.thumbnailUrl ?? null;
  const candidates = [
    file?.thumbnailUrl,
    file?.url,
    baseUrl == null ? null : previewProxyUrl(baseUrl),
    baseUrl == null ? null : imageProxyUrl(baseUrl),
  ];

  return candidates.filter((candidate, index): candidate is string => (
    candidate != null && candidate !== '' && candidates.indexOf(candidate) === index
  ));
});
const imageSrc = computed(() => imageSources.value[imageSourceIndex.value] ?? '');
const previewImageSrc = computed(() => imageSrc.value);
const imageAlt = computed(() => props.entry.message.file?.name ?? i18n.t('files.imagePreview'));
const imagePreviewPannable = computed(() => imagePreviewScale.value > IMAGE_PREVIEW_MIN_SCALE);
const imagePreviewBaseSize = computed<ImagePreviewSize | null>(() => {
  const naturalSize = imagePreviewNaturalSize.value;
  if (naturalSize == null) {
    return null;
  }

  const viewportSize = imagePreviewViewportSize.value;
  const fitScale = Math.min(
    1,
    viewportSize.width / naturalSize.width,
    viewportSize.height / naturalSize.height,
  );

  return {
    width: Math.max(1, Math.round(naturalSize.width * fitScale)),
    height: Math.max(1, Math.round(naturalSize.height * fitScale)),
  };
});
const imagePreviewStyle = computed<Record<string, string>>((): Record<string, string> => {
  const baseSize = imagePreviewBaseSize.value;
  if (baseSize == null) {
    return {};
  }

  return {
    width: `${Math.max(1, Math.round(baseSize.width * imagePreviewScale.value))}px`,
    height: `${Math.max(1, Math.round(baseSize.height * imagePreviewScale.value))}px`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
});
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
  const body = displayMessageText(target?.text ?? target?.file?.name ?? id ?? '');
  return {
    label: isReply ? i18n.t('chat.replyingTo', { name: author ?? id ?? '' }) : i18n.t('chat.quote'),
    preview: author == null ? body : `${author}: ${body}`,
  };
});

function mentionInitial(user: UserSummary): string {
  return (user.name ?? user.username).trim().slice(0, 1).toUpperCase() || '?';
}
</script>
