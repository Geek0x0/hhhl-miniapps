import { describe, expect, it } from 'vitest';
import { ApiClient } from '@/api/apiClient';
import { createFileApi } from './fileApi';

describe('fileApi', () => {
  it('uploads files with token, force flag, file, and name', async () => {
    const api = createFileApi({
      uploadFile: async (formData) => {
        expect(formData.get('i')).toBe('secret-token');
        expect(formData.get('force')).toBe('true');
        expect(formData.get('name')).toBe('hello.txt');
        expect(formData.get('file')).toBeInstanceOf(File);
        return { id: 'file-1', name: 'hello.txt' };
      },
      tokenProvider: () => 'secret-token',
    });

    await expect(api.upload(new File(['hello'], 'hello.txt', { type: 'text/plain' }))).resolves.toMatchObject({
      id: 'file-1',
      name: 'hello.txt',
    });
  });

  it('normalizes relative Drive file URLs returned by upload', async () => {
    const api = createFileApi({
      uploadFile: async () => ({
        id: 'file-1',
        name: 'photo.png',
        type: 'image/png',
        url: '/files/photo.png',
        thumbnailUrl: '/files/photo-thumb.png',
        blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
        isSensitive: true,
        properties: { width: 640, height: 480 },
      }),
      tokenProvider: () => 'secret-token',
    });

    await expect(api.upload(new File(['photo'], 'photo.png', { type: 'image/png' }))).resolves.toMatchObject({
      id: 'file-1',
      name: 'photo.png',
      type: 'image/png',
      url: 'https://dc.hhhl.cc/files/photo.png',
      thumbnailUrl: 'https://dc.hhhl.cc/files/photo-thumb.png',
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      isSensitive: true,
      properties: { width: 640, height: 480 },
    });
  });

  it('accepts the shared ApiClient as its upload transport', async () => {
    const apiClient = new ApiClient({
      baseUrl: 'https://dc.hhhl.cc/api',
      tokenProvider: () => 'secret-token',
      fetchImpl: async (_url, init) => {
        const body = init?.body as FormData;

        expect(body.get('i')).toBe('secret-token');
        expect(body.get('force')).toBe('true');
        expect(body.get('name')).toBe('hello.txt');
        expect(body.get('file')).toBeInstanceOf(File);

        return new Response(JSON.stringify({ id: 'file-1', name: 'hello.txt' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    const api = createFileApi(apiClient);

    await expect(api.upload(new File(['hello'], 'hello.txt', { type: 'text/plain' }))).resolves.toMatchObject({
      id: 'file-1',
      name: 'hello.txt',
    });
  });
});
