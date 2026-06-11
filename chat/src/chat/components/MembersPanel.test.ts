import { render } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import MembersPanel from './MembersPanel.vue';

const members = [
  { id: 'user-1', username: 'alice', name: 'Alice' },
  { id: 'user-2', username: 'bob', name: 'Bob' },
];

describe('MembersPanel', () => {
  it('marks the scrollable member list for bottom safe spacing', () => {
    const { container } = render(MembersPanel, {
      props: {
        members,
        favoriteUserIds: [],
        loading: false,
        hasMore: false,
      },
    });

    const list = container.querySelector('.side-panel__list--scrollable');

    expect(list).toHaveClass('members-panel__list');
    expect(container.querySelectorAll('.member-row')).toHaveLength(2);
  });
});
