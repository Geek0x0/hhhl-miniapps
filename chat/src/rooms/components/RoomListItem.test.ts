import { render, screen, within } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import RoomListItem from './RoomListItem.vue';
import type { MergedRoom } from '../roomMerge';

function renderItem(entry: MergedRoom) {
  return render(RoomListItem, {
    props: { entry },
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });
}

describe('RoomListItem', () => {
  it('renders description and room id inside metadata', () => {
    const { container } = renderItem({
      room: {
        id: 'room-1',
        name: 'General',
        description: 'Project coordination',
      },
      sources: ['joined'],
    });

    expect(screen.getByRole('link')).toHaveAttribute('href', '/rooms/room-1');
    expect(screen.getByText('General')).toBeInTheDocument();

    const metadata = container.querySelector('.room-list-item__meta');

    expect(metadata).toBeInTheDocument();
    expect(metadata).toHaveTextContent('Project coordination');
    expect(within(metadata as HTMLElement).getByText('room-1')).toHaveClass('room-list-item__id');
  });

  it('falls back to the room id when description is missing', () => {
    const { container } = renderItem({
      room: {
        id: 'room-fallback',
        name: 'Fallback Room',
      },
      sources: ['manual'],
    });

    const metadata = container.querySelector('.room-list-item__meta');

    expect(metadata).toHaveTextContent('room-fallback');
    expect(metadata?.textContent?.match(/room-fallback/g)).toHaveLength(1);
    expect(container.querySelector('.room-list-item__id')).toHaveTextContent('room-fallback');
  });

  it('renders visible source badges and hides the deep-link source', () => {
    const { container } = renderItem({
      room: {
        id: 'room-2',
        name: 'Multi-source',
        description: 'Combined entry',
      },
      sources: ['deep-link', 'invited', 'joined', 'manual', 'owned'],
    });

    const badges = container.querySelector('.room-list-item__badges');

    expect(badges).toBeInTheDocument();
    expect(within(badges as HTMLElement).getByText('Invited')).toBeInTheDocument();
    expect(within(badges as HTMLElement).getByText('Joined')).toBeInTheDocument();
    expect(within(badges as HTMLElement).getByText('Joined manually')).toBeInTheDocument();
    expect(within(badges as HTMLElement).getByText('Owner')).toBeInTheDocument();
    expect(screen.queryByText('deep-link')).not.toBeInTheDocument();
  });
});
