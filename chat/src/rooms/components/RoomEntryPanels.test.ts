import { fireEvent, render, screen, within } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import RoomCreateDialog from './RoomCreateDialog.vue';
import RoomDirectJoin from './RoomDirectJoin.vue';

describe('room entry panels', () => {
  it('keeps direct room joining collapsed until opened', async () => {
    const { container, emitted } = render(RoomDirectJoin);

    const panel = container.querySelector('.room-direct-join-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Join by room ID' })).not.toBeInTheDocument();

    await fireEvent.click(within(panel as HTMLElement).getByRole('button', { name: 'Join by room ID' }));

    const input = screen.getByRole('textbox', { name: 'Join by room ID' });
    await fireEvent.update(input, '  room-1  ');
    await fireEvent.click(within(panel as HTMLElement).getAllByRole('button', { name: 'Join by room ID' })[1]);

    expect(emitted('join')).toEqual([['room-1']]);
  });

  it('keeps room creation collapsed until opened', async () => {
    const { container, emitted } = render(RoomCreateDialog);

    const panel = container.querySelector('.room-create-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Room name' })).not.toBeInTheDocument();

    await fireEvent.click(within(panel as HTMLElement).getByRole('button', { name: 'Create room' }));

    await fireEvent.update(screen.getByRole('textbox', { name: 'Room name' }), '  General  ');
    await fireEvent.update(screen.getByRole('textbox', { name: 'Room description' }), '  Team chat  ');
    await fireEvent.update(screen.getByRole('combobox', { name: 'Join mode' }), 'invite');
    await fireEvent.click(within(panel as HTMLElement).getAllByRole('button', { name: 'Create room' })[1]);

    expect(emitted('create')).toEqual([[
      {
        name: 'General',
        description: 'Team chat',
        joinMode: 'invite',
      },
    ]]);
  });

});
