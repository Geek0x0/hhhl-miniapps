import type { DriveUploadParams, HhhlDriveFile, HhhlUploadClient } from './types';

const HHHL_DRIVE_BASE_URL = 'https://dc.hhhl.cc';

function recordField(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
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

function numberField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function booleanField(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function stringFrom(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringLikeField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function recordFrom(raw: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = recordField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function urlFrom(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringField(raw[key]);
    if (value != null) {
      return normalizeDriveUrl(value);
    }
  }

  return null;
}

function normalizeDriveUrl(value: string): string {
  return value.startsWith('/') ? `${HHHL_DRIVE_BASE_URL}${value}` : value;
}

function normalizeDriveFileProperties(source: Record<string, unknown>): HhhlDriveFile['properties'] {
  const rawProperties = recordField(source.properties) ?? recordField(source.metadata) ?? {};
  const width = numberField(rawProperties.width ?? source.width);
  const height = numberField(rawProperties.height ?? source.height);

  return width == null && height == null ? null : { width, height };
}

function driveFileSource(value: unknown): Record<string, unknown> | string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  const raw = recordField(value);
  if (raw == null) {
    return null;
  }

  return recordFrom(raw, ['file', 'driveFile', 'attachment']) ?? raw;
}

export function normalizeDriveFile(value: unknown, fallback: Record<string, unknown> = {}): HhhlDriveFile | null {
  const sourceValue = driveFileSource(value);
  const raw = typeof sourceValue === 'string' ? { id: sourceValue, name: sourceValue } : sourceValue;

  if (raw == null && stringFrom(fallback, ['fileId', 'driveFileId', 'attachmentId', 'fileName', 'filename']) == null) {
    return null;
  }

  const source = raw ?? fallback;
  const id = stringFrom(source, raw == null ? ['fileId', 'driveFileId', 'attachmentId', 'fileName', 'filename'] : ['id', 'fileId', 'driveFileId', 'attachmentId']);
  const name = stringFrom(source, ['name', 'fileName', 'filename', 'originalName', 'title']) ?? id;

  if (id == null && name == null) {
    return null;
  }

  return {
    id: id ?? name ?? '',
    name: name ?? id ?? '',
    type: stringFrom(source, ['type', 'mimeType', 'contentType', 'mediaType']),
    size: numberField(source.size ?? source.byteSize ?? source.length),
    url: urlFrom(source, ['webpublicUrl', 'webUrl', 'url', 'src', 'downloadUrl', 'downloadURL']),
    thumbnailUrl: urlFrom(source, ['thumbnailUrl', 'thumbnailURL', 'thumbnail', 'previewUrl', 'previewURL']),
    blurhash: stringFrom(source, ['blurhash', 'blurHash']),
    isSensitive: booleanField(source.isSensitive ?? source.sensitive),
    properties: normalizeDriveFileProperties(source),
  };
}

export function createHhhlDriveApi(client: HhhlUploadClient) {
  return {
    upload: async (params: DriveUploadParams): Promise<HhhlDriveFile> => {
      const formData = new FormData();
      const blob = params.type == null || params.type === params.blob.type ? params.blob : new Blob([params.blob], { type: params.type });

      formData.set('file', blob, params.name);
      formData.set('name', params.name);

      const uploaded = await client.uploadFile(formData);
      const normalized = normalizeDriveFile(uploaded);
      if (normalized == null || normalized.id === '' || !hasExplicitDriveFileId(uploaded)) {
        throw new Error('HHHL drive upload failed with invalid response');
      }

      return normalized;
    },
  };
}

function hasExplicitDriveFileId(value: unknown): boolean {
  const source = driveFileSource(value);
  if (typeof source === 'string') {
    return source !== '';
  }

  if (source == null) {
    return false;
  }

  return stringFrom(source, ['id', 'fileId', 'driveFileId', 'attachmentId']) != null;
}
