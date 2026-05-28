<template>
  <section
    v-if="invitations.length > 0"
    class="room-section"
  >
    <h2>{{ i18n.t('rooms.invitations') }}</h2>
    <ul class="room-invitation-list">
      <li
        v-for="invitation in invitations"
        :key="invitation.id"
        class="room-invitation"
      >
        <span>{{ invitation.room?.name ?? invitation.roomId ?? invitation.id }}</span>
        <span class="room-invitation__actions">
          <button
            class="app-button"
            type="button"
            @click="$emit('accept', invitation.id, invitation.room?.id ?? invitation.roomId ?? '')"
          >
            {{ i18n.t('rooms.directJoin') }}
          </button>
          <button
            class="app-button app-button-secondary"
            type="button"
            @click="$emit('ignore', invitation.id)"
          >
            {{ i18n.t('common.clear') }}
          </button>
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';
import type { RoomInvitation } from '../roomStore';

defineProps<{
  invitations: RoomInvitation[];
}>();

defineEmits<{
  accept: [invitationId: string, roomId: string];
  ignore: [invitationId: string];
}>();
</script>
