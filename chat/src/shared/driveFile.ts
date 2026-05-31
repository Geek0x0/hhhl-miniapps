import { DC_HHHL_ORIGIN } from './config';
import type { DriveFile } from './types';

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

function recordField(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
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

function urlField(value: unknown): string | null {
  const url = stringField(value);
  if (url == null) {
    return null;
  }

  if (/^(?:https?:|blob:|data:)/.test(url)) {
    return url;
  }

  return url.startsWith('/') ? `${DC_HHHL_ORIGIN}${url}` : url;
}

function urlFrom(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = urlField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function normalizeDriveFileProperties(source: Record<string, unknown>): DriveFile['properties'] {
  const rawProperties = recordField(source.properties) ?? recordField(source.metadata) ?? {};
  const width = numberField(rawProperties.width ?? source.width);
  const height = numberField(rawProperties.height ?? source.height);

  return width == null && height == null ? null : { width, height };
}

export function normalizeDriveFile(value: unknown, fallback: Record<string, unknown> = {}): DriveFile | null {
  const raw = recordField(value) ?? (typeof value === 'string' ? { id: value, name: value } : null);
  if (raw == null && stringFrom(fallback, ['fileId', 'driveFileId', 'attachmentId', 'fileName', 'filename']) == null) {
    return null;
  }

  const source = raw ?? fallback;
  const id = stringFrom(source, raw == null ? ['fileId', 'driveFileId', 'attachmentId'] : ['id', 'fileId', 'driveFileId', 'attachmentId']);
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
