import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomSummary } from '@/shared/types';
import ChatRoomView from './ChatRoomView.vue';

type MockRoomEntry = {
  room: RoomSummary;
  sources: string[];
};

const mocks = vi.hoisted(() => ({
  route: {
    params: { roomId: 'amlc1bekzi' } as Record<string, unknown>,
    query: {} as Record<string, unknown>,
  },
  router: {
    push: vi.fn(),
  },
  chatStore: {
    roomId: 'amlc1bekzi' as string | null,
    loading: false,
    error: null as string | null,
    timeline: [] as unknown[],
    olderLoading: false,
    hasMoreOlder: false,
    replyTarget: null,
    quoteTarget: null,
    searchQuery: null,
    searchUserId: null,
    searchResults: [] as unknown[],
    searchLoading: false,
    searchError: null,
    searchHasMore: false,
    keySearchResults: [] as unknown[],
    keySearchLoading: false,
    keySearchError: null,
    roomGeneration: 1,
    loadInitial: vi.fn(async (roomId: string) => {
      mocks.chatStore.roomId = roomId;
    }),
    searchKeyMessages: vi.fn(async () => undefined),
    searchMessages: vi.fn(async () => undefined),
    loadMoreSearchResults: vi.fn(async () => undefined),
    loadOlder: vi.fn(async () => undefined),
    loadNewer: vi.fn(async () => undefined),
    ensureMessageVisible: vi.fn(async () => true),
    setReplyTarget: vi.fn(),
    setQuoteTarget: vi.fn(),
    react: vi.fn(async () => undefined),
    deleteMessage: vi.fn(async () => undefined),
    retryMessage: vi.fn(async () => undefined),
    removeFailedMessage: vi.fn(),
    clearComposerContext: vi.fn(),
    sendText: vi.fn(async () => ({ ok: true, localId: 'local-1', serverId: 'server-1' })),
    sendFile: vi.fn(async () => ({ ok: true, localId: 'local-1', serverId: 'server-1' })),
    appendRealtimeMessages: vi.fn(),
    applyRealtimeDelete: vi.fn(),
    applyRealtimeReaction: vi.fn(),
  },
  roomStore: {
    rooms: [{ room: { id: 'amlc1bekzi', name: 'Key Room' }, sources: ['joined'] }] as MockRoomEntry[],
    membersByRoomId: {} as Record<string, unknown[]>,
    membersLoadingByRoomId: {} as Record<string, boolean>,
    membersHasMoreByRoomId: {} as Record<string, boolean>,
    userMutesByRoomId: {} as Record<string, unknown[]>,
    userMutesLoadingByRoomId: {} as Record<string, boolean>,
    error: null as string | null,
    ensureRoomVisible: vi.fn(async () => undefined),
    loadMembers: vi.fn(async () => undefined),
    loadAllMembers: vi.fn(async () => undefined),
    loadMoreMembers: vi.fn(async () => undefined),
    loadUserMutes: vi.fn(async () => undefined),
    muteUser: vi.fn(async () => undefined),
    updateRoom: vi.fn(async () => undefined),
    muteRoom: vi.fn(async () => undefined),
    leaveRoom: vi.fn(async () => undefined),
    deleteRoom: vi.fn(async () => undefined),
    createInvitation: vi.fn(async () => undefined),
  },
  realtimeStore: {
    status: 'connected',
    stopRoom: vi.fn(),
    startRoom: vi.fn(),
    markDegraded: vi.fn(),
  },
  authStore: {
    user: { id: 'user-1', username: 'alice', name: 'Alice' },
  },
  settingsStore: {
    favoriteUserIds: [] as string[],
    toggleFavoriteUser: vi.fn(),
  },
  draftsByRoomId: {} as Record<string, string>,
  draftListeners: [] as Array<(change: { roomId: string; text: string }) => void>,
  deliverKeySearchResultToBot: vi.fn(async () => true),
}));

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));

vi.mock('@/chat/chatStore', () => ({
  useChatStore: () => mocks.chatStore,
}));

vi.mock('@/rooms/roomStore', () => ({
  useRoomStore: () => mocks.roomStore,
}));

vi.mock('@/realtime/realtimeStore', () => ({
  useRealtimeStore: () => mocks.realtimeStore,
}));

vi.mock('@/auth/authStore', () => ({
  useAuthStore: () => mocks.authStore,
}));

vi.mock('@/settings/settingsStore', () => ({
  useSettingsStore: () => mocks.settingsStore,
}));

vi.mock('@/api/apiClient', () => ({
  ApiClient: class {},
}));

vi.mock('@/chat/chatApi', () => ({
  createChatApi: () => ({}),
}));

vi.mock('@/realtime/realtimeClient', () => ({
  createRealtimeClient: () => ({
    connect: vi.fn(),
    subscribeRoom: vi.fn(),
    unsubscribeRoom: vi.fn(),
    disconnect: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    onOpen: vi.fn(() => () => {}),
    onSocketFailure: vi.fn(() => () => {}),
  }),
}));

vi.mock('@/realtime/pollingFallback', () => ({
  createPollingFallback: () => ({}),
}));

vi.mock('@/users/userApi', () => ({
  createUserApi: () => ({ show: vi.fn(async () => []) }),
}));

vi.mock('@/chat/drafts', () => {
  const notify = (roomId: string, text: string) => {
    for (const listener of mocks.draftListeners) {
      listener({ roomId, text });
    }
  };

  return {
    readRoomDraft: vi.fn((_storage, roomId: string) => mocks.draftsByRoomId[roomId] ?? ''),
    saveRoomDraft: vi.fn((_storage, roomId: string, text: string) => {
      if (text === '') {
        delete mocks.draftsByRoomId[roomId];
      } else {
        mocks.draftsByRoomId[roomId] = text;
      }
      notify(roomId, text);
    }),
    clearRoomDraft: vi.fn((_storage, roomId: string) => {
      delete mocks.draftsByRoomId[roomId];
      notify(roomId, '');
    }),
    addRoomDraftChangeListener: vi.fn((listener: (change: { roomId: string; text: string }) => void) => {
      mocks.draftListeners.push(listener);
      return () => {
        mocks.draftListeners = mocks.draftListeners.filter((item) => item !== listener);
      };
    }),
  };
});

vi.mock('@/bot/keyDelivery', () => ({
  deliverKeySearchResultToBot: mocks.deliverKeySearchResultToBot,
}));

vi.mock('@/chat/components/ChatHeader.vue', () => ({
  default: {
    props: ['connectionStatus', 'hasAnnouncement'],
    emits: ['announcement'],
    template: `
      <header data-testid="chat-header">
        {{ connectionStatus }}
        <button
          v-if="hasAnnouncement"
          type="button"
          aria-label="Room announcement"
          @click="$emit('announcement')"
        >
          Announcement
        </button>
      </header>
    `,
  },
}));
vi.mock('@/chat/components/SearchPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/KeySearchPanel.vue', () => ({ default: { template: '<section data-testid="key-search-panel" />' } }));
vi.mock('@/chat/components/MembersPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/FavoritePanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/BlockedUsersPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/rooms/components/RoomManagementPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/MessageTimeline.vue', () => ({
  default: {
    props: ['loading'],
    template: '<section data-testid="message-timeline" :data-loading="String(loading)" />',
  },
}));
vi.mock('@/chat/components/MessageComposer.vue', () => ({
  default: {
    props: ['draftText'],
    emits: ['send', 'draft-change'],
    template: `
      <form>
        <textarea
          aria-label="Message input"
          placeholder="Message"
          :value="draftText"
          @input="$emit('draft-change', $event.target.value)"
        />
        <button type="button" @click="$emit('send', draftText)">Send</button>
      </form>
    `,
  },
}));

describe('ChatRoomView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.params = { roomId: 'amlc1bekzi' };
    mocks.route.query = {};
    mocks.chatStore.roomId = 'amlc1bekzi';
    mocks.chatStore.loading = false;
    mocks.chatStore.timeline = [];
    mocks.chatStore.keySearchResults = [];
    mocks.roomStore.rooms = [{ room: { id: 'amlc1bekzi', name: 'Key Room' }, sources: ['joined'] }];
    mocks.draftsByRoomId = {};
    mocks.draftListeners = [];
  });

  it('passes initial timeline loading state into the message timeline', () => {
    mocks.chatStore.loading = true;

    render(ChatRoomView);

    expect(screen.getByTestId('message-timeline')).toHaveAttribute('data-loading', 'true');
  });

  it('shows the button announcement panel on room entry and auto dismisses after five seconds', async () => {
    vi.useFakeTimers();
    mocks.roomStore.rooms = [{ room: { id: 'amlc1bekzi', name: 'Key Room', announcement: 'Pinned room notice' }, sources: ['joined'] }];

    try {
      render(ChatRoomView);
      await Promise.resolve();
      await Promise.resolve();

      const panel = screen.getByRole('region', { name: 'Room announcement' });
      expect(panel).toHaveTextContent('群公告：');
      expect(panel).toHaveTextContent('Pinned room notice');
      expect(screen.queryByRole('status', { name: 'Room announcement' })).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(4999);
      expect(screen.getByRole('region', { name: 'Room announcement' })).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(1);
      expect(screen.queryByRole('region', { name: 'Room announcement' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggles persistent room announcement content from the header action', async () => {
    mocks.roomStore.rooms = [{ room: { id: 'amlc1bekzi', name: 'Key Room', announcement: 'Pinned room notice' }, sources: ['joined'] }];

    render(ChatRoomView);
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByRole('region', { name: 'Room announcement' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Room announcement' }));

    expect(screen.queryByRole('region', { name: 'Room announcement' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Room announcement' }));

    const panel = screen.getByRole('region', { name: 'Room announcement' });
    expect(panel).toHaveTextContent('群公告：');
    expect(panel).toHaveTextContent('Pinned room notice');
  });

  it('opens key search automatically for bot get-key Mini App launches', async () => {
    mocks.route.query = { autoKeySearch: '1' };

    render(ChatRoomView);

    await waitFor(() => {
      expect(mocks.chatStore.searchKeyMessages).toHaveBeenCalledTimes(1);
    });
  });

  it('delivers the latest key search result to the bot for bot send launches', async () => {
    const keyMessage = {
      id: 'key-1',
      roomId: 'amlc1bekzi',
      createdAt: '2026-06-08T00:00:00.000Z',
      text: 'sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd',
      user: { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' },
    };
    mocks.route.query = { autoKeySearch: 'sendToBot' };
    mocks.chatStore.searchKeyMessages.mockImplementationOnce(async () => {
      mocks.chatStore.keySearchResults = [keyMessage];
    });

    render(ChatRoomView);

    await waitFor(() => {
      expect(mocks.deliverKeySearchResultToBot).toHaveBeenCalledWith({
        roomId: 'amlc1bekzi',
        message: keyMessage,
      });
    });
  });

  it('syncs same-page draft changes into the visible composer', async () => {
    mocks.draftsByRoomId.amlc1bekzi = 'pending draft';

    render(ChatRoomView);

    const input = screen.getByPlaceholderText('Message') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(input.value).toBe('pending draft');
    });

    for (const listener of mocks.draftListeners) {
      listener({ roomId: 'amlc1bekzi', text: '' });
    }

    await waitFor(() => {
      expect(input.value).toBe('');
    });

    await fireEvent.update(input, 'new local draft');

    expect(mocks.draftsByRoomId.amlc1bekzi).toBe('new local draft');
  });

  it('keeps newer same-page draft changes when a submitted send finishes', async () => {
    let resolveSend: (result: { ok: true; localId: string; serverId: string }) => void = () => {
      throw new Error('send resolver was not set');
    };
    mocks.draftsByRoomId.amlc1bekzi = 'submitted draft';
    mocks.chatStore.sendText.mockImplementationOnce(async () => new Promise((resolve) => {
      resolveSend = resolve;
    }));

    render(ChatRoomView);

    const input = screen.getByPlaceholderText('Message') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(input.value).toBe('submitted draft');
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(mocks.chatStore.sendText).toHaveBeenCalledWith('submitted draft');
    });
    const sendPromise = mocks.chatStore.sendText.mock.results[0]?.value as Promise<unknown>;

    mocks.draftsByRoomId.amlc1bekzi = 'newer external draft';
    for (const listener of mocks.draftListeners) {
      listener({ roomId: 'amlc1bekzi', text: 'newer external draft' });
    }

    await waitFor(() => {
      expect(input.value).toBe('newer external draft');
    });

    resolveSend({ ok: true, localId: 'local-1', serverId: 'server-1' });
    await sendPromise;
    await Promise.resolve();
    await Promise.resolve();

    await waitFor(() => {
      expect(input.value).toBe('newer external draft');
    });
    expect(mocks.draftsByRoomId.amlc1bekzi).toBe('newer external draft');
  });

  it('polls newer messages every second without starting websocket realtime', async () => {
    vi.useFakeTimers();

    try {
      const { unmount } = render(ChatRoomView);
      await Promise.resolve();
      await Promise.resolve();

      expect(screen.getByTestId('chat-header')).toHaveTextContent('degraded');
      expect(mocks.realtimeStore.startRoom).not.toHaveBeenCalled();
      expect(mocks.chatStore.loadNewer).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);

      expect(mocks.chatStore.loadNewer).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);

      expect(mocks.chatStore.loadNewer).toHaveBeenCalledTimes(2);

      unmount();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mocks.chatStore.loadNewer).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
