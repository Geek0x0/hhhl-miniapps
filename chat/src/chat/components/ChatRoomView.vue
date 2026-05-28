<template>
  <main class="chat-room-shell">
    <ChatHeader
      :room-id="roomId"
      :title="roomTitle"
      @back="router.push('/rooms')"
    />
    <p
      v-if="chatStore.error != null"
      class="chat-error"
      role="alert"
    >
      {{ chatStore.error }}
    </p>
    <MessageTimeline
      :entries="chatStore.timeline"
      @load-older="chatStore.loadOlder()"
      @reply="chatStore.setReplyTarget"
      @quote="chatStore.setQuoteTarget"
      @react="(messageId, reaction) => chatStore.react(messageId, reaction)"
      @delete="chatStore.deleteMessage"
      @retry="chatStore.retryMessage"
      @remove="chatStore.removeFailedMessage"
    />
    <MessageComposer
      :reply-target="chatStore.replyTarget"
      :quote-target="chatStore.quoteTarget"
      @send="chatStore.sendText"
      @clear-context="chatStore.clearComposerContext()"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatHeader from './ChatHeader.vue';
import MessageComposer from './MessageComposer.vue';
import MessageTimeline from './MessageTimeline.vue';
import { useChatStore } from '../chatStore';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const roomId = computed(() => String(route.params.roomId ?? ''));
const roomTitle = computed(() => roomId.value);

async function loadRoom(): Promise<void> {
  if (roomId.value !== '') {
    await chatStore.loadInitial(roomId.value);
  }
}

onMounted(loadRoom);
watch(roomId, loadRoom);
</script>
