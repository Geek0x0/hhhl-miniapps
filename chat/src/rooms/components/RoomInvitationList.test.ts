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

  it('emits normalized room ids when accepting valid invitations', async () => {
    const { emitted } = render(RoomInvitationList, {
      props: {
        invitations: [
          {
            id: 'invitation-1',
            roomId: '  room-1  ',
          },
        ],
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Join by room ID' }));

    expect(emitted('accept')).toEqual([['invitation-1', 'room-1']]);
  });

  it('disables accept and still emits ignore for invitations without a valid room id', async () => {
    const { container, emitted } = render(RoomInvitationList, {
      props: {
        invitations: [
          {
            id: 'malformed-invitation',
          },
          {
            id: 'whitespace-room-id-invitation',
            roomId: '   ',
          },
          {
            id: 'empty-room-id-invitation',
            room: { id: '', name: 'General' },
          },
        ],
      },
    });

    expect(container.querySelector('.room-invitation__main')).toHaveTextContent('malformed-invitation');

    const acceptButtons = screen.getAllByRole('button', { name: 'Join by room ID' });
    expect(acceptButtons).toHaveLength(3);
    acceptButtons.forEach((acceptButton) => {
      expect(acceptButton).toBeDisabled();
    });

    for (const acceptButton of acceptButtons) {
      await fireEvent.click(acceptButton);
    }
    await fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]);

    expect(emitted('accept')).toBeUndefined();
    expect(emitted('ignore')).toEqual([['malformed-invitation']]);
  });
});
