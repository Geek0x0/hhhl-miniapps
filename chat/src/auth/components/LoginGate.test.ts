import { render, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginGate from './LoginGate.vue';

const mocks = vi.hoisted(() => ({
  route: {
    path: '/',
    name: 'home' as string | null,
    query: {} as Record<string, unknown>,
  },
  router: {
    isReady: vi.fn(async () => undefined),
    replace: vi.fn(async () => undefined),
  },
  auth: {
    status: 'idle',
    token: null as string | null,
    error: null as string | null,
    needsLogin: false,
    isAuthorized: false,
    restore: vi.fn(async () => undefined),
    completeCallback: vi.fn(async () => undefined),
    startLogin: vi.fn(),
  },
  settings: {
    syncAfterLogin: vi.fn(async () => undefined),
  },
}));

vi.mock('vue-router', () => ({
  RouterView: { template: '<main>rooms</main>' },
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));

vi.mock('../authStore', () => ({
  createAuthDependencies: () => ({ storage: {} }),
  useAuthStore: () => mocks.auth,
}));

vi.mock('@/settings/settingsStore', () => ({
  useSettingsStore: () => mocks.settings,
}));

describe('LoginGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.path = '/';
    mocks.route.name = 'home';
    mocks.route.query = {};
    mocks.auth.status = 'idle';
    mocks.auth.token = null;
    mocks.auth.error = null;
    mocks.auth.needsLogin = false;
    mocks.auth.isAuthorized = false;
  });

  it('syncs settings after restoring an authorized token', async () => {
    mocks.auth.restore.mockImplementationOnce(async () => {
      mocks.auth.status = 'authorized';
      mocks.auth.token = 'dc-token';
      mocks.auth.isAuthorized = true;
    });

    render(LoginGate);

    await waitFor(() => {
      expect(mocks.settings.syncAfterLogin).toHaveBeenCalledTimes(1);
    });
  });

  it('syncs settings after completing an auth callback', async () => {
    mocks.route.path = '/auth/callback';
    mocks.route.name = 'auth-callback';
    mocks.route.query = { session: 'session-1' };
    mocks.auth.completeCallback.mockImplementationOnce(async () => {
      mocks.auth.status = 'authorized';
      mocks.auth.token = 'dc-token';
      mocks.auth.isAuthorized = true;
    });

    render(LoginGate);

    await waitFor(() => {
      expect(mocks.auth.completeCallback).toHaveBeenCalledWith('session-1', expect.anything());
      expect(mocks.settings.syncAfterLogin).toHaveBeenCalledTimes(1);
    });
  });
});
