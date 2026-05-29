import { getRuntimeContracts } from '@/api/endpointContracts';
import { API_BASE_URL, DC_HHHL_ORIGIN, MINI_APP_NAME } from '@/shared/config';
import { ApiError, AuthError, NetworkError, redactSensitiveText } from '@/shared/errors';
import { HHHL_CHAT_PERMISSIONS } from './permissions';

export interface CreateMiAuthSessionOptions {
  randomUUID?: () => string;
}

export interface BuildMiAuthUrlOptions {
  session: string;
  callbackUrl: string;
  name?: string;
}

export interface CompleteMiAuthOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

interface MiAuthCheckResponse {
  token?: string;
}

function createFallbackUuid(cryptoImpl: Crypto = crypto): string {
  const bytes = new Uint8Array(16);
  cryptoImpl.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createDefaultFetch(): typeof fetch {
  return ((input, init) => {
    const resolvedInput = typeof input === 'string' && input.startsWith('/') ? new URL(input, window.location.origin).toString() : input;
    return window.fetch(resolvedInput, init);
  }) as typeof fetch;
}

export function createMiAuthSession(options: CreateMiAuthSessionOptions = {}): string {
  if (options.randomUUID != null) {
    return options.randomUUID();
  }

  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return createFallbackUuid();
}

export function buildCallbackUrl(currentUrl: string, session: string): string {
  const url = new URL(currentUrl, window.location.origin);

  url.pathname = '/auth/callback';
  url.searchParams.set('session', session);

  return url.toString();
}

export function buildMiAuthUrl(options: BuildMiAuthUrlOptions): string {
  const url = new URL(`/miauth/${encodeURIComponent(options.session)}`, DC_HHHL_ORIGIN);

  url.searchParams.set('name', options.name ?? MINI_APP_NAME);
  url.searchParams.set('callback', options.callbackUrl);
  url.searchParams.set('permission', HHHL_CHAT_PERMISSIONS.join(','));

  return url.toString();
}

export async function completeMiAuth(session: string, options: CompleteMiAuthOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? createDefaultFetch();
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  const path = getRuntimeContracts().miauthCheckPathPattern.replace('{session}', encodeURIComponent(session));
  const url = path.startsWith('/api/') ? `${baseUrl}${path.slice('/api'.length)}` : `${baseUrl}${path}`;

  try {
    const response = await fetchImpl(url, { method: 'POST' });
    const payload = await response.json().catch(() => null) as MiAuthCheckResponse | { error?: { code?: string; message?: string } } | null;

    if (!response.ok) {
      const errorPayload = payload as { error?: { code?: string; message?: string } } | null;
      throw new ApiError(
        errorPayload?.error?.code ?? `HTTP_${response.status}`,
        redactSensitiveText(errorPayload?.error?.message ?? response.statusText),
        response.status,
      );
    }

    const token = (payload as MiAuthCheckResponse | null)?.token;
    if (token == null || token === '') {
      throw new AuthError('MIAUTH_TOKEN_MISSING', 'MiAuth check response did not include a token');
    }

    return token;
  } catch (error) {
    if (error instanceof ApiError || error instanceof AuthError) {
      throw error;
    }

    throw new NetworkError('MIAUTH_NETWORK_ERROR', redactSensitiveText(error instanceof Error ? error.message : String(error)));
  }
}
