import type { DriveFile } from '@/shared/types';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type UploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  previewUrl?: string;
  fileId?: string;
  error?: string | null;
}

export interface AddUploadOptions {
  id: string;
  file: File;
  previewUrl?: string;
}

export type UploadValidation = { ok: true } | { ok: false; error: 'FILE_TOO_LARGE' };

export interface UploadTransport {
  upload: (file: File, onProgress?: (progress: number) => void) => Promise<DriveFile>;
}

export function validateUploadFile(file: File): UploadValidation {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'FILE_TOO_LARGE' };
  }

  return { ok: true };
}

export function addUpload(queue: UploadItem[], options: AddUploadOptions): UploadItem[] {
  return [...queue, { id: options.id, file: options.file, status: 'queued', progress: 0, previewUrl: options.previewUrl, error: null }];
}

function mapUpload(queue: UploadItem[], id: string, mapper: (item: UploadItem) => UploadItem): UploadItem[] {
  return queue.map((item) => item.id === id ? mapper(item) : item);
}

export function removeUpload(queue: UploadItem[], id: string): UploadItem[] {
  return queue.filter((item) => item.id !== id);
}

export function updateUploadProgress(queue: UploadItem[], id: string, progress: number): UploadItem[] {
  return mapUpload(queue, id, (item) => ({ ...item, status: 'uploading', progress }));
}

export function markUploadComplete(queue: UploadItem[], id: string, fileId: string): UploadItem[] {
  return mapUpload(queue, id, (item) => ({ ...item, status: 'uploaded', progress: 1, fileId, error: null }));
}

export function failUpload(queue: UploadItem[], id: string, error: string): UploadItem[] {
  return mapUpload(queue, id, (item) => ({ ...item, status: 'failed', error }));
}

export function retryUpload(queue: UploadItem[], id: string): UploadItem[] {
  return mapUpload(queue, id, (item) => ({ ...item, status: 'queued', progress: 0, error: null }));
}
