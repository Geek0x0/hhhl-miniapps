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
    vi.unstubAllGlobals();
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

  it('opens image preview on the first click using the original image source', async () => {
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

    await fireEvent.click(container.querySelector('.message-bubble__image-button') as Element);

    const dialog = screen.getByRole('dialog', { name: 'Image preview' });
    const previewImage = dialog.querySelector<HTMLImageElement>('.image-lightbox__image');

    expect(previewImage?.getAttribute('src')).toBe('https://dc.hhhl.cc/files/photo.png');
  });

  it('zooms image previews by expanding the image layout box', async () => {
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1600);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1200);
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

    await fireEvent.click(container.querySelector('.message-bubble__image-button') as Element);
    const dialog = screen.getByRole('dialog', { name: 'Image preview' });
    const previewImage = dialog.querySelector<HTMLImageElement>('.image-lightbox__image');

    expect(previewImage).not.toBeNull();
    await fireEvent.load(previewImage as HTMLImageElement);

    expect(previewImage).toHaveStyle({
      width: '896px',
      height: '672px',
    });
    expect(previewImage?.style.transform).toBe('');

    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(previewImage).toHaveStyle({
      width: '1120px',
      height: '840px',
    });
    expect(previewImage?.style.transform).toBe('');

    await fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(previewImage).toHaveStyle({
      width: '896px',
      height: '672px',
    });
  });

  it('pans zoomed image previews by dragging the preview container', async () => {
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1600);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1200);
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

    await fireEvent.click(container.querySelector('.message-bubble__image-button') as Element);
    const dialog = screen.getByRole('dialog', { name: 'Image preview' });
    const previewImage = dialog.querySelector<HTMLImageElement>('.image-lightbox__image');
    const previewContainer = dialog.querySelector<HTMLElement>('.image-lightbox__container');

    expect(previewImage).not.toBeNull();
    expect(previewContainer).not.toBeNull();
    await fireEvent.load(previewImage as HTMLImageElement);
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    (previewContainer as HTMLElement).scrollLeft = 100;
    (previewContainer as HTMLElement).scrollTop = 80;

    await fireEvent.pointerDown(previewContainer as HTMLElement, { pointerId: 1, button: 0, clientX: 200, clientY: 200 });
    await fireEvent.pointerMove(previewContainer as HTMLElement, { pointerId: 1, clientX: 150, clientY: 180 });
    await fireEvent.pointerUp(previewContainer as HTMLElement, { pointerId: 1 });

    expect(previewContainer?.scrollLeft).toBe(150);
    expect(previewContainer?.scrollTop).toBe(100);
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

  it('marks pending and failed messages with visual state classes', () => {
    const pending = renderBubble({
      kind: 'pending',
      localId: 'local-1',
      status: 'pending',
      message: {
        id: 'local-1',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        text: 'sending',
        user: { id: 'me', username: 'me' },
      },
    });
    const failed = renderBubble({
      kind: 'pending',
      localId: 'local-2',
      status: 'failed',
      message: {
        id: 'local-2',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        text: 'failed',
        user: { id: 'me', username: 'me' },
      },
    });

    expect(pending.container.querySelector('.message-bubble')).toHaveClass('message-bubble--sending');
    expect(failed.container.querySelector('.message-bubble')).toHaveClass('message-bubble--failed');
  });

  it('marks sent reply and quote bubbles for referenced-message layout', () => {
    const reply = renderBubble({
      kind: 'server',
      message: {
        id: 'm2',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:01.000Z',
        text: 'sent reply text',
        user: { id: 'me', username: 'me' },
        replyId: 'm1',
        reply: {
          id: 'm1',
          roomId: 'room-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          text: 'original',
          user: { id: 'user-1', username: 'alice', name: 'Alice' },
        },
      },
    });
    const quote = renderBubble({
      kind: 'server',
      message: {
        id: 'm3',
        roomId: 'room-1',
        createdAt: '2026-01-01T00:00:02.000Z',
        text: 'sent quote text',
        user: { id: 'me', username: 'me' },
        quoteId: 'm1',
        quote: {
          id: 'm1',
          roomId: 'room-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          text: 'quoted',
          user: { id: 'user-1', username: 'alice', name: 'Alice' },
        },
      },
    });

    expect(reply.container.querySelector('.message-bubble')).toHaveClass('message-bubble--referenced');
    expect(quote.container.querySelector('.message-bubble')).toHaveClass('message-bubble--referenced');
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
