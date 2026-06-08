import { fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MessageActions from './MessageActions.vue';

const message = {
  id: 'm1',
  roomId: 'room-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  text: 'hello',
  user: { id: 'user-1', username: 'alice', name: 'Alice' },
};

describe('MessageActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('opens the reaction picker as a floating popover outside the message actions', async () => {
    const { container } = render(MessageActions, {
      props: {
        message,
        canDelete: false,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));

    const popover = document.body.querySelector('.reaction-picker-popover');
    const picker = screen.getByRole('dialog', { name: 'Reactions' });

    expect(popover).toContainElement(picker);
    expect(container.querySelector('.message-actions')).not.toContainElement(picker);
  });

  it('confirms before emitting delete', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { emitted } = render(MessageActions, {
      props: {
        message,
        canDelete: true,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));
    expect(emitted('delete')).toBeUndefined();

    await fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));
    expect(emitted('delete')).toEqual([['m1']]);
    expect(confirm).toHaveBeenCalledWith('Delete this message?');
  });

});
