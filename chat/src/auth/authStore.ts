import { defineStore } from 'pinia';
import type { EndpointCaller } from '@/api/endpointTypes';
import { ApiClient } from '@/api/apiClient';
import { API_BASE_URL } from '@/shared/config';
import type { LocalStorageAdapter } from '@/shared/storage';
import { createLocalStorageAdapter } from '@/shared/storage';
import type { UserSummary } from '@/shared/types';
import { buildCallbackUrl, buildMiAuthUrl, completeMiAuth, createMiAuthSession } from './miauth';
import { createTelegramCloudAuthStorage, type CloudAuthStorage } from './cloudAuthStorage';

export type AuthStatus = 'idle' | 'anonymous' | 'authorizing' | 'authorized' | 'token-invalid' | 'logout-complete';

export interface AuthDependencies {
  storage: LocalStorageAdapter;
  cloudAuthStorage?: CloudAuthStorage | null;
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
const PENDING_SESSION_KEY = 'hhhl-chat:pending-session';

function createDefaultDependencies(): AuthDependencies {
  const storage = createLocalStorageAdapter();
  const api = new ApiClient({
    baseUrl: API_BASE_URL,
    tokenProvider: () => storage.getToken(),
  });

  return {
    storage,
    cloudAuthStorage: createTelegramCloudAuthStorage(),
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

async function getCloudAuthToken(cloudAuthStorage: CloudAuthStorage | null | undefined): Promise<string | null> {
  try {
    return (await cloudAuthStorage?.getToken()) ?? null;
  } catch {
    return null;
  }
}

async function setCloudAuthToken(cloudAuthStorage: CloudAuthStorage | null | undefined, token: string): Promise<void> {
  try {
    await cloudAuthStorage?.setToken(token);
  } catch {
    // CloudStorage sync is optional; local authorization remains authoritative.
  }
}

async function clearCloudAuthToken(cloudAuthStorage: CloudAuthStorage | null | undefined): Promise<void> {
  try {
    await cloudAuthStorage?.clearToken();
  } catch {
    // Ignore CloudStorage failures so logout and local cleanup can still complete.
  }
}

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
        let pendingSessionError: string | null = null;
        const pendingSession = dependencies.storage.getJson<string | null>(PENDING_SESSION_KEY, null);

        if (pendingSession != null) {
          try {
            await this.completeCallback(pendingSession, dependencies);
            return;
          } catch (error) {
            pendingSessionError = this.error ?? messageFromUnknown(error);
            // Session completion failed; fall through to anonymous state.
          }
        }

        const cloudToken = await getCloudAuthToken(dependencies.cloudAuthStorage);
        if (cloudToken != null) {
          dependencies.storage.setToken(cloudToken);
          this.status = 'authorizing';
          this.token = cloudToken;
          this.error = null;

          try {
            this.user = await validateStoredToken(dependencies.api);
            this.status = 'authorized';
            return;
          } catch {
            dependencies.storage.clearAuth();
            await clearCloudAuthToken(dependencies.cloudAuthStorage);
          }
        }

        this.status = 'anonymous';
        this.token = null;
        this.user = null;
        this.error = pendingSessionError;
        return;
      }

      this.status = 'authorizing';
      this.token = token;
      this.error = null;

      try {
        this.user = await validateStoredToken(dependencies.api);
        void setCloudAuthToken(dependencies.cloudAuthStorage, token);
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
      try {
        const session = dependencies.createSession();
        const callbackUrl = buildCallbackUrl(dependencies.currentUrl(), session);
        const authUrl = dependencies.buildAuthUrl(session, callbackUrl);

        this.status = 'authorizing';
        this.error = null;
        this.pendingSession = session;
        dependencies.storage.setJson(PENDING_SESSION_KEY, session);
        dependencies.openAuthUrl(authUrl);
      } catch (error) {
        dependencies.storage.remove(PENDING_SESSION_KEY);
        this.status = 'anonymous';
        this.token = null;
        this.user = null;
        this.pendingSession = null;
        this.error = messageFromUnknown(error);
      }
    },

    async completeCallback(session: string, dependencies: AuthDependencies = createDefaultDependencies()) {
      this.status = 'authorizing';
      this.error = null;

      try {
        const token = await dependencies.completeMiAuth(session);
        dependencies.storage.setToken(token);
        this.token = token;
        this.user = await validateStoredToken(dependencies.api);
        void setCloudAuthToken(dependencies.cloudAuthStorage, token);
        this.status = 'authorized';
        this.pendingSession = null;
        dependencies.storage.remove(PENDING_SESSION_KEY);
      } catch (error) {
        dependencies.storage.clearAuth();
        dependencies.storage.remove(PENDING_SESSION_KEY);
        this.token = null;
        this.user = null;
        this.status = 'token-invalid';
        this.error = messageFromUnknown(error);
        throw error;
      }
    },

    logout(dependencies: Pick<AuthDependencies, 'storage' | 'cloudAuthStorage'> = createDefaultDependencies()) {
      dependencies.storage.clearAuth();
      void clearCloudAuthToken(dependencies.cloudAuthStorage);
      dependencies.storage.remove(DRAFTS_KEY);
      dependencies.storage.remove(RECENT_ROOM_KEY);
      dependencies.storage.remove(PENDING_SESSION_KEY);
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
