import { fireEvent, render, screen } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsView from './SettingsView.vue';

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  route: {
    name: 'settings' as string | null,
    path: '/settings',
  },
  auth: {
    status: 'authorized',
    user: null as { id: string; username?: string; name?: string } | null,
    error: null as string | null,
  },
  settings: {
    language: 'en',
    themeMode: 'system',
    favoriteUserIds: [],
    debugOpen: false,
    diagnostics: '',
    safeDiagnostics: '',
    detailedDiagnostics: '',
    diagnosticsDetailConfirmed: false,
    lastAction: null as string | null,
    syncStatus: 'synced',
    syncError: null as string | null,
    lastSyncedAt: '2026-06-05T03:00:00.000Z',
    init: vi.fn(),
    setLanguage: vi.fn(),
    setThemeMode: vi.fn(),
    clearLocalData: vi.fn(),
    toggleDebug: vi.fn(),
    collectDiagnostics: vi.fn(),
    confirmDiagnosticsDetail: vi.fn(),
    logout: vi.fn(),
    saveToCloud: vi.fn(async () => undefined),
  },
  realtimeStore: {
    status: 'connected',
    roomId: null as string | null,
  },
  roomStore: {
    loading: false,
    rooms: [] as Array<{ room: { id: string; name: string } }>,
    invitations: [] as unknown[],
    activeRoomId: null as string | null,
    deepLinkedRoom: null as { id: string; name: string } | null,
    pendingStartRoomId: null as string | null,
    membersByRoomId: {} as Record<string, unknown[]>,
    outboxInvitations: [] as unknown[],
    error: null as string | null,
  },
  chatStore: {
    loading: false,
    roomId: null as string | null,
    timeline: [] as unknown[],
    outgoing: [] as Array<{ status: string }>,
    searchResults: [] as unknown[],
    keySearchResults: [] as unknown[],
    replyTarget: null as unknown,
    quoteTarget: null as unknown,
    error: null as string | null,
    searchError: null as string | null,
    keySearchError: null as string | null,
  },
  telegramLaunchContext: {
    platform: 'web',
  },
  telegramEnvironmentPresent: false,
}));

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
  useRoute: () => mocks.route,
}));

vi.mock('@/auth/authStore', () => ({
  createAuthDependencies: () => ({ storage: {} }),
  useAuthStore: () => mocks.auth,
}));

vi.mock('@/realtime/realtimeStore', () => ({
  useRealtimeStore: () => mocks.realtimeStore,
}));

vi.mock('@/rooms/roomStore', () => ({
  useRoomStore: () => mocks.roomStore,
}));

vi.mock('@/chat/chatStore', () => ({
  useChatStore: () => mocks.chatStore,
}));

vi.mock('@/telegram/telegram', () => ({
  getTelegramLaunchContext: () => mocks.telegramLaunchContext,
  isTelegramEnvironment: () => mocks.telegramEnvironmentPresent,
}));

vi.mock('../settingsStore', () => ({
  useSettingsStore: () => mocks.settings,
}));

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.language = 'en';
    mocks.settings.themeMode = 'system';
    mocks.settings.debugOpen = false;
    mocks.settings.diagnostics = '';
    mocks.settings.safeDiagnostics = '';
    mocks.settings.detailedDiagnostics = '';
    mocks.settings.diagnosticsDetailConfirmed = false;
    mocks.settings.lastAction = null;
    mocks.settings.syncStatus = 'synced';
    mocks.settings.syncError = null;
    mocks.settings.lastSyncedAt = '2026-06-05T03:00:00.000Z';
    mocks.settings.toggleDebug.mockImplementation(() => {
      mocks.settings.debugOpen = !mocks.settings.debugOpen;
    });
    mocks.route.name = 'settings';
    mocks.route.path = '/settings';
    mocks.auth.status = 'authorized';
    mocks.auth.user = null;
    mocks.auth.error = null;
    mocks.realtimeStore.status = 'connected';
    mocks.realtimeStore.roomId = null;
    mocks.roomStore.loading = false;
    mocks.roomStore.rooms = [];
    mocks.roomStore.invitations = [];
    mocks.roomStore.activeRoomId = null;
    mocks.roomStore.deepLinkedRoom = null;
    mocks.roomStore.pendingStartRoomId = null;
    mocks.roomStore.membersByRoomId = {};
    mocks.roomStore.outboxInvitations = [];
    mocks.roomStore.error = null;
    mocks.chatStore.loading = false;
    mocks.chatStore.roomId = null;
    mocks.chatStore.timeline = [];
    mocks.chatStore.outgoing = [];
    mocks.chatStore.searchResults = [];
    mocks.chatStore.keySearchResults = [];
    mocks.chatStore.replyTarget = null;
    mocks.chatStore.quoteTarget = null;
    mocks.chatStore.error = null;
    mocks.chatStore.searchError = null;
    mocks.chatStore.keySearchError = null;
    mocks.telegramLaunchContext.platform = 'web';
    mocks.telegramEnvironmentPresent = false;
  });

  it('renders Drive sync status and manual save action', async () => {
    render(SettingsView);

    expect(screen.getByText('Drive sync')).toBeInTheDocument();
    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(screen.getByText('Last synced: 2026-06-05T03:00:00.000Z')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Save to Drive' }));

    expect(mocks.settings.saveToCloud).toHaveBeenCalledTimes(1);
  });

  it('renders redacted sync error', () => {
    mocks.settings.syncStatus = 'failed';
    mocks.settings.syncError = 'token=[redacted]';

    render(SettingsView);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sync error: token=[redacted]');
  });

  it('disables manual save while saving', () => {
    mocks.settings.syncStatus = 'saving';

    render(SettingsView);

    expect(screen.getByRole('button', { name: 'Save to Drive' })).toBeDisabled();
  });

  it('groups footer actions in a settings action layout', () => {
    render(SettingsView);

    const saveButton = screen.getByRole('button', { name: 'Save to Drive' });
    const actions = saveButton.closest('.settings-actions');

    expect(actions).not.toBeNull();
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Clear local data' }));
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Diagnostics' }));
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Log out' }));
  });

  it('collects rich diagnostics context when diagnostics open', async () => {
    mocks.route.name = 'room';
    mocks.route.path = '/rooms/room-route';
    mocks.auth.user = { id: 'user-secret', username: 'alice', name: 'Alice' };
    mocks.auth.error = 'auth error';
    mocks.realtimeStore.status = 'connected';
    mocks.realtimeStore.roomId = 'room-realtime';
    mocks.roomStore.loading = false;
    mocks.roomStore.rooms = [
      { room: { id: 'room-active', name: 'Active Room' } },
      { room: { id: 'room-other', name: 'Other Room' } },
    ];
    mocks.roomStore.invitations = [{ id: 'invite-1' }, { id: 'invite-2' }];
    mocks.roomStore.activeRoomId = 'room-active';
    mocks.roomStore.deepLinkedRoom = { id: 'room-stale', name: 'Stale Deep Linked Room' };
    mocks.roomStore.pendingStartRoomId = 'room-pending';
    mocks.roomStore.membersByRoomId = {
      'room-active': [{ id: 'user-secret' }, { id: 'user-2' }],
    };
    mocks.roomStore.outboxInvitations = [{ id: 'outbox-1' }];
    mocks.roomStore.error = 'room error';
    mocks.chatStore.loading = true;
    mocks.chatStore.roomId = 'room-chat';
    mocks.chatStore.timeline = [{ id: 'message-1' }, { id: 'message-2' }, { id: 'message-3' }];
    mocks.chatStore.outgoing = [{ status: 'failed' }, { status: 'sending' }, { status: 'failed' }];
    mocks.chatStore.searchResults = [{ id: 'search-1' }];
    mocks.chatStore.keySearchResults = [{ id: 'key-1' }, { id: 'key-2' }];
    mocks.chatStore.replyTarget = { id: 'reply-1' };
    mocks.chatStore.quoteTarget = null;
    mocks.chatStore.error = 'chat error';
    mocks.chatStore.searchError = 'search error';
    mocks.chatStore.keySearchError = 'key search error';
    mocks.telegramLaunchContext.platform = 'ios';
    mocks.telegramEnvironmentPresent = true;

    render(SettingsView);

    await fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));

    expect(mocks.settings.collectDiagnostics).toHaveBeenCalledWith({
      environment: {
        appVersion: expect.any(String),
        mode: expect.any(String),
        isDev: expect.any(Boolean),
        instanceUrl: 'https://dc.hhhl.cc',
        telegramPresent: true,
        telegramPlatform: 'ios',
      },
      auth: {
        status: 'authorized',
        hasUser: true,
        userId: 'user-secret',
        username: 'alice',
        error: 'auth error',
      },
      route: {
        name: 'room',
        path: '/rooms/room-route',
      },
      realtime: {
        status: 'connected',
        roomId: 'room-realtime',
      },
      rooms: {
        loading: false,
        roomCount: 2,
        invitationCount: 2,
        activeRoomId: 'room-active',
        activeRoomName: 'Active Room',
        pendingStartRoomId: 'room-pending',
        memberCount: 2,
        outboxInvitationCount: 1,
        error: 'room error',
      },
      chat: {
        loading: true,
        roomId: 'room-chat',
        timelineCount: 3,
        outgoingCount: 3,
        failedOutgoingCount: 2,
        searchResultCount: 1,
        keySearchResultCount: 2,
        replyTargetPresent: true,
        quoteTargetPresent: false,
        error: 'chat error',
        searchError: 'search error',
        keySearchError: 'key search error',
      },
    });
    expect(mocks.settings.collectDiagnostics.mock.calls[0]?.[0].rooms.activeRoomName).not.toBe(
      'Stale Deep Linked Room',
    );
  });

  it('wires development detail confirmation to the settings store', async () => {
    mocks.settings.debugOpen = true;
    mocks.settings.safeDiagnostics = 'safe output';
    mocks.settings.detailedDiagnostics = 'detail output';
    mocks.settings.diagnosticsDetailConfirmed = false;

    render(SettingsView);

    expect(screen.getByText('safe output')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Show development details' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Show details' }));

    expect(mocks.settings.confirmDiagnosticsDetail).toHaveBeenCalledTimes(1);
  });
});
