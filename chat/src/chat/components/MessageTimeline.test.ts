import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import MessageTimeline from './MessageTimeline.vue';

const baseMessage = {
  roomId: 'room-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  text: 'hello',
  user: { id: 'user-1', username: 'alice', name: 'Alice' },
};

describe('MessageTimeline', () => {
  it('shows the number of new messages on the new message button', async () => {
    const { rerender } = render(MessageTimeline, {
      props: {
        entries: [
          { kind: 'server', message: { ...baseMessage, id: 'm1' } },
        ],
        loadingOlder: false,
        hasMoreOlder: false,
        currentUserId: 'me',
        favoriteUserIds: [],
        mentionMembers: [],
      },
    });

    const timeline = document.querySelector<HTMLElement>('.message-timeline');
    Object.defineProperties(timeline, {
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, writable: true, value: 0 },
      clientHeight: { configurable: true, value: 360 },
    });

    await rerender({
      entries: [
        { kind: 'server', message: { ...baseMessage, id: 'm1' } },
        { kind: 'server', message: { ...baseMessage, id: 'm2', createdAt: '2026-01-01T00:00:01.000Z' } },
        { kind: 'server', message: { ...baseMessage, id: 'm3', createdAt: '2026-01-01T00:00:02.000Z' } },
      ],
    });

    expect(await screen.findByRole('button', { name: '2 new messages' })).toHaveTextContent('2 new messages');
  });
});
