import { fireEvent, render, screen } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsView from './SettingsView.vue';

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  auth: {},
  settings: {
    language: 'en',
    themeMode: 'system',
    favoriteUserIds: [],
    debugOpen: false,
    diagnostics: '',
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
    logout: vi.fn(),
    saveToCloud: vi.fn(async () => undefined),
  },
  realtimeStore: {
    status: 'connected',
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/auth/authStore', () => ({
  createAuthDependencies: () => ({ storage: {} }),
  useAuthStore: () => mocks.auth,
}));

vi.mock('@/realtime/realtimeStore', () => ({
  useRealtimeStore: () => mocks.realtimeStore,
}));

vi.mock('../settingsStore', () => ({
  useSettingsStore: () => mocks.settings,
}));

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.language = 'en';
    mocks.settings.themeMode = 'system';
    mocks.settings.syncStatus = 'synced';
    mocks.settings.syncError = null;
    mocks.settings.lastSyncedAt = '2026-06-05T03:00:00.000Z';
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
});
