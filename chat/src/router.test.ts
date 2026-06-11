import { describe, expect, it } from 'vitest';
import router from './router';

describe('router', () => {
  it('uses the room entry transition for room detail routes', () => {
    const roomRoute = router.getRoutes().find((route) => route.name === 'room-detail');

    expect(roomRoute?.meta.transition).toBe('room-enter');
  });
});
