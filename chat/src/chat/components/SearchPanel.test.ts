import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/shared/types';
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

function renderSearchPanel(props: Partial<InstanceType<typeof SearchPanel>['$props']> = {}) {
  return render(SearchPanel, {
    props: {
      query: 'hello',
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
});
