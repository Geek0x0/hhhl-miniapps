import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/rooms',
    },
    {
      path: '/rooms',
      name: 'rooms',
      component: () => import('./rooms/components/RoomListView.vue'),
    },
    {
      path: '/rooms/:roomId',
      name: 'room-detail',
      component: () => import('./chat/components/ChatRoomView.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('./HomeView.vue'),
    },
  ],
});

export default router;
