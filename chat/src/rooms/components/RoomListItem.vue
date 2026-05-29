<template>
  <RouterLink
    class="room-list-item"
    :to="`/rooms/${entry.room.id}`"
  >
    <span class="room-list-item__main">
      <strong>{{ entry.room.name }}</strong>
      <small>{{ entry.room.description ?? entry.room.id }}</small>
    </span>
    <span
      v-if="visibleSources.length > 0"
      class="room-list-item__badges"
    >
      <span
        v-for="source in visibleSources"
        :key="source"
        class="room-source-badge"
      >
        {{ i18n.t(sourceLabelKeys[source]) }}
      </span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { i18n } from '@/i18n';
import type { MergedRoom, RoomSource } from '../roomMerge';

type VisibleRoomSource = Exclude<RoomSource, 'deep-link'>;

const sourceLabelKeys = {
  invited: 'rooms.source.invited',
  joined: 'rooms.source.joined',
  manual: 'rooms.source.manual',
  owned: 'rooms.source.owned',
} as const satisfies Record<VisibleRoomSource, Parameters<typeof i18n.t>[0]>;

const props = defineProps<{
  entry: MergedRoom;
}>();

const visibleSources = computed(() => props.entry.sources.filter((source): source is VisibleRoomSource => source !== 'deep-link'));
</script>
