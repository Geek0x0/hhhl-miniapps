import type { TelegramMedia, TelegramMessageKind } from './types';

type TelegramDownloadKind = Extract<TelegramMessageKind, 'photo' | 'document' | 'video' | 'voice'>;

export interface TelegramMediaDownloader {
  getFilePath(fileId: string): Promise<string>;
  downloadFile(filePath: string): Promise<Blob>;
}

export interface DownloadedTelegramMedia {
  blob: Blob;
  name: string;
  type: string;
}

const downloadExtensions: Record<TelegramDownloadKind, string> = {
  photo: 'jpg',
  document: 'bin',
  video: 'mp4',
  voice: 'ogg',
};

export async function downloadTelegramMedia(
  api: TelegramMediaDownloader,
  media: TelegramMedia,
  kind: TelegramMessageKind = 'document',
): Promise<DownloadedTelegramMedia> {
  const filePath = await api.getFilePath(media.fileId);
  const blob = await api.downloadFile(filePath);

  return {
    blob,
    name: selectTelegramDownloadName(media, kind),
    type: (media.mimeType ?? blob.type) || 'application/octet-stream',
  };
}

export function selectTelegramDownloadName(media: TelegramMedia, kind: TelegramMessageKind = 'document'): string {
  const explicitName = sanitizeTelegramFileName(media.fileName);
  if (explicitName) return explicitName;

  const downloadKind = downloadKindFrom(kind);
  return `${downloadKind}-${safeNamePart(media.fileId)}.${downloadExtensions[downloadKind]}`;
}

function sanitizeTelegramFileName(fileName: string | undefined): string | null {
  const trimmed = fileName?.trim();
  if (!trimmed) return null;

  const baseName = trimmed.split(/[\\/]+/).filter(Boolean).pop() ?? '';
  const safe = baseName.replace(/[\x00-\x1F\x7F]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || null;
}

function safeNamePart(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'file';
}

function downloadKindFrom(kind: TelegramMessageKind): TelegramDownloadKind {
  return kind === 'photo' || kind === 'video' || kind === 'voice' || kind === 'document' ? kind : 'document';
}
