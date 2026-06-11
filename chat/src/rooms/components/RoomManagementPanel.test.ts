import { fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RoomManagementPanel from './RoomManagementPanel.vue';

describe('RoomManagementPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders details, collaboration, and danger zone sections', () => {
    const { container } = render(RoomManagementPanel, {
      props: {
        roomId: 'room-1',
        error: 'Unable to update room',
      },
    });

    expect(container.querySelector('.room-management__details')).toBeInTheDocument();
    expect(container.querySelector('.room-management__collaboration')).toBeInTheDocument();
    expect(container.querySelector('.room-management__danger-zone.ui-notice--error')).toBeInTheDocument();
  });

  it('confirms leave and delete before emitting destructive actions', async () => {
    const confirm = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { emitted } = render(RoomManagementPanel, {
      props: {
        roomId: 'room-1',
        error: null,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(emitted('leave')).toBeUndefined();

    await fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(emitted('leave')).toEqual([[]]);

    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(emitted('delete')).toBeUndefined();

    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(emitted('delete')).toEqual([[]]);

    expect(confirm).toHaveBeenNthCalledWith(1, 'Leave this room?');
    expect(confirm).toHaveBeenNthCalledWith(2, 'Leave this room?');
    expect(confirm).toHaveBeenNthCalledWith(3, 'Delete this room?');
    expect(confirm).toHaveBeenNthCalledWith(4, 'Delete this room?');
  });
});
