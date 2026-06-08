import { render, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatRoomView from './ChatRoomView.vue';

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
    rooms: [{ room: { id: 'amlc1bekzi', name: 'Key Room' }, sources: ['joined'] }],
    membersByRoomId: {} as Record<string, unknown[]>,
    membersLoadingByRoomId: {} as Record<string, boolean>,
    membersHasMoreByRoomId: {} as Record<string, boolean>,
    userMutesByRoomId: {} as Record<string, unknown[]>,
    userMutesLoadingByRoomId: {} as Record<string, boolean>,
    error: null as string | null,
    ensureRoomVisible: vi.fn(async () => undefined),
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
  createRealtimeClient: () => ({}),
}));

vi.mock('@/realtime/pollingFallback', () => ({
  createPollingFallback: () => ({}),
}));

vi.mock('@/users/userApi', () => ({
  createUserApi: () => ({ show: vi.fn(async () => []) }),
}));

vi.mock('@/chat/drafts', () => ({
  readRoomDraft: () => '',
  saveRoomDraft: vi.fn(),
  clearRoomDraft: vi.fn(),
}));

vi.mock('@/bot/keyDelivery', () => ({
  deliverKeySearchResultToBot: mocks.deliverKeySearchResultToBot,
}));

vi.mock('@/chat/components/ChatHeader.vue', () => ({
  default: { template: '<header data-testid="chat-header" />' },
}));
vi.mock('@/chat/components/SearchPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/KeySearchPanel.vue', () => ({ default: { template: '<section data-testid="key-search-panel" />' } }));
vi.mock('@/chat/components/MembersPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/FavoritePanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/BlockedUsersPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/rooms/components/RoomManagementPanel.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/MessageTimeline.vue', () => ({ default: { template: '<section />' } }));
vi.mock('@/chat/components/MessageComposer.vue', () => ({ default: { template: '<form />' } }));

describe('ChatRoomView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.params = { roomId: 'amlc1bekzi' };
    mocks.route.query = {};
    mocks.chatStore.roomId = 'amlc1bekzi';
    mocks.chatStore.keySearchResults = [];
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
});
