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
import { ref } from 'vue';
import { Send, Smile } from '@lucide/vue';
import { i18n } from '@/i18n';
import FilePickerButton from '@/files/components/FilePickerButton.vue';
import UploadProgressList from '@/files/components/UploadProgressList.vue';
import { addUpload, removeUpload, validateUploadFile, type UploadItem } from '@/files/uploadQueue';
import type { ChatMessage } from '@/shared/types';
import { createUuid } from '@/shared/uuid';
import ReplyPreview from './ReplyPreview.vue';

defineProps<{
  replyTarget: ChatMessage | null;
  quoteTarget: ChatMessage | null;
}>();

const emit = defineEmits<{
  send: [text: string];
  sendFile: [file: File];
  clearContext: [];
}>();

const text = ref('');
const uploads = ref<UploadItem[]>([]);
const showEmojiPicker = ref(false);
const emojis = ['😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '🔥', '😮', '😢', '👏', '✅'];

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
