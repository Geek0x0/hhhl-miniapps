import { describe, expect, it, vi } from 'vitest';
import { addUpload, failUpload, markUploadComplete, removeUpload, retryUpload, updateUploadProgress, validateUploadFile, MAX_UPLOAD_BYTES } from './uploadQueue';

describe('uploadQueue', () => {
  it('validates files against the 25 MB client limit', () => {
    expect(validateUploadFile(new File(['ok'], 'ok.txt'))).toEqual({ ok: true });

    const tooLarge = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'large.bin');

    expect(validateUploadFile(tooLarge)).toEqual({ ok: false, error: 'FILE_TOO_LARGE' });
  });

  it('adds, updates progress, removes, completes, fails, and retries uploads', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const queued = addUpload([], { id: 'upload-1', file, previewUrl: 'blob:preview' });
    const progressing = updateUploadProgress(queued, 'upload-1', 0.5);
    const complete = markUploadComplete(progressing, 'upload-1', 'file-1');
    const failed = failUpload(queued, 'upload-1', 'network');
    const retrying = retryUpload(failed, 'upload-1');

    expect(queued[0]).toMatchObject({ id: 'upload-1', status: 'queued', progress: 0, previewUrl: 'blob:preview' });
    expect(progressing[0]).toMatchObject({ status: 'uploading', progress: 0.5 });
    expect(complete[0]).toMatchObject({ status: 'uploaded', fileId: 'file-1', progress: 1 });
    expect(failed[0]).toMatchObject({ status: 'failed', error: 'network' });
    expect(retrying[0]).toMatchObject({ status: 'queued', error: null });
    expect(removeUpload(complete, 'upload-1')).toEqual([]);
  });

  it('uploads files and reports progress', async () => {
    const upload = vi.fn(async (_file: File, onProgress?: (progress: number) => void) => {
      onProgress?.(0.25);
      return { id: 'file-1', name: 'hello.txt' };
    });
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    let queue = addUpload([], { id: 'upload-1', file });

    const result = await upload(queue[0].file, (progress) => {
      queue = updateUploadProgress(queue, 'upload-1', progress);
    });
    queue = markUploadComplete(queue, 'upload-1', result.id);

    expect(upload).toHaveBeenCalled();
    expect(queue[0]).toMatchObject({ status: 'uploaded', fileId: 'file-1', progress: 1 });
  });
});
