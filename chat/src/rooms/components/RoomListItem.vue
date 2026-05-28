<template>
  <RouterLink
    class="room-list-item"
    :to="`/rooms/${entry.room.id}`"
  >
    <span class="room-list-item__main">
      <strong>{{ entry.room.name }}</strong>
      <small>{{ entry.room.description ?? entry.room.id }}</small>
    </span>
    <span class="room-list-item__badges">
      <span
        v-for="source in entry.sources"
        :key="source"
        class="room-source-badge"
      >
        {{ source }}
      </span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import type { MergedRoom } from '../roomMerge';

defineProps<{
  entry: MergedRoom;
}>();
</script>
