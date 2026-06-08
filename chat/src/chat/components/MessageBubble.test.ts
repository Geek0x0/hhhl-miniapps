import { fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEntry } from '../timelineMerge';
import MessageBubble from './MessageBubble.vue';

function renderBubble(entry: TimelineEntry, props: Partial<InstanceType<typeof MessageBubble>['$props']> = {}) {
  return render(MessageBubble, {
    props: {
      entry,
      currentUserId: 'me',
      favoriteUserIds: [],
      mutedUserIds: [],
      mentionMembers: [],
      ...props,
    },
  });
}

describe('MessageBubble', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('displays nested special tag wrappers as their inner message text', () => {
    const { container, queryByText } = renderBubble({
      kind: 'server',
      message: {
        id: 'm1',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        text: '$[shake $[jump 签到成功 ✅  今日份在线打卡，状态：稳得一批～]]',
        user: { id: 'user-1', username: 'alice' },
      },
    });

    expect(container.querySelector('.message-bubble__text')?.textContent).toContain('签到成功 ✅  今日份在线打卡，状态：稳得一批～');
    expect(queryByText(/\$\[shake/)).not.toBeInTheDocument();
  });

  it('does not send the mini app origin as referrer for avatars and message images', () => {
    const { container } = renderBubble({
      kind: 'server',
      message: {
        id: 'm1',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        text: 'photo',
        user: {
          id: 'user-1',
          username: 'alice',
          avatarUrl: 'https://dc.hhhl.cc/proxy/avatar.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Falice.png&avatar=1',
        },
        file: {
          id: 'file-1',
          name: 'photo.png',
          type: 'image/png',
          url: 'https://dc.hhhl.cc/files/photo.png',
          thumbnailUrl: 'https://dc.hhhl.cc/thumbs/photo.webp',
        },
      },
    });

    expect(container.querySelector<HTMLImageElement>('.message-bubble__avatar')?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(container.querySelector<HTMLImageElement>('.message-bubble__image')?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('falls back from thumbnail to original image and then Sharkey media proxies', async () => {
    const { container } = renderBubble({
      kind: 'server',
      message: {
        id: 'm1',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        text: null,
        user: { id: 'user-1', username: 'alice' },
        file: {
          id: 'file-1',
          name: 'photo.png',
          type: 'image/png',
          url: 'https://dc.hhhl.cc/files/photo.png',
          thumbnailUrl: 'https://dc.hhhl.cc/thumbs/photo.webp',
        },
      },
    });
    const image = container.querySelector<HTMLImageElement>('.message-bubble__image');

    expect(image?.getAttribute('src')).toBe('https://dc.hhhl.cc/thumbs/photo.webp');

    await fireEvent.error(image as HTMLImageElement);
    expect(image?.getAttribute('src')).toBe('https://dc.hhhl.cc/files/photo.png');

    await fireEvent.error(image as HTMLImageElement);
    expect(image?.getAttribute('src')).toBe('https://dc.hhhl.cc/proxy/preview.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Fphoto.png&fallback=1&preview=1');

    await fireEvent.error(image as HTMLImageElement);
    expect(image?.getAttribute('src')).toBe('https://dc.hhhl.cc/proxy/image.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Fphoto.png&fallback=1');
  });

  it('marks long reply previews as wrapping text inside the bubble width', () => {
    const { container } = renderBubble({
      kind: 'server',
      message: {
        id: 'm2',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:01.000Z',
        text: 'reply',
        user: { id: 'user-2', username: 'bob' },
        replyId: 'm1',
        reply: {
          id: 'm1',
          roomId: 'room-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          text: 'https://example.com/really/long/path/that/should/not/stretch/the/message/bubble/past/the/current/timeline/width',
          user: { id: 'user-1', username: 'alice', name: 'Alice' },
        },
      },
    });

    expect(container.querySelector('.message-reference__preview')).toHaveTextContent('https://example.com/really/long/path');
  });

  it('opens a sender menu on avatar long press with favorite and mute actions', async () => {
    vi.useFakeTimers();
    const { container, emitted } = renderBubble({
      kind: 'server',
      message: {
        id: 'm1',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        text: 'hello',
        user: { id: 'user-1', username: 'alice', name: 'Alice' },
      },
    });

    await fireEvent.pointerDown(container.querySelector('.message-bubble__avatar') as Element);
    await vi.advanceTimersByTimeAsync(500);

    await fireEvent.click(screen.getByRole('menuitem', { name: 'Add favorite' }));
    expect(emitted('toggleFavorite')).toEqual([['user-1']]);

    await fireEvent.pointerDown(container.querySelector('.message-bubble__avatar') as Element);
    await vi.advanceTimersByTimeAsync(500);

    await fireEvent.click(screen.getByRole('menuitem', { name: 'Block this person' }));
    expect(emitted('muteUser')).toEqual([['user-1']]);
  });
});
