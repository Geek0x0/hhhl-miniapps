import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import RoomInvitationList from './RoomInvitationList.vue';

function renderInvitations() {
  return render(RoomInvitationList, {
    props: {
      invitations: [
        {
          id: 'invitation-1',
          roomId: 'room-1',
          room: {
            id: 'room-1',
            name: 'General',
          },
        },
      ],
    },
  });
}

describe('RoomInvitationList', () => {
  it('renders invitations in a panel and emits accept and ignore actions', async () => {
    const { container, emitted } = renderInvitations();

    expect(container.querySelector('.room-section')).toHaveClass('room-panel');
    expect(container.querySelector('.room-invitation__main')).toHaveTextContent('General');
    expect(container.querySelector('.room-invitation__main')).toHaveTextContent('room-1');

    await fireEvent.click(screen.getByRole('button', { name: 'Join by room ID' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(emitted('accept')).toEqual([['invitation-1', 'room-1']]);
    expect(emitted('ignore')).toEqual([['invitation-1']]);
  });
});
