export interface AppUpdateCheckResult {
  remoteVersion: string | null;
  updateAvailable: boolean;
}

export interface AppUpdateCheckOptions {
  fetcher?: typeof globalThis.fetch;
  localVersion?: string;
  versionUrl?: string;
}

const DEFAULT_VERSION_URL = '/version.json';

function numericVersionParts(version: string): number[] | null {
  const match = version.trim().match(/^v?(\d+(?:\.\d+){0,2})/);
  if (match == null) {
    return null;
  }

  const parts = match[1].split('.').map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0)) {
    return null;
  }

  while (parts.length < 3) {
    parts.push(0);
  }

  return parts;
}

export function isVersionNewer(remoteVersion: string, localVersion: string): boolean {
  const remoteParts = numericVersionParts(remoteVersion);
  const localParts = numericVersionParts(localVersion);
  if (remoteParts == null || localParts == null) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    const remote = remoteParts[index] ?? 0;
    const local = localParts[index] ?? 0;
    if (remote > local) {
      return true;
    }
    if (remote < local) {
      return false;
    }
  }

  return false;
}

export async function checkForAppUpdate(options: AppUpdateCheckOptions = {}): Promise<AppUpdateCheckResult> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const localVersion = options.localVersion ?? __APP_VERSION__;
  const versionUrl = options.versionUrl ?? DEFAULT_VERSION_URL;

  try {
    const response = await fetcher(versionUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) {
      return { remoteVersion: null, updateAvailable: false };
    }

    const raw = await response.json() as { version?: unknown };
    const remoteVersion = typeof raw.version === 'string' && raw.version.trim() !== '' ? raw.version.trim() : null;
    return {
      remoteVersion,
      updateAvailable: remoteVersion != null && isVersionNewer(remoteVersion, localVersion),
    };
  } catch {
    return { remoteVersion: null, updateAvailable: false };
  }
}
