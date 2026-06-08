import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import BlockedUsersPanel from './BlockedUsersPanel.vue';

describe('BlockedUsersPanel', () => {
  it('shows blocked users from the room mute list', () => {
    render(BlockedUsersPanel, {
      props: {
        members: [{ id: 'user-1', username: 'alice', name: 'Alice' }],
        loading: false,
      },
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('shows unresolved blocked users while loading', () => {
    render(BlockedUsersPanel, {
      props: {
        members: [],
        loading: true,
      },
    });

    expect(screen.getByText('Loading muted users...')).toBeInTheDocument();
  });
});
