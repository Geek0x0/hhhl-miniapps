import { fireEvent, render } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import FavoritePanel from './FavoritePanel.vue';
import MembersPanel from './MembersPanel.vue';
import MessageComposer from './MessageComposer.vue';

const proxyAvatar = 'https://dc.hhhl.cc/proxy/avatar.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Falice.png&avatar=1';
const originalAvatar = 'https://dc.hhhl.cc/files/alice.png';

describe('avatar entrypoints', () => {
  it('keeps member avatar fallbacks on no-referrer without adding crossorigin', async () => {
    const { container } = render(MembersPanel, {
      props: {
        members: [{
          id: 'user-1',
          username: 'alice',
          name: 'Alice',
          avatarUrl: proxyAvatar,
          avatarFallbackUrl: originalAvatar,
        }],
        favoriteUserIds: [],
        loading: false,
        hasMore: false,
      },
    });
    const image = container.querySelector<HTMLImageElement>('.member-row__avatar');

    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');

    await fireEvent.error(image as HTMLImageElement);

    expect(image?.getAttribute('src')).toBe(originalAvatar);
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(image?.hasAttribute('crossorigin')).toBe(false);
  });

  it('keeps favorite avatars on no-referrer', () => {
    const { container } = render(FavoritePanel, {
      props: {
        members: [{ id: 'user-1', username: 'alice', name: 'Alice', avatarUrl: proxyAvatar }],
        favoriteUserIds: ['user-1'],
        loading: false,
      },
    });

    expect(container.querySelector<HTMLImageElement>('.member-row__avatar')?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('shows unresolved favorite count while favorite users are loading', () => {
    const { getByText } = render(FavoritePanel, {
      props: {
        members: [],
        favoriteUserIds: ['user-1', 'user-2'],
        loading: true,
      },
    });

    expect(getByText('Loading 2 favorite members...')).toBeInTheDocument();
  });

  it('shows unresolved favorite count while partial favorite users are loading', () => {
    const { getByText } = render(FavoritePanel, {
      props: {
        members: [{ id: 'user-1', username: 'alice', name: 'Alice', avatarUrl: proxyAvatar }],
        favoriteUserIds: ['user-1', 'user-2'],
        loading: true,
      },
    });

    expect(getByText('Alice')).toBeInTheDocument();
    expect(getByText('Loading 1 favorite members...')).toBeInTheDocument();
  });

  it('keeps mention suggestion avatars on no-referrer', async () => {
    const { container, getByPlaceholderText } = render(MessageComposer, {
      props: {
        replyTarget: null,
        quoteTarget: null,
        mentionMembers: [{ id: 'user-1', username: 'alice', name: 'Alice', avatarUrl: proxyAvatar }],
      },
    });

    await fireEvent.update(getByPlaceholderText('Message'), '@a');

    expect(container.querySelector<HTMLImageElement>('.mention-suggestions__avatar')?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('falls back mention suggestion avatars to the original URL and then the initial', async () => {
    const { container, getByPlaceholderText } = render(MessageComposer, {
      props: {
        replyTarget: null,
        quoteTarget: null,
        mentionMembers: [{
          id: 'user-1',
          username: 'alice',
          name: 'Alice',
          avatarUrl: proxyAvatar,
          avatarFallbackUrl: originalAvatar,
        }],
      },
    });

    await fireEvent.update(getByPlaceholderText('Message'), '@a');

    const image = container.querySelector<HTMLImageElement>('.mention-suggestions__avatar');
    await fireEvent.error(image as HTMLImageElement);

    expect(image?.getAttribute('src')).toBe(originalAvatar);
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(image?.hasAttribute('crossorigin')).toBe(false);

    await fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector('.mention-suggestions__avatar--fallback')).not.toBeNull();
  });

  it('renders mention suggestion avatars when only a fallback URL is available', async () => {
    const { container, getByPlaceholderText } = render(MessageComposer, {
      props: {
        replyTarget: null,
        quoteTarget: null,
        mentionMembers: [{
          id: 'user-1',
          username: 'alice',
          name: 'Alice',
          avatarUrl: null,
          avatarFallbackUrl: originalAvatar,
        }],
      },
    });

    await fireEvent.update(getByPlaceholderText('Message'), '@a');

    expect(container.querySelector<HTMLImageElement>('.mention-suggestions__avatar')?.getAttribute('src')).toBe(originalAvatar);
  });
});
