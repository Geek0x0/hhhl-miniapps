import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import type { ChatMessage, UserSummary } from '@/shared/types';
import SearchPanel from './SearchPanel.vue';

function message(id: string, text: string): ChatMessage {
  return {
    id,
    roomId: 'room-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    text,
    user: { id: 'user-1', username: 'alice', name: 'Alice' },
  };
}

const members: UserSummary[] = [
  { id: 'user-1', username: 'alice', name: 'Alice', avatarUrl: 'https://example.com/alice.png' },
  { id: 'user-2', username: 'bob', name: 'Bob' },
];

function renderSearchPanel(props: Partial<InstanceType<typeof SearchPanel>['$props']> = {}) {
  return render(SearchPanel, {
    props: {
      query: 'hello',
      selectedUserId: null,
      members,
      results: [message('m1', 'hello there')],
      loading: false,
      error: null,
      hasMore: true,
      ...props,
    },
  });
}

describe('SearchPanel', () => {
  it('keeps result highlighting and load-more availability tied to the submitted query', async () => {
    renderSearchPanel();

    expect(screen.getByText('hello').tagName).toBe('MARK');
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();

    await fireEvent.update(screen.getByRole('textbox', { name: 'Search messages' }), 'bye');

    expect(screen.getByText('hello').tagName).toBe('MARK');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('emits selected member searches and allows member-only searches', async () => {
    const { container, emitted } = renderSearchPanel({
      query: '',
      results: [],
      hasMore: false,
    });

    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).toBeDisabled();

    await fireEvent.click(screen.getByRole('combobox', { name: 'Search member' }));
    expect(container.querySelector('img.member-picker__avatar')?.getAttribute('src')).toBe('https://example.com/alice.png');

    await fireEvent.update(screen.getByRole('searchbox', { name: 'Search members' }), 'bo');
    expect(screen.queryByRole('option', { name: /Alice/ })).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('option', { name: /Bob.*@bob/ }));
    expect(searchButton).toBeEnabled();

    await fireEvent.click(searchButton);
    expect(emitted('search')).toEqual([[{ query: '', userId: 'user-2' }]]);

    await fireEvent.update(screen.getByRole('textbox', { name: 'Search messages' }), 'hello');
    await fireEvent.click(searchButton);
    expect(emitted('search')?.at(-1)).toEqual([{ query: 'hello', userId: 'user-2' }]);
  });
});
