import type { EndpointCaller, TokenProvider } from '@/api/endpointTypes';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { normalizeDriveFile } from '@/shared/driveFile';
import { ApiError, NetworkError, redactSensitiveText } from '@/shared/errors';
import type { DriveFile } from '@/shared/types';

export interface DriveFolderSummary {
  id: string;
  name: string;
}

export interface SettingsDriveFile {
  id: string;
  name: string;
  type?: string;
  size?: number;
  url?: string;
  thumbnailUrl?: string;
  blurhash?: string;
  isSensitive?: boolean;
  properties?: NonNullable<DriveFile['properties']>;
}

export interface SettingsDriveApiClient extends EndpointCaller {
  uploadFile(formData: FormData, onProgress?: (progress: number) => void): Promise<DriveFile>;
  tokenProvider: TokenProvider;
}

export interface SettingsDriveApiOptions extends SettingsDriveApiClient {
  fetchImpl?: typeof fetch;
}

export interface SettingsDriveApi {
  findFolder(name: string, parentId?: string): Promise<DriveFolderSummary | null>;
  createFolder(name: string, parentId?: string): Promise<DriveFolderSummary>;
  findFiles(name: string, folderId: string): Promise<SettingsDriveFile[]>;
  showFile(fileId: string): Promise<SettingsDriveFile>;
  fetchJsonFile<T = unknown>(fileUrl: string): Promise<T>;
  createJsonFile(folderId: string, name: string, value: unknown): Promise<SettingsDriveFile>;
  deleteFile(fileId: string): Promise<void>;
}

type UnknownRecord = Record<string, unknown>;

const FOLDER_RECORD_KEYS = ['folder', 'driveFolder', 'item', 'data', 'result', 'body', 'payload', 'response', 'value'];
const FILE_RECORD_KEYS = ['file', 'driveFile', 'item', 'data', 'result', 'body', 'payload', 'response', 'value'];
const FILE_ARRAY_KEYS = ['files', 'driveFiles', 'items', 'data', 'result', 'body', 'payload', 'response', 'value'];
const FILE_URL_KEYS = ['webpublicUrl', 'webUrl', 'url', 'src', 'downloadUrl', 'downloadURL'];
const FILE_THUMBNAIL_URL_KEYS = ['thumbnailUrl', 'thumbnailURL', 'thumbnail', 'previewUrl', 'previewURL'];

function recordField(value: unknown): UnknownRecord | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function stringLikeField(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return stringField(value);
}

function stringFrom(raw: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringLikeField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function isSummaryRecord(raw: UnknownRecord): boolean {
  return stringFrom(raw, ['id', 'fileId', 'driveFileId', 'folderId', 'driveFolderId', 'name']) != null;
}

function firstRecord(values: unknown[]): UnknownRecord | null {
  for (const value of values) {
    const record = recordField(value);
    if (record != null) {
      return record;
    }
  }

  return null;
}

function unwrapSingularRecord(value: unknown, keys: string[]): UnknownRecord | null {
  if (Array.isArray(value)) {
    return firstRecord(value);
  }

  const raw = recordField(value);
  if (raw == null) {
    return null;
  }

  if (isSummaryRecord(raw)) {
    return raw;
  }

  for (const key of keys) {
    const nested = raw[key];
    if (Array.isArray(nested)) {
      const first = firstRecord(nested);
      if (first != null) {
        return first;
      }
    }

    const nestedRecord = recordField(nested);
    if (nestedRecord != null) {
      return unwrapSingularRecord(nestedRecord, keys) ?? nestedRecord;
    }
  }

  return raw;
}

function unwrapArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const raw = recordField(value);
  if (raw == null) {
    return [];
  }

  for (const key of keys) {
    const nested = raw[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  for (const key of keys) {
    const nested = recordField(raw[key]);
    if (nested != null) {
      const values = unwrapArray(nested, keys);
      if (values.length > 0) {
        return values;
      }
    }
  }

  return isSummaryRecord(raw) ? [raw] : [];
}

function normalizeFolder(value: unknown): DriveFolderSummary | null {
  const raw = unwrapSingularRecord(value, FOLDER_RECORD_KEYS);
  if (raw == null) {
    return null;
  }

  const id = stringFrom(raw, ['id', 'folderId', 'driveFolderId']);
  const name = stringFrom(raw, ['name', 'folderName']);
  if (id == null && name == null) {
    return null;
  }

  return {
    id: id ?? name ?? '',
    name: name ?? id ?? '',
  };
}

function compactDriveFile(file: DriveFile): SettingsDriveFile {
  const normalized: SettingsDriveFile = {
    id: file.id,
    name: file.name,
  };

  if (file.type != null) normalized.type = file.type;
  if (file.size != null) normalized.size = file.size;
  if (file.url != null) normalized.url = file.url;
  if (file.thumbnailUrl != null) normalized.thumbnailUrl = file.thumbnailUrl;
  if (file.blurhash != null) normalized.blurhash = file.blurhash;
  if (file.isSensitive != null) normalized.isSensitive = file.isSensitive;
  if (file.properties != null) normalized.properties = file.properties;

  return normalized;
}

function driveUrlFrom(raw: UnknownRecord, keys: string[]): string | null {
  const url = stringFrom(raw, keys);
  return url == null ? null : new URL(url, DC_HHHL_ORIGIN).toString();
}

function normalizeFile(value: unknown): SettingsDriveFile | null {
  const raw = unwrapSingularRecord(value, FILE_RECORD_KEYS);
  if (raw == null || stringFrom(raw, ['id', 'fileId', 'driveFileId', 'attachmentId']) == null) {
    return null;
  }

  const file = normalizeDriveFile(raw);
  if (file == null) {
    return null;
  }

  const normalized = compactDriveFile(file);
  if (raw != null) {
    const url = driveUrlFrom(raw, FILE_URL_KEYS);
    const thumbnailUrl = driveUrlFrom(raw, FILE_THUMBNAIL_URL_KEYS);

    if (url != null) normalized.url = url;
    if (thumbnailUrl != null) normalized.thumbnailUrl = thumbnailUrl;
  }

  return normalized;
}

function normalizeFiles(value: unknown): SettingsDriveFile[] {
  return unwrapArray(value, FILE_ARRAY_KEYS).flatMap((item) => {
    const file = normalizeFile(item);
    return file == null ? [] : [file];
  });
}

function requireFolder(value: unknown): DriveFolderSummary {
  const folder = normalizeFolder(value);
  if (folder == null) {
    throw new ApiError('DRIVE_FOLDER_INVALID', 'Invalid Drive folder response');
  }

  return folder;
}

function requireFile(value: unknown): SettingsDriveFile {
  const file = normalizeFile(value);
  if (file == null) {
    throw new ApiError('DRIVE_FILE_INVALID', 'Invalid Drive file response');
  }

  return file;
}

function createDefaultFetch(): typeof fetch {
  return ((input, init) => globalThis.fetch(input, init)) as typeof fetch;
}

function allowedFileUrl(fileUrl: string): string {
  let url: URL;
  try {
    url = new URL(fileUrl, DC_HHHL_ORIGIN);
  } catch {
    throw new ApiError('DRIVE_FILE_URL_NOT_ALLOWED', 'Drive file URL is not allowed');
  }

  if (url.origin !== DC_HHHL_ORIGIN) {
    throw new ApiError('DRIVE_FILE_URL_NOT_ALLOWED', 'Drive file URL is not allowed');
  }

  return url.toString();
}

function folderParams(name: string, parentId?: string): { name: string; parentId?: string } {
  return parentId === undefined ? { name } : { name, parentId };
}

function networkErrorFrom(error: unknown): NetworkError {
  return new NetworkError('NETWORK_ERROR', redactSensitiveText(error instanceof Error ? error.message : String(error)));
}

export function createSettingsDriveApi(options: SettingsDriveApiOptions): SettingsDriveApi {
  const fetchImpl = options.fetchImpl ?? createDefaultFetch();

  return {
    findFolder: (name, parentId) =>
      options.callEndpoint<unknown>('drive/folders/find', folderParams(name, parentId)).then(normalizeFolder),
    createFolder: (name, parentId) =>
      options.callEndpoint<unknown>('drive/folders/create', folderParams(name, parentId)).then(requireFolder),
    findFiles: (name, folderId) =>
      options.callEndpoint<unknown>('drive/files/find', { name, folderId }).then(normalizeFiles),
    showFile: (fileId) =>
      options.callEndpoint<unknown>('drive/files/show', { fileId }).then(requireFile),
    fetchJsonFile: async <T = unknown>(fileUrl: string) => {
      const url = allowedFileUrl(fileUrl);
      let response: Response;
      try {
        response = await fetchImpl(url);
      } catch (error) {
        throw networkErrorFrom(error);
      }

      if (!response.ok) {
        throw new ApiError(`HTTP_${response.status}`, response.statusText, response.status);
      }

      try {
        return await response.json() as T;
      } catch (error) {
        throw networkErrorFrom(error);
      }
    },
    createJsonFile: async (folderId, name, value) => {
      const json = JSON.stringify(value);
      if (json == null) {
        throw new ApiError('DRIVE_JSON_NOT_SERIALIZABLE', 'Settings JSON is not serializable');
      }

      const formData = new FormData();
      const token = options.tokenProvider();

      if (token != null && token !== '') {
        formData.set('i', token);
      }

      formData.set('folderId', folderId);
      formData.set('force', 'true');
      formData.set('isSensitive', 'false');
      formData.set('name', name);
      formData.set('file', new File([`${json}\n`], name, { type: 'application/json' }));

      const uploaded = await options.uploadFile(formData);
      return requireFile(uploaded);
    },
    deleteFile: async (fileId) => {
      await options.callEndpoint('drive/files/delete', { fileId });
    },
  };
}
