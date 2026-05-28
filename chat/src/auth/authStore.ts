import { defineStore } from 'pinia';
import type { EndpointCaller } from '@/api/endpointTypes';
import { ApiClient } from '@/api/apiClient';
import { API_BASE_URL } from '@/shared/config';
import type { LocalStorageAdapter } from '@/shared/storage';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { UserSummary } from '@/shared/types';
import { buildCallbackUrl, buildMiAuthUrl, completeMiAuth, createMiAuthSession } from './miauth';

export type AuthStatus = 'idle' | 'anonymous' | 'authorizing' | 'authorized' | 'token-invalid' | 'logout-complete';

export interface AuthDependencies {
  storage: LocalStorageAdapter;
  api: EndpointCaller;
  completeMiAuth: (session: string) => Promise<string>;
  openAuthUrl: (url: string) => void;
  buildAuthUrl: (session: string, callbackUrl: string) => string;
  createSession: () => string;
  currentUrl: () => string;
}

export interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: UserSummary | null;
  error: string | null;
  pendingSession: string | null;
}

const DRAFTS_KEY = 'hhhl-chat:drafts';
const RECENT_ROOM_KEY = 'hhhl-chat:recent-room';

function createDefaultDependencies(): AuthDependencies {
  const storage = createLocalStorageAdapter();
  const api = new ApiClient({
    baseUrl: API_BASE_URL,
    tokenProvider: () => storage.getToken(),
  });

  return {
    storage,
    api,
    completeMiAuth: (session) => completeMiAuth(session),
    openAuthUrl: (url) => window.location.assign(url),
    buildAuthUrl: (session, callbackUrl) => buildMiAuthUrl({ session, callbackUrl }),
    createSession: () => createMiAuthSession(),
    currentUrl: () => window.location.href,
  };
}

async function validateStoredToken(api: EndpointCaller): Promise<UserSummary> {
  return api.callEndpoint<UserSummary>('i', {});
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    status: 'idle',
    token: null,
    user: null,
    error: null,
    pendingSession: null,
  }),
  getters: {
    isAuthorized: (state) => state.status === 'authorized' && state.token != null,
    needsLogin: (state) => state.status === 'anonymous' || state.status === 'token-invalid' || state.status === 'logout-complete',
  },
  actions: {
    async restore(dependencies: AuthDependencies = createDefaultDependencies()) {
      const token = dependencies.storage.getToken();

      if (token == null) {
        this.status = 'anonymous';
        this.token = null;
        this.user = null;
        return;
      }

      this.status = 'authorizing';
      this.token = token;
      this.error = null;

      try {
        this.user = await validateStoredToken(dependencies.api);
        this.status = 'authorized';
      } catch (error) {
        dependencies.storage.clearAuth();
        this.status = 'token-invalid';
        this.token = null;
        this.user = null;
        this.error = error instanceof Error ? error.message : String(error);
      }
    },

    startLogin(dependencies: AuthDependencies = createDefaultDependencies()) {
      const session = dependencies.createSession();
      const callbackUrl = buildCallbackUrl(dependencies.currentUrl(), session);
      const authUrl = dependencies.buildAuthUrl(session, callbackUrl);

      this.status = 'authorizing';
      this.pendingSession = session;
      dependencies.openAuthUrl(authUrl);
    },

    async completeCallback(session: string, dependencies: AuthDependencies = createDefaultDependencies()) {
      this.status = 'authorizing';
      this.error = null;

      try {
        const token = await dependencies.completeMiAuth(session);
        dependencies.storage.setToken(token);
        this.token = token;
        this.user = await validateStoredToken(dependencies.api);
        this.status = 'authorized';
        this.pendingSession = null;
      } catch (error) {
        dependencies.storage.clearAuth();
        this.token = null;
        this.user = null;
        this.status = 'token-invalid';
        this.error = error instanceof Error ? error.message : String(error);
        throw error;
      }
    },

    logout(dependencies: Pick<AuthDependencies, 'storage'> = createDefaultDependencies()) {
      dependencies.storage.clearAuth();
      dependencies.storage.remove(DRAFTS_KEY);
      dependencies.storage.remove(RECENT_ROOM_KEY);
      this.status = 'logout-complete';
      this.token = null;
      this.user = null;
      this.error = null;
      this.pendingSession = null;
    },
  },
});

export function createAuthDependencies(): AuthDependencies {
  return createDefaultDependencies();
}
