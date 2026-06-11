import { createApp, defineComponent, nextTick, ref } from 'vue';
import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import MessageTimeline from './MessageTimeline.vue';

const baseMessage = {
  roomId: 'room-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  text: 'hello',
  user: { id: 'user-1', username: 'alice', name: 'Alice' },
};

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 320,
    width: 320,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function findElement(container: ParentNode, selector: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(selector);
  if (element == null) {
    throw new Error(`Expected ${selector} to be rendered`);
  }
  return element;
}

describe('MessageTimeline', () => {
  it('renders a skeleton loading state while loading older messages', () => {
    const { container } = render(MessageTimeline, {
      props: {
        entries: [
          { kind: 'server', message: { ...baseMessage, id: 'm1' } },
        ],
        loadingOlder: true,
        hasMoreOlder: true,
        currentUserId: 'me',
        favoriteUserIds: [],
        mutedUserIds: [],
        mentionMembers: [],
      },
    });

    const loadingState = findElement(container, '.message-timeline__loading');

    expect(loadingState).toHaveClass('ui-skeleton');
    expect(loadingState).toHaveClass('message-timeline__loading--readable');
    expect(loadingState).toHaveAttribute('aria-live', 'polite');
    expect(loadingState).toHaveTextContent('Loading...');
  });

  it('shows loading without the empty state while loading older messages with no entries', () => {
    const { container } = render(MessageTimeline, {
      props: {
        entries: [],
        loadingOlder: true,
        hasMoreOlder: true,
        currentUserId: 'me',
        favoriteUserIds: [],
        mutedUserIds: [],
        mentionMembers: [],
      },
    });

    const loadingState = findElement(container, '.message-timeline__loading');

    expect(loadingState).toHaveTextContent('Loading...');
    expect(container.querySelector('.message-timeline__empty')).not.toBeInTheDocument();
    expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
  });

  it('renders an empty state when the timeline has no visible messages', () => {
    const { container } = render(MessageTimeline, {
      props: {
        entries: [],
        loadingOlder: false,
        hasMoreOlder: false,
        currentUserId: 'me',
        favoriteUserIds: [],
        mutedUserIds: [],
        mentionMembers: [],
      },
    });

    const emptyState = findElement(container, '.message-timeline__empty');

    expect(emptyState).toHaveClass('ui-empty-state');
    expect(emptyState).toHaveTextContent('No messages yet');
  });

  it('shows the number of new messages on the new message button', async () => {
    const { container, rerender } = render(MessageTimeline, {
      props: {
        entries: [
          { kind: 'server', message: { ...baseMessage, id: 'm1' } },
        ],
        loadingOlder: false,
        hasMoreOlder: false,
        currentUserId: 'me',
        favoriteUserIds: [],
        mutedUserIds: [],
        mentionMembers: [],
      },
    });

    const timeline = findElement(container, '.message-timeline');
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

  it('hides messages from muted users', () => {
    render(MessageTimeline, {
      props: {
        entries: [
          {
            kind: 'server',
            message: { ...baseMessage, id: 'm1', text: 'blocked', user: { id: 'user-1', username: 'alice', name: 'Alice' } },
          },
          {
            kind: 'server',
            message: { ...baseMessage, id: 'm2', text: 'visible', user: { id: 'user-2', username: 'bob', name: 'Bob' } },
          },
        ],
        loadingOlder: false,
        hasMoreOlder: false,
        currentUserId: 'me',
        favoriteUserIds: [],
        mutedUserIds: ['user-1'],
        mentionMembers: [],
      },
    });

    expect(screen.queryByText('blocked')).not.toBeInTheDocument();
    expect(screen.getByText('visible')).toBeInTheDocument();
  });

  it('uses reduced-motion aware behavior when jumping to a message', async () => {
    const originalMatchMedia = globalThis.matchMedia;
    const scrollIntoView = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);

    const timelineRef = ref<{ scrollToMessage: (messageId: string) => boolean } | null>(null);
    const app = createApp(defineComponent({
      components: { MessageTimeline },
      setup() {
        return { timelineRef, baseMessage };
      },
      template: `
        <MessageTimeline
          ref="timelineRef"
          :entries="[{ kind: 'server', message: { ...baseMessage, id: 'm1' } }]"
          :loading-older="false"
          :has-more-older="false"
          current-user-id="me"
          :favorite-user-ids="[]"
          :muted-user-ids="[]"
          :mention-members="[]"
        />
      `,
    }));

    try {
      app.mount(host);
      await nextTick();
      const messageElement = findElement(host, '[data-message-id="m1"]');
      messageElement.scrollIntoView = scrollIntoView;

      globalThis.matchMedia = vi.fn().mockReturnValue({ matches: false });
      expect(timelineRef.value?.scrollToMessage('m1')).toBe(true);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'center', behavior: 'smooth' });

      globalThis.matchMedia = vi.fn().mockReturnValue({ matches: true });
      expect(timelineRef.value?.scrollToMessage('m1')).toBe(true);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'center', behavior: 'auto' });
    } finally {
      globalThis.matchMedia = originalMatchMedia;
      app.unmount();
      host.remove();
    }
  });

  it('preserves the first visible message position after loading older messages', async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof globalThis.requestAnimationFrame;

    try {
      const { container, emitted, rerender } = render(MessageTimeline, {
        props: {
          entries: [
            { kind: 'server', message: { ...baseMessage, id: 'm1' } },
            { kind: 'server', message: { ...baseMessage, id: 'm2', createdAt: '2026-01-01T00:00:01.000Z' } },
          ],
          loadingOlder: false,
          hasMoreOlder: true,
          currentUserId: 'me',
          favoriteUserIds: [],
          mutedUserIds: [],
          mentionMembers: [],
        },
      });

      const timeline = findElement(container, '.message-timeline');
      let scrollHeight = 1000;
      let scrollTop = 120;
      let firstVisibleTop = 40;

      Object.defineProperties(timeline, {
        scrollHeight: { configurable: true, get: () => scrollHeight },
        scrollTop: {
          configurable: true,
          get: () => scrollTop,
          set: (value: number) => {
            scrollTop = value;
          },
        },
        clientHeight: { configurable: true, get: () => 360 },
      });
      timeline.getBoundingClientRect = () => rect(0, 360);
      findElement(container, '[data-message-id="m1"]').getBoundingClientRect = () => rect(firstVisibleTop, firstVisibleTop + 80);

      await waitFor(() => {
        expect(scrollTop).toBe(1000);
      });
      scrollTop = 120;

      const scrollEvent = fireEvent.scroll(timeline);
      await rerender({ loadingOlder: true });
      await scrollEvent;
      expect(emitted('loadOlder')).toEqual([[]]);

      scrollHeight = 1140;
      firstVisibleTop = 136;
      await rerender({
        loadingOlder: false,
        entries: [
          { kind: 'server', message: { ...baseMessage, id: 'older', createdAt: '2025-12-31T23:59:59.000Z' } },
          { kind: 'server', message: { ...baseMessage, id: 'm1' } },
          { kind: 'server', message: { ...baseMessage, id: 'm2', createdAt: '2026-01-01T00:00:01.000Z' } },
        ],
      });

      await waitFor(() => {
        expect(scrollTop).toBe(216);
      });
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});
