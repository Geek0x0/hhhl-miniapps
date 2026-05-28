<template>
  <main class="rooms-shell">
    <header class="rooms-header">
      <p class="app-eyebrow">
        dc.hhhl.cc
      </p>
      <h1>{{ i18n.t('rooms.title') }}</h1>
    </header>

    <RoomDirectJoin
      :loading="roomStore.loading"
      @join="joinRoom"
    />
    <RoomErrorState
      :message="roomStore.error"
      @clear="roomStore.clearRoomError()"
    />

    <p
      v-if="roomStore.loading"
      class="app-copy"
    >
      {{ i18n.t('common.loading') }}
    </p>
    <section
      v-else
      class="room-section"
    >
      <h2>{{ i18n.t('rooms.joined') }}</h2>
      <p
        v-if="roomStore.rooms.length === 0"
        class="app-copy"
      >
        {{ i18n.t('chat.empty') }}
      </p>
      <div
        v-else
        class="room-list"
      >
        <RoomListItem
          v-for="entry in roomStore.rooms"
          :key="entry.room.id"
          :entry="entry"
        />
      </div>
    </section>

    <RoomInvitationList
      :invitations="roomStore.invitations"
      @accept="acceptInvitation"
      @ignore="roomStore.ignoreInvitation"
    />
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { i18n } from '@/i18n';
import { getTelegramLaunchContext } from '@/telegram/telegram';
import RoomDirectJoin from './RoomDirectJoin.vue';
import RoomErrorState from './RoomErrorState.vue';
import RoomInvitationList from './RoomInvitationList.vue';
import RoomListItem from './RoomListItem.vue';
import { useRoomStore } from '../roomStore';

const roomStore = useRoomStore();
const router = useRouter();

async function joinRoom(roomId: string): Promise<void> {
  await roomStore.joinRoomById(roomId);
  if (roomStore.activeRoomId != null) {
    await router.push(`/rooms/${roomStore.activeRoomId}`);
  }
}

async function acceptInvitation(invitationId: string, roomId: string): Promise<void> {
  if (roomId === '') {
    return;
  }

  await roomStore.acceptInvitation(invitationId, roomId);
}

onMounted(async () => {
  roomStore.preserveStartTarget(getTelegramLaunchContext().startParam);
  await roomStore.loadRooms();
  if (roomStore.pendingStartRoomId != null) {
    await router.replace(`/rooms/${roomStore.pendingStartRoomId}`);
  }
});
</script>
