import { fireEvent, render, screen } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoomListView from './RoomListView.vue';

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  roomStore: {
    loading: false,
    error: null,
    rooms: [],
    invitations: [],
    pendingStartRoomId: null,
    activeRoomId: null,
    acceptInvitation: vi.fn(async () => undefined),
    clearRoomError: vi.fn(),
    createRoom: vi.fn(async () => undefined),
    ignoreInvitation: vi.fn(async () => undefined),
    joinRoomById: vi.fn(async () => undefined),
    loadRooms: vi.fn(async () => undefined),
    preserveStartTarget: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/telegram/telegram', () => ({
  getTelegramLaunchContext: () => ({
    platform: 'unknown',
    startParam: { type: 'none' },
    themeParams: {},
  }),
}));

vi.mock('../roomStore', () => ({
  useRoomStore: () => mocks.roomStore,
}));

describe('RoomListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roomStore.loading = false;
    mocks.roomStore.error = null;
    mocks.roomStore.rooms = [];
    mocks.roomStore.invitations = [];
    mocks.roomStore.pendingStartRoomId = null;
    mocks.roomStore.activeRoomId = null;
  });

  it('renders the HHHL logo aligned with the rooms title in the left header', () => {
    const { container } = render(RoomListView);

    const logo = screen.getByRole('img', { name: 'HHHL Logo' });
    const title = screen.getByRole('heading', { level: 1, name: 'Rooms' });
    const headline = container.querySelector('.rooms-header__headline');

    expect(logo).toHaveAttribute('src', 'https://dc.hhhl.cc/client-assets/icon.png');
    expect(logo).toHaveAttribute('width', '45');
    expect(logo).toHaveAttribute('height', '45');
    expect(logo).toHaveClass('rooms-header__logo');
    expect(headline).toContainElement(logo);
    expect(headline).toContainElement(title);
  });

  it('renders three room card skeletons while loading without rendering the empty state', () => {
    mocks.roomStore.loading = true;

    const { container } = render(RoomListView);

    expect(container.querySelector('.room-list-skeleton')).toHaveAccessibleName('Loading...');
    expect(container.querySelector('.room-list-skeleton')).toHaveAttribute('role', 'status');
    expect(container.querySelectorAll('.room-list-skeleton .room-card-skeleton')).toHaveLength(3);
    expect(container.querySelector('.rooms-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
  });

  it('renders a friendly empty state when no rooms are available', () => {
    const { container } = render(RoomListView);

    const emptyState = container.querySelector('.rooms-empty-state');

    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveClass('ui-empty-state');
    expect(emptyState).toHaveTextContent('No messages yet');
    expect(emptyState).toHaveTextContent('Join by room ID');
  });

  it('trims room invitation ids before accepting invitations', async () => {
    mocks.roomStore.invitations = [
      {
        id: 'invitation-1',
        roomId: '  room-1  ',
      },
    ];

    render(RoomListView);

    await fireEvent.click(screen.getAllByRole('button', { name: 'Join by room ID' })[1]);

    expect(mocks.roomStore.acceptInvitation).toHaveBeenCalledWith('invitation-1', 'room-1');
  });
});
