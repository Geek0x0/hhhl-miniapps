<template>
  <header class="chat-header">
    <button
      class="chat-icon-button"
      type="button"
      :aria-label="i18n.t('rooms.title')"
      @click="selectBack"
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
        @click="selectSearch"
      >
        <Search :size="18" />
      </button>
      <button
        class="chat-icon-button"
        type="button"
        :aria-label="i18n.t('rooms.members')"
        @click="selectMembers"
      >
        <Users :size="18" />
      </button>
      <div
        ref="moreRoot"
        class="chat-header__more"
        @focusout="handleMoreFocusOut"
      >
        <button
          ref="moreButton"
          class="chat-icon-button"
          type="button"
          :aria-label="i18n.t('chat.moreActions')"
          aria-haspopup="menu"
          :aria-expanded="showMore ? 'true' : 'false'"
          @click="toggleMore"
          @keydown="handleMoreButtonKeydown"
        >
          <EllipsisVertical :size="18" />
        </button>
        <div
          v-if="showMore"
          class="chat-header__more-menu"
          role="menu"
          @keydown="handleMenuKeydown"
        >
          <button
            ref="favoritesMenuItem"
            type="button"
            role="menuitem"
            @click="selectMore('favorites')"
          >
            <Heart :size="16" />
            <span>{{ i18n.t('chat.favorites') }}</span>
          </button>
          <button
            ref="keySearchMenuItem"
            type="button"
            role="menuitem"
            @click="selectMore('keySearch')"
          >
            <KeyRound :size="16" />
            <span>{{ i18n.t('chat.keySearch') }}</span>
          </button>
          <button
            ref="manageMenuItem"
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
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
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

type MoreAction = 'keySearch' | 'favorites' | 'manage';

const showMore = ref(false);
const moreRoot = ref<globalThis.HTMLElement | null>(null);
const moreButton = ref<globalThis.HTMLButtonElement | null>(null);
const favoritesMenuItem = ref<globalThis.HTMLButtonElement | null>(null);
const keySearchMenuItem = ref<globalThis.HTMLButtonElement | null>(null);
const manageMenuItem = ref<globalThis.HTMLButtonElement | null>(null);

function closeMore(options: { restoreFocus?: boolean } = {}): void {
  showMore.value = false;

  if (options.restoreFocus === true) {
    void nextTick(() => moreButton.value?.focus());
  }
}

function openMore(focusIndex?: number): void {
  showMore.value = true;

  if (focusIndex != null) {
    void nextTick(() => focusMenuItem(focusIndex));
  }
}

function toggleMore(): void {
  if (showMore.value) {
    closeMore();
  } else {
    openMore();
  }
}

function menuItems(): globalThis.HTMLButtonElement[] {
  return [favoritesMenuItem.value, keySearchMenuItem.value, manageMenuItem.value]
    .filter((item): item is globalThis.HTMLButtonElement => item != null);
}

function focusMenuItem(index: number): void {
  const items = menuItems();
  if (items.length === 0) {
    return;
  }

  const nextIndex = ((index % items.length) + items.length) % items.length;
  items[nextIndex]?.focus();
}

function focusedMenuItemIndex(): number {
  return menuItems().findIndex((item) => item === globalThis.document.activeElement);
}

function moveMenuFocus(delta: number): void {
  const currentIndex = focusedMenuItemIndex();
  focusMenuItem(currentIndex === -1 ? 0 : currentIndex + delta);
}

function selectBack(): void {
  closeMore();
  emit('back');
}

function selectSearch(): void {
  closeMore();
  emit('search');
}

function selectMembers(): void {
  closeMore();
  emit('members');
}

function selectMore(action: MoreAction): void {
  closeMore();

  if (action === 'keySearch') {
    emit('keySearch');
  } else if (action === 'favorites') {
    emit('favorites');
  } else {
    emit('manage');
  }
}

function handleMoreButtonKeydown(event: globalThis.KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    openMore(0);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    openMore(menuItems().length - 1);
  } else if (event.key === 'Escape' && showMore.value) {
    event.preventDefault();
    closeMore({ restoreFocus: true });
  }
}

function handleMenuKeydown(event: globalThis.KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMore({ restoreFocus: true });
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveMenuFocus(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveMenuFocus(-1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    focusMenuItem(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    focusMenuItem(menuItems().length - 1);
  }
}

function handleDocumentPointerDown(event: globalThis.PointerEvent): void {
  if (!showMore.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof globalThis.Node)) {
    return;
  }

  if (moreRoot.value?.contains(target) === true) {
    return;
  }

  closeMore();
}

function handleMoreFocusOut(event: globalThis.FocusEvent): void {
  if (!showMore.value) {
    return;
  }

  const nextTarget = event.relatedTarget;
  if (!(nextTarget instanceof globalThis.Node) || moreRoot.value?.contains(nextTarget) !== true) {
    closeMore();
  }
}

onMounted(() => {
  globalThis.document.addEventListener('pointerdown', handleDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  globalThis.document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
});
</script>
