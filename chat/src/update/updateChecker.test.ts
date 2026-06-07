import { describe, expect, it, vi } from 'vitest';
import { checkForAppUpdate, isVersionNewer } from './updateChecker';

describe('updateChecker', () => {
  it('compares numeric app versions', () => {
    expect(isVersionNewer('0.5.5', '0.5.4')).toBe(true);
    expect(isVersionNewer('0.6.0', '0.5.99')).toBe(true);
    expect(isVersionNewer('0.5.4', '0.5.4')).toBe(false);
    expect(isVersionNewer('0.5.3', '0.5.4')).toBe(false);
  });

  it('reports an update when the remote version endpoint returns a newer version', async () => {
    const fetcher = vi.fn(async () => Response.json({ version: '0.5.5' }));

    await expect(checkForAppUpdate({ fetcher, localVersion: '0.5.4' })).resolves.toEqual({
      remoteVersion: '0.5.5',
      updateAvailable: true,
    });

    expect(fetcher).toHaveBeenCalledWith('/version.json', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
  });

  it('ignores missing, failed, and stale remote versions', async () => {
    await expect(checkForAppUpdate({
      fetcher: vi.fn(async () => Response.json({ version: '0.5.4' })),
      localVersion: '0.5.4',
    })).resolves.toEqual({ remoteVersion: '0.5.4', updateAvailable: false });

    await expect(checkForAppUpdate({
      fetcher: vi.fn(async () => Response.json({}, { status: 200 })),
      localVersion: '0.5.4',
    })).resolves.toEqual({ remoteVersion: null, updateAvailable: false });

    await expect(checkForAppUpdate({
      fetcher: vi.fn(async () => Response.json({ version: '0.5.5' }, { status: 500 })),
      localVersion: '0.5.4',
    })).resolves.toEqual({ remoteVersion: null, updateAvailable: false });
  });
});
