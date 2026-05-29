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
        {{ source }}
      </span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MergedRoom } from '../roomMerge';

const props = defineProps<{
  entry: MergedRoom;
}>();

const visibleSources = computed(() => props.entry.sources.filter((source) => source !== 'deep-link'));
</script>
