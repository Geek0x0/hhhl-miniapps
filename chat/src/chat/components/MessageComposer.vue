<template>
  <form
    class="message-composer"
    @submit.prevent="submit"
  >
    <ReplyPreview
      :label="i18n.t('chat.replyingTo', { name: replyTarget?.user?.name ?? replyTarget?.user?.username ?? replyTarget?.id ?? '' })"
      :message="replyTarget"
      @clear="$emit('clearContext')"
    />
    <ReplyPreview
      :label="i18n.t('chat.quote')"
      :message="quoteTarget"
      @clear="$emit('clearContext')"
    />
    <UploadProgressList
      :items="uploads"
      @remove="removeUploadItem"
    />
    <div class="message-composer__row">
      <FilePickerButton @select="addFiles" />
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('chat.emoji')"
        @click="showEmojiPicker = !showEmojiPicker"
      >
        <Smile :size="18" />
      </button>
      <textarea
        v-model="text"
        class="message-composer__input"
        :aria-label="i18n.t('chat.messageInput')"
        :placeholder="i18n.t('chat.composerPlaceholder')"
        rows="1"
        @keydown.enter.exact.prevent="submit"
        @paste="handlePaste"
      />
      <button
        class="chat-icon-button chat-icon-button--send"
        type="submit"
        :aria-label="i18n.t('common.send')"
        :disabled="text.trim() === '' && uploads.length === 0"
      >
        <Send :size="18" />
      </button>
    </div>
    <div
      v-if="mentionSuggestions.length > 0"
      class="mention-suggestions"
      role="listbox"
      :aria-label="i18n.t('chat.mentionSuggestions')"
    >
      <button
        v-for="member in mentionSuggestions"
        :key="member.id"
        class="mention-suggestions__item"
        type="button"
        role="option"
        :aria-label="i18n.t('chat.mentionMember', { name: member.name ?? member.username, username: member.username })"
        @click="insertMention(member)"
      >
        <img
          v-if="member.avatarUrl != null"
          class="mention-suggestions__avatar"
          :src="displayAvatarUrl(member) ?? ''"
          referrerpolicy="no-referrer"
          alt=""
          @error="useAvatarFallback($event, fallbackAvatarUrl(member))"
        >
        <span
          v-else
          class="mention-suggestions__avatar mention-suggestions__avatar--fallback"
          aria-hidden="true"
        >
          {{ memberInitial(member) }}
        </span>
        <span class="mention-suggestions__main">
          <strong>{{ member.name ?? member.username }}</strong>
          <small>@{{ member.username }}</small>
        </span>
      </button>
    </div>
    <div
      v-if="showEmojiPicker"
      class="emoji-picker"
    >
      <button
        v-for="emoji in emojis"
        :key="emoji"
        class="emoji-picker__button"
        type="button"
        :aria-label="emoji"
        @click="insertEmoji(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
/* global ClipboardEvent, File, URL */
import { computed, ref } from 'vue';
import { Send, Smile } from '@lucide/vue';
import { i18n } from '@/i18n';
import FilePickerButton from '@/files/components/FilePickerButton.vue';
import UploadProgressList from '@/files/components/UploadProgressList.vue';
import { addUpload, removeUpload, validateUploadFile, type UploadItem } from '@/files/uploadQueue';
import { avatarDisplayUrl, avatarFallbackUrl, useAvatarFallback } from '@/shared/avatarUrl';
import type { ChatMessage, UserSummary } from '@/shared/types';
import { createUuid } from '@/shared/uuid';
import { mentionCandidates } from '../mentions';
import ReplyPreview from './ReplyPreview.vue';

const props = defineProps<{
  replyTarget: ChatMessage | null;
  quoteTarget: ChatMessage | null;
  mentionMembers: UserSummary[];
}>();

const emit = defineEmits<{
  send: [text: string];
  sendFile: [file: File];
  clearContext: [];
}>();

const text = ref('');
const uploads = ref<UploadItem[]>([]);
const showEmojiPicker = ref(false);
const emojis = [
  '😀', '😃', '😄', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😮', '😢', '😡', '👍', '👎', '👏', '🙏',
  '💪', '✅', '❌', '🔥', '🎉', '🚀', '❤️', '💯', '✨', '⭐', '👀', '📌', '🔑', '💬', '☕', '🍻', '🎯', '🧠',
];

const activeMention = computed(() => {
  const match = /(?:^|\s)@([A-Za-z0-9_]{0,32})$/.exec(text.value);
  return match == null ? null : match[1];
});
const mentionSuggestions = computed(() => activeMention.value == null ? [] : mentionCandidates(props.mentionMembers, activeMention.value));

function uploadId(): string {
  return `upload-${createUuid()}`;
}

function previewUrl(file: File): string | undefined {
  return file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
}

function addFiles(files: File[]): void {
  for (const file of files) {
    if (!validateUploadFile(file).ok) {
      continue;
    }

    uploads.value = addUpload(uploads.value, { id: uploadId(), file, previewUrl: previewUrl(file) });
  }
}

function removeUploadItem(id: string): void {
  const item = uploads.value.find((upload) => upload.id === id);
  if (item?.previewUrl != null) {
    URL.revokeObjectURL(item.previewUrl);
  }
  uploads.value = removeUpload(uploads.value, id);
}

function handlePaste(event: ClipboardEvent): void {
  const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
  if (files.length > 0) {
    addFiles(files);
  }
}

function insertEmoji(emoji: string): void {
  text.value += emoji;
}

function insertMention(member: UserSummary): void {
  text.value = text.value.replace(/(^|\s)@([A-Za-z0-9_]{0,32})$/, `$1@${member.username} `);
}

function displayAvatarUrl(member: UserSummary): string | null {
  return avatarDisplayUrl(member.avatarUrl, member.avatarFallbackUrl);
}

function fallbackAvatarUrl(member: UserSummary): string | null {
  return avatarFallbackUrl(member.avatarUrl, member.avatarFallbackUrl);
}

function memberInitial(member: UserSummary): string {
  return (member.name ?? member.username).trim().slice(0, 1).toUpperCase() || '?';
}

function submit(): void {
  const value = text.value.trim();

  if (value !== '') {
    emit('send', value);
    text.value = '';
  }

  for (const item of uploads.value) {
    emit('sendFile', item.file);
    if (item.previewUrl != null) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
  uploads.value = [];
}
</script>
