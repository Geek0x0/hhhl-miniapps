import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import ChatHeader from './ChatHeader.vue';

function renderHeader(props: Partial<InstanceType<typeof ChatHeader>['$props']> = {}) {
  return render(ChatHeader, {
    props: {
      roomId: 'room-1',
      title: 'Room 1',
      connectionStatus: 'connected',
      ...props,
    },
  });
}

describe('ChatHeader', () => {
  it('renders connection status as a labelled status badge', () => {
    render(ChatHeader, {
      props: {
        roomId: 'room-1',
        title: 'General',
        connectionStatus: 'degraded',
        canManageRoom: true,
      },
    });

    const badge = screen.getByRole('status', { name: 'HTTP pull' });
    expect(badge).toHaveClass('chat-header__status--degraded');
    expect(badge).toHaveAttribute('aria-live', 'polite');
    expect(badge).toHaveAttribute('data-status', 'degraded');
    expect(badge).toHaveTextContent('HP');
    expect(screen.queryByRole('button', { name: 'HTTP pull' })).not.toBeInTheDocument();
  });

  it('shows websocket or HTTP pull transport status in the room header', async () => {
    const { container, rerender } = renderHeader();
    const actions = container.querySelector('.chat-header__actions');

    expect(screen.getByText('WS')).toBeInTheDocument();
    expect(actions?.lastElementChild).toHaveTextContent('WS');
    expect(actions?.lastElementChild).toHaveClass('chat-icon-button');
    expect(actions?.lastElementChild).toHaveClass('chat-header__status--accent');
    expect(actions?.lastElementChild).toHaveClass('chat-header__status--breathing');

    await rerender({ connectionStatus: 'degraded' });

    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(actions?.lastElementChild).toHaveTextContent('HP');
    expect(actions?.lastElementChild).toHaveClass('chat-header__status--degraded');
    expect(actions?.lastElementChild).toHaveClass('chat-header__status--breathing');
    expect(actions?.lastElementChild).toHaveStyle({ '--chat-status-breathe-duration': '1000ms' });

    await rerender({ connectionStatus: 'idle' });

    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(actions?.lastElementChild).toHaveTextContent('HP');
    expect(actions?.lastElementChild).toHaveClass('chat-header__status--idle');
    expect(actions?.lastElementChild).toHaveClass('chat-header__status--breathing');
  });

  it('hides room management when the active user cannot manage the room', async () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Search keys' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'More room actions' }));

    expect(screen.getByRole('menuitem', { name: 'Favorites' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Search keys' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Block management' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Manage room' })).not.toBeInTheDocument();
  });

  it('emits key search from the outer action button and members from the more menu', async () => {
    const { emitted } = renderHeader();

    await fireEvent.click(screen.getByRole('button', { name: 'Search keys' }));
    expect(emitted('keySearch')).toEqual([[]]);

    await fireEvent.click(screen.getByRole('button', { name: 'More room actions' }));
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Members' }));
    expect(emitted('members')).toEqual([[]]);
  });

  it('shows room management and emits manage when the active user can manage the room', async () => {
    const { emitted } = renderHeader({ canManageRoom: true });

    await fireEvent.click(screen.getByRole('button', { name: 'More room actions' }));
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Manage room' }));

    expect(emitted('manage')).toEqual([[]]);
  });

  it('emits block management from the more menu', async () => {
    const { emitted } = renderHeader();

    await fireEvent.click(screen.getByRole('button', { name: 'More room actions' }));
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Block management' }));

    expect(emitted('blockManage')).toEqual([[]]);
  });
});
