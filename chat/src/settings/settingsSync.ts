import {
  compareUpdatedAt,
  createCloudSettingsDocument,
  parseCloudSettingsJson,
  type CloudSettingsDocument,
  type SettingsPreferences,
} from './settingsConfig';
import type { DriveFolderSummary, SettingsDriveApi, SettingsDriveFile } from './settingsDriveApi';

export const SETTINGS_SYNC_FOLDER_NAME = 'telegram-bot-chat';
export const SETTINGS_SYNC_FILE_NAME = 'settings.json';

export interface LocalSettingsSnapshot {
  preferences: SettingsPreferences;
  updatedAt: string;
  baseDocument?: CloudSettingsDocument;
}

export type SettingsSyncStatus = 'created' | 'loaded-cloud' | 'saved-local' | 'unchanged';

export interface SettingsSyncResult {
  status: SettingsSyncStatus;
  document: CloudSettingsDocument;
  fileId?: string;
  syncedAt: string;
}

export interface SettingsSyncServiceOptions {
  drive: SettingsDriveApi;
  now?: () => Date;
}

export interface SettingsSyncService {
  syncAfterLogin(snapshot: LocalSettingsSnapshot): Promise<SettingsSyncResult>;
  save(snapshot: LocalSettingsSnapshot): Promise<SettingsSyncResult>;
}

interface CloudSettingsCandidate {
  file: SettingsDriveFile;
  document: CloudSettingsDocument;
}

interface CloudSettingsRead {
  exactFiles: SettingsDriveFile[];
  selected: CloudSettingsCandidate | null;
}

function invalidCloudSettingsError(): Error {
  return new Error('No valid cloud settings document found');
}

function parseFetchedDocument(value: unknown): CloudSettingsDocument {
  let json: string | undefined;

  if (typeof value === 'string') {
    json = value;
  } else {
    try {
      const serialized = JSON.stringify(value);
      json = typeof serialized === 'string' ? serialized : undefined;
    } catch {
      json = undefined;
    }
  }

  if (json == null) {
    throw invalidCloudSettingsError();
  }

  const parsed = parseCloudSettingsJson(json);
  if (!parsed.ok) {
    throw invalidCloudSettingsError();
  }

  return parsed.document;
}

function newestCandidate(left: CloudSettingsCandidate, right: CloudSettingsCandidate): CloudSettingsCandidate {
  return compareUpdatedAt(left.document.updatedAt, right.document.updatedAt) >= 0 ? left : right;
}

export function createSettingsSyncService(options: SettingsSyncServiceOptions): SettingsSyncService {
  const now = options.now ?? (() => new Date());
  const { drive } = options;

  async function ensureFolder(): Promise<DriveFolderSummary> {
    const folder = await drive.findFolder(SETTINGS_SYNC_FOLDER_NAME);
    return folder ?? drive.createFolder(SETTINGS_SYNC_FOLDER_NAME);
  }

  async function readCloud(folderId: string): Promise<CloudSettingsRead> {
    const exactFiles = (await drive.findFiles(SETTINGS_SYNC_FILE_NAME, folderId))
      .filter((file) => file.name === SETTINGS_SYNC_FILE_NAME);

    if (exactFiles.length === 0) {
      return { exactFiles, selected: null };
    }

    const validCandidates: CloudSettingsCandidate[] = [];

    for (const file of exactFiles) {
      const shownFile = await drive.showFile(file.id);
      if (shownFile.url == null) {
        throw invalidCloudSettingsError();
      }

      const fetched = await drive.fetchJsonFile<unknown>(shownFile.url);
      const document = parseFetchedDocument(fetched);

      validCandidates.push({ file, document });
    }

    if (validCandidates.length === 0) {
      throw invalidCloudSettingsError();
    }

    return {
      exactFiles,
      selected: validCandidates.reduce(newestCandidate),
    };
  }

  async function createLocalFile(
    folderId: string,
    snapshot: LocalSettingsSnapshot,
    status: Extract<SettingsSyncStatus, 'created' | 'saved-local'>,
  ): Promise<SettingsSyncResult> {
    const document = createCloudSettingsDocument(
      snapshot.preferences,
      snapshot.updatedAt,
      snapshot.baseDocument ?? null,
    );
    const file = await drive.createJsonFile(folderId, SETTINGS_SYNC_FILE_NAME, document);

    return {
      status,
      document,
      fileId: file.id,
      syncedAt: now().toISOString(),
    };
  }

  async function replaceWithLocal(
    folderId: string,
    exactFiles: SettingsDriveFile[],
    snapshot: LocalSettingsSnapshot,
  ): Promise<SettingsSyncResult> {
    for (const file of exactFiles) {
      await drive.deleteFile(file.id);
    }

    return createLocalFile(folderId, snapshot, 'saved-local');
  }

  async function sync(snapshot: LocalSettingsSnapshot): Promise<SettingsSyncResult> {
    const folder = await ensureFolder();
    const cloud = await readCloud(folder.id);

    if (cloud.selected == null) {
      return createLocalFile(folder.id, snapshot, 'created');
    }

    const updatedAtComparison = compareUpdatedAt(snapshot.updatedAt, cloud.selected.document.updatedAt);

    if (updatedAtComparison < 0) {
      return {
        status: 'loaded-cloud',
        document: cloud.selected.document,
        fileId: cloud.selected.file.id,
        syncedAt: now().toISOString(),
      };
    }

    if (updatedAtComparison === 0 && cloud.exactFiles.length === 1) {
      return {
        status: 'unchanged',
        document: cloud.selected.document,
        fileId: cloud.selected.file.id,
        syncedAt: now().toISOString(),
      };
    }

    return replaceWithLocal(folder.id, cloud.exactFiles, snapshot);
  }

  return {
    syncAfterLogin: sync,
    save: sync,
  };
}
