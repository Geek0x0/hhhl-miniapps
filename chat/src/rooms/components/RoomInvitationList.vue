<template>
  <section
    v-if="invitations.length > 0"
    class="room-section room-panel"
  >
    <h2>{{ i18n.t('rooms.invitations') }}</h2>
    <ul class="room-invitation-list">
      <li
        v-for="invitation in invitations"
        :key="invitation.id"
        class="room-invitation"
      >
        <span class="room-invitation__main">
          <strong>{{ invitationTitle(invitation) }}</strong>
          <small>{{ invitationDisplayId(invitation) }}</small>
        </span>
        <span class="room-invitation__actions">
          <button
            class="app-button"
            type="button"
            :disabled="invitationJoinRoomId(invitation) == null"
            @click="acceptInvitation(invitation)"
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

const emit = defineEmits<{
  accept: [invitationId: string, roomId: string];
  ignore: [invitationId: string];
}>();

function invitationTitle(invitation: RoomInvitation): string {
  return invitation.room?.name ?? invitation.roomId ?? invitation.id;
}

function invitationDisplayId(invitation: RoomInvitation): string {
  return invitation.room?.id ?? invitation.roomId ?? invitation.id;
}

function invitationJoinRoomId(invitation: RoomInvitation): string | null {
  return invitation.room?.id ?? invitation.roomId ?? null;
}

function acceptInvitation(invitation: RoomInvitation): void {
  const roomId = invitationJoinRoomId(invitation);

  if (roomId == null) {
    return;
  }

  emit('accept', invitation.id, roomId);
}
</script>
