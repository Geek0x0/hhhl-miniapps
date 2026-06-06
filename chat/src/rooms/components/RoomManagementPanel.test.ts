import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import RoomManagementPanel from './RoomManagementPanel.vue';

describe('RoomManagementPanel', () => {
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
    await fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(emitted('leave')).toEqual([[]]);
    expect(emitted('delete')).toEqual([[]]);
    expect(confirm).toHaveBeenCalledWith('Leave this room?');
    expect(confirm).toHaveBeenCalledWith('Delete this room?');
  });
});
