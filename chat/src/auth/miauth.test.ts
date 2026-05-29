import { describe, expect, it, vi } from 'vitest';
import { AuthError } from '@/shared/errors';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { HHHL_CHAT_PERMISSIONS } from './permissions';
import { buildMiAuthUrl, completeMiAuth, createMiAuthSession } from './miauth';

describe('MiAuth URL generation', () => {
  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    const originalRandomUUID = crypto.randomUUID;

    try {
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
      const session = createMiAuthSession();

      expect(session).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: originalRandomUUID });
    }
  });

  it('creates a dc.hhhl.cc MiAuth URL with callback and exact permissions', () => {
    const session = createMiAuthSession({ randomUUID: () => 'session-1' });
    const url = buildMiAuthUrl({
      session,
      callbackUrl: 'https://mini.example/auth/callback?room=room-1',
    });
    const parsed = new URL(url);

    expect(parsed.origin).toBe(DC_HHHL_ORIGIN);
    expect(parsed.pathname).toBe('/miauth/session-1');
    expect(parsed.searchParams.get('name')).toBe('HHHL Chat Mini App');
    expect(parsed.searchParams.get('callback')).toBe('https://mini.example/auth/callback?room=room-1');
    expect(parsed.searchParams.get('permission')).toBe(HHHL_CHAT_PERMISSIONS.join(','));
    expect(parsed.search).not.toContain('secret-token');
    expect(parsed.searchParams.get('i')).toBeNull();
    expect(parsed.searchParams.get('token')).toBeNull();
  });
});

describe('completeMiAuth', () => {
  it('exchanges a session for a token through the runtime check endpoint', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/api/miauth/session-1/check');
      expect(init?.method).toBe('POST');
      return Response.json({ token: 'dc-token' });
    });

    await expect(completeMiAuth('session-1', { fetchImpl: fetchImpl as typeof fetch })).resolves.toBe('dc-token');
  });

  it('rejects when the check response does not contain a token', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));

    await expect(completeMiAuth('session-1', { fetchImpl: fetchImpl as typeof fetch })).rejects.toMatchObject({
      name: 'AuthError',
      code: 'MIAUTH_TOKEN_MISSING',
    } satisfies Partial<AuthError>);
  });
});
