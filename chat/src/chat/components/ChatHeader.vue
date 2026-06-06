<template>
  <header class="chat-header">
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('rooms.title')"
      @click="$emit('back')"
    >
      <ArrowLeft :size="20" />
    </button>
    <div class="chat-header__title">
      <strong>{{ title }}</strong>
      <small>{{ roomId }}</small>
    </div>
    <span
      v-if="degraded"
      class="chat-header__status"
    >
      {{ i18n.t('realtime.polling') }}
    </span>
    <div class="chat-header__actions">
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('common.search')"
        @click="$emit('search')"
      >
        <Search :size="18" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('rooms.members')"
        @click="$emit('members')"
      >
        <Users :size="18" />
      </button>
      <div class="chat-header__more">
        <button
          class="chat-icon-button"
          type="button"
          :aria-label="i18n.t('chat.moreActions')"
          aria-haspopup="menu"
          :aria-expanded="showMore ? 'true' : 'false'"
          @click="showMore = !showMore"
        >
          <EllipsisVertical :size="18" />
        </button>
        <div
          v-if="showMore"
          class="chat-header__more-menu"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            @click="selectMore('favorites')"
          >
            <Heart :size="16" />
            <span>{{ i18n.t('chat.favorites') }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            @click="selectMore('keySearch')"
          >
            <KeyRound :size="16" />
            <span>{{ i18n.t('chat.keySearch') }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            @click="selectMore('manage')"
          >
            <Settings :size="16" />
            <span>{{ i18n.t('rooms.manage') }}</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ArrowLeft, EllipsisVertical, Heart, KeyRound, Search, Settings, Users } from '@lucide/vue';
import { i18n } from '@/i18n';

defineProps<{
  roomId: string;
  title: string;
  degraded?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  search: [];
  keySearch: [];
  favorites: [];
  members: [];
  manage: [];
}>();

const showMore = ref(false);

function selectMore(action: 'keySearch' | 'favorites' | 'manage'): void {
  showMore.value = false;

  if (action === 'keySearch') {
    emit('keySearch');
  } else if (action === 'favorites') {
    emit('favorites');
  } else {
    emit('manage');
  }
}
</script>
