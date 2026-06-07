import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import ChatHeader from './ChatHeader.vue';

function renderHeader(props: Partial<InstanceType<typeof ChatHeader>['$props']> = {}) {
  return render(ChatHeader, {
    props: {
      roomId: 'room-1',
      title: 'Room 1',
      degraded: false,
      ...props,
    },
  });
}

describe('ChatHeader', () => {
  it('hides room management when the active user cannot manage the room', async () => {
    renderHeader();

    await fireEvent.click(screen.getByRole('button', { name: 'More room actions' }));

    expect(screen.getByRole('menuitem', { name: 'Favorites' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Search keys' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Manage room' })).not.toBeInTheDocument();
  });

  it('shows room management and emits manage when the active user can manage the room', async () => {
    const { emitted } = renderHeader({ canManageRoom: true });

    await fireEvent.click(screen.getByRole('button', { name: 'More room actions' }));
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Manage room' }));

    expect(emitted('manage')).toEqual([[]]);
  });
});
