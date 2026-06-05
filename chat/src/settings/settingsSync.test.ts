import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/shared/errors';
import { createCloudSettingsDocument, type CloudSettingsDocument, type SettingsPreferences } from './settingsConfig';
import type { DriveFolderSummary, SettingsDriveApi, SettingsDriveFile } from './settingsDriveApi';
import {
  createSettingsSyncService,
  SETTINGS_SYNC_FILE_NAME,
  SETTINGS_SYNC_FOLDER_NAME,
  type LocalSettingsSnapshot,
} from './settingsSync';

const localPreferences: SettingsPreferences = {
  language: 'en',
  themeMode: 'system',
  favoriteUserIds: ['local-user'],
};

const cloudPreferences: SettingsPreferences = {
  language: 'zh',
  themeMode: 'dark',
  favoriteUserIds: ['cloud-user'],
};

const LOCAL_UPDATED_AT = '2026-06-05T10:00:00.000Z';
const CLOUD_OLDER_UPDATED_AT = '2026-06-05T09:00:00.000Z';
const CLOUD_NEWER_UPDATED_AT = '2026-06-05T11:00:00.000Z';
const SYNCED_AT = '2026-06-05T12:00:00.000Z';

function file(id: string, url = `/files/${id}.json`): SettingsDriveFile {
  return {
    id,
    name: SETTINGS_SYNC_FILE_NAME,
    url: `https://dc.hhhl.cc${url}`,
  };
}

function document(
  preferences: SettingsPreferences,
  updatedAt: string,
  base?: CloudSettingsDocument | null,
) {
  return createCloudSettingsDocument(preferences, updatedAt, base);
}

function snapshot(updatedAt = LOCAL_UPDATED_AT): LocalSettingsSnapshot {
  return {
    preferences: localPreferences,
    updatedAt,
  };
}

function fetchJsonFileMock(resolver: (url: string) => unknown | Promise<unknown>): SettingsDriveApi['fetchJsonFile'] {
  return vi.fn(async <T = unknown>(url: string) => await resolver(url) as T) as SettingsDriveApi['fetchJsonFile'];
}

function createFakeDrive(overrides: Partial<SettingsDriveApi> = {}): SettingsDriveApi {
  const folder: DriveFolderSummary = {
    id: 'folder-1',
    name: SETTINGS_SYNC_FOLDER_NAME,
  };

  return {
    findFolder: vi.fn(async () => folder),
    createFolder: vi.fn(async () => ({ id: 'created-folder', name: SETTINGS_SYNC_FOLDER_NAME })),
    findFiles: vi.fn(async () => []),
    showFile: vi.fn(async (fileId: string) => file(fileId)),
    fetchJsonFile: fetchJsonFileMock(() => document(cloudPreferences, CLOUD_NEWER_UPDATED_AT)),
    createJsonFile: vi.fn(async () => file('created-file')),
    deleteFile: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createService(drive: SettingsDriveApi) {
  return createSettingsSyncService({
    drive,
    now: () => new Date(SYNCED_AT),
  });
}

describe('settingsSync', () => {
  it('creates folder and settings file when cloud config is missing', async () => {
    const drive = createFakeDrive({
      findFolder: vi.fn(async () => null),
      findFiles: vi.fn(async () => []),
    });
    const service = createService(drive);

    const result = await service.syncAfterLogin(snapshot());

    expect(result.status).toBe('created');
    expect(result.document).toEqual(document(localPreferences, LOCAL_UPDATED_AT));
    expect(result.fileId).toBe('created-file');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(drive.createFolder).toHaveBeenCalledWith(SETTINGS_SYNC_FOLDER_NAME);
    expect(drive.createJsonFile).toHaveBeenCalledWith(
      'created-folder',
      SETTINGS_SYNC_FILE_NAME,
      document(localPreferences, LOCAL_UPDATED_AT),
    );
  });

  it('loads cloud config when cloud updatedAt is newer', async () => {
    const cloudDocument = document(cloudPreferences, CLOUD_NEWER_UPDATED_AT);
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('cloud-file')]),
      fetchJsonFile: fetchJsonFileMock(() => cloudDocument),
    });
    const service = createService(drive);

    const result = await service.syncAfterLogin(snapshot());

    expect(result).toEqual({
      status: 'loaded-cloud',
      document: cloudDocument,
      fileId: 'cloud-file',
      syncedAt: SYNCED_AT,
    });
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('deletes old candidates and creates a new file when local config is newer', async () => {
    const cloudDocument = document(cloudPreferences, CLOUD_OLDER_UPDATED_AT);
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('old-file-1'), file('old-file-2')]),
      fetchJsonFile: fetchJsonFileMock(() => cloudDocument),
    });
    const service = createService(drive);

    const result = await service.save(snapshot());

    expect(result.status).toBe('saved-local');
    expect(result.document).toEqual(document(localPreferences, LOCAL_UPDATED_AT));
    expect(result.fileId).toBe('created-file');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(drive.deleteFile).toHaveBeenNthCalledWith(1, 'old-file-1');
    expect(drive.deleteFile).toHaveBeenNthCalledWith(2, 'old-file-2');
    expect(drive.createJsonFile).toHaveBeenCalledWith(
      'folder-1',
      SETTINGS_SYNC_FILE_NAME,
      document(localPreferences, LOCAL_UPDATED_AT),
    );
  });

  it('preserves unknown fields from older selected cloud config when local config is newer', async () => {
    const cloudDocument = {
      ...document(cloudPreferences, CLOUD_OLDER_UPDATED_AT),
      topLevelExtension: { keep: true },
      preferences: {
        ...cloudPreferences,
        extraPreference: 'preserve-me',
      },
    };
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('old-file')]),
      fetchJsonFile: fetchJsonFileMock(() => cloudDocument),
    });
    const service = createService(drive);
    const expectedDocument = document(localPreferences, LOCAL_UPDATED_AT, cloudDocument);

    const result = await service.save(snapshot());

    expect(result.status).toBe('saved-local');
    expect(result.document).toEqual(expectedDocument);
    expect(drive.deleteFile).toHaveBeenCalledWith('old-file');
    expect(drive.createJsonFile).toHaveBeenCalledWith(
      'folder-1',
      SETTINGS_SYNC_FILE_NAME,
      expectedDocument,
    );
  });

  it('does not overwrite newer cloud config during manual save', async () => {
    const cloudDocument = document(cloudPreferences, CLOUD_NEWER_UPDATED_AT);
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('cloud-file')]),
      fetchJsonFile: fetchJsonFileMock(() => cloudDocument),
    });
    const service = createService(drive);

    const result = await service.save(snapshot());

    expect(result).toEqual({
      status: 'loaded-cloud',
      document: cloudDocument,
      fileId: 'cloud-file',
      syncedAt: SYNCED_AT,
    });
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('chooses newest valid duplicate config and cleans duplicates on save', async () => {
    const oldDocument = document(cloudPreferences, CLOUD_OLDER_UPDATED_AT);
    const newDocument = document(cloudPreferences, CLOUD_NEWER_UPDATED_AT);
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('old-file'), file('new-file')]),
      fetchJsonFile: fetchJsonFileMock((url) => (url.includes('old-file') ? oldDocument : newDocument)),
    });
    const service = createService(drive);

    await expect(service.syncAfterLogin(snapshot())).resolves.toMatchObject({
      status: 'loaded-cloud',
      document: newDocument,
      fileId: 'new-file',
      syncedAt: SYNCED_AT,
    });

    const result = await service.save(snapshot('2026-06-05T12:30:00.000Z'));

    expect(result.status).toBe('saved-local');
    expect(result.document).toEqual(document(localPreferences, '2026-06-05T12:30:00.000Z'));
    expect(drive.deleteFile).toHaveBeenNthCalledWith(1, 'old-file');
    expect(drive.deleteFile).toHaveBeenNthCalledWith(2, 'new-file');
    expect(drive.createJsonFile).toHaveBeenCalledWith(
      'folder-1',
      SETTINGS_SYNC_FILE_NAME,
      document(localPreferences, '2026-06-05T12:30:00.000Z'),
    );
  });

  it('fails without deleting or creating when existing cloud config is invalid', async () => {
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('invalid-file')]),
      fetchJsonFile: fetchJsonFileMock(() => ({ bad: true })),
    });
    const service = createService(drive);

    await expect(service.syncAfterLogin(snapshot())).rejects.toThrow('No valid cloud settings document found');
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('propagates duplicate fetch NetworkError without deleting or creating', async () => {
    const networkError = new NetworkError('NETWORK_ERROR', 'Network unavailable');
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('network-file'), file('valid-file')]),
      fetchJsonFile: fetchJsonFileMock((url) => {
        if (url.includes('network-file')) {
          throw networkError;
        }

        return document(cloudPreferences, CLOUD_OLDER_UPDATED_AT);
      }),
    });
    const service = createService(drive);

    await expect(service.save(snapshot())).rejects.toBe(networkError);
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('propagates duplicate fetch HTTP errors without deleting or creating', async () => {
    const httpError = new ApiError('HTTP_404', 'Not Found', 404);
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('missing-file'), file('valid-file')]),
      fetchJsonFile: fetchJsonFileMock((url) => {
        if (url.includes('missing-file')) {
          throw httpError;
        }

        return document(cloudPreferences, CLOUD_OLDER_UPDATED_AT);
      }),
    });
    const service = createService(drive);

    await expect(service.save(snapshot())).rejects.toBe(httpError);
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('fails on mixed valid and invalid duplicate configs without deleting or creating', async () => {
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('invalid-file'), file('valid-file')]),
      fetchJsonFile: fetchJsonFileMock((url) => (
        url.includes('invalid-file')
          ? { bad: true }
          : document(cloudPreferences, CLOUD_OLDER_UPDATED_AT)
      )),
    });
    const service = createService(drive);

    await expect(service.save(snapshot())).rejects.toThrow('No valid cloud settings document found');
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('returns unchanged for one exact file with matching updatedAt', async () => {
    const cloudDocument = document(localPreferences, LOCAL_UPDATED_AT);
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('cloud-file')]),
      fetchJsonFile: fetchJsonFileMock(() => cloudDocument),
    });
    const service = createService(drive);

    const result = await service.syncAfterLogin(snapshot());

    expect(result).toEqual({
      status: 'unchanged',
      document: cloudDocument,
      fileId: 'cloud-file',
      syncedAt: SYNCED_AT,
    });
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('replaces cloud config when one exact file has matching updatedAt but different preferences', async () => {
    const cloudDocument = document(cloudPreferences, LOCAL_UPDATED_AT);
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('cloud-file')]),
      fetchJsonFile: fetchJsonFileMock(() => cloudDocument),
    });
    const service = createService(drive);
    const expectedDocument = document(localPreferences, LOCAL_UPDATED_AT, cloudDocument);

    const result = await service.save(snapshot());

    expect(result.status).toBe('saved-local');
    expect(result.document).toEqual(expectedDocument);
    expect(drive.deleteFile).toHaveBeenCalledWith('cloud-file');
    expect(drive.createJsonFile).toHaveBeenCalledWith(
      'folder-1',
      SETTINGS_SYNC_FILE_NAME,
      expectedDocument,
    );
  });

  it('skips create when delete fails', async () => {
    const deleteError = new Error('delete failed');
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('old-file')]),
      fetchJsonFile: fetchJsonFileMock(() => document(cloudPreferences, CLOUD_OLDER_UPDATED_AT)),
      deleteFile: vi.fn(async () => {
        throw deleteError;
      }),
    });
    const service = createService(drive);

    await expect(service.save(snapshot())).rejects.toBe(deleteError);
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });

  it('rejects token-bearing Drive file URLs without deleting or creating', async () => {
    const drive = createFakeDrive({
      findFiles: vi.fn(async () => [file('settings')]),
      showFile: vi.fn(async () => ({
        ...file('settings'),
        url: 'https://dc.hhhl.cc/files/settings.json?i=secret-token',
      })),
      fetchJsonFile: fetchJsonFileMock(() => {
        throw new ApiError('DRIVE_FILE_URL_NOT_ALLOWED', 'Drive file URL is not allowed');
      }),
    });
    const service = createService(drive);

    await expect(service.save(snapshot())).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(drive.createJsonFile).not.toHaveBeenCalled();
  });
});
