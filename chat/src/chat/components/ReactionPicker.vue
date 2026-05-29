<template>
  <div class="reaction-picker">
    <button
      v-for="reaction in reactions"
      :key="reaction"
      class="reaction-picker__button"
      type="button"
      :aria-label="reaction"
      @click="$emit('select', reaction)"
    >
      {{ reaction }}
    </button>
  </div>
</template>

<script setup lang="ts">
const reactions = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢', '👏'];

defineEmits<{
  select: [reaction: string];
}>();
</script>
