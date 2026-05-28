import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/shared/errors';
import { capturedRequests } from '@/test/handlers';
import { setupMswServer } from '@/test/server';
import { ApiClient } from './apiClient';

setupMswServer();

describe('ApiClient', () => {
  it('posts endpoint params with the current token', async () => {
    const client = new ApiClient({
      baseUrl: 'https://dc.hhhl.cc/api',
      tokenProvider: () => 'secret-token',
    });

    const response = await client.callEndpoint<{ id: string; name: string }>('chat/rooms/show', { roomId: 'abc' });

    expect(response).toEqual({ id: 'abc', name: 'Room ABC' });
    expect(capturedRequests).toEqual([
      {
        url: 'https://dc.hhhl.cc/api/chat/rooms/show',
        body: { roomId: 'abc', i: 'secret-token' },
      },
    ]);
  });

  it('maps non-200 responses to redacted ApiError', async () => {
    const client = new ApiClient({
      baseUrl: 'https://dc.hhhl.cc/api',
      tokenProvider: () => 'secret-token',
    });

    await expect(client.callEndpoint('fail', {})).rejects.toMatchObject({
      name: 'ApiError',
      code: 'FAILED',
      status: 403,
      message: 'token=[redacted]',
    } satisfies Partial<ApiError>);
  });

  it('aborts requests that exceed timeout', async () => {
    const client = new ApiClient({
      baseUrl: 'https://dc.hhhl.cc/api',
      tokenProvider: () => null,
      timeoutMs: 1,
    });

    await expect(client.callEndpoint('slow', {})).rejects.toBeInstanceOf(NetworkError);
  });

  it('uploads FormData to drive/files/create with progress callback', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body;

      expect(body).toBeInstanceOf(FormData);
      expect((body as FormData).get('i')).toBe('secret-token');
      expect((body as FormData).get('force')).toBe('true');
      expect((body as FormData).get('name')).toBe('hello.txt');
      expect((body as FormData).get('file')).toBeInstanceOf(File);

      return new Response(JSON.stringify({ id: 'file-1', name: 'hello.txt' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = new ApiClient({
      baseUrl: 'https://dc.hhhl.cc/api',
      tokenProvider: () => 'secret-token',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const formData = new FormData();
    const progress = vi.fn();

    formData.set('i', 'secret-token');
    formData.set('force', 'true');
    formData.set('name', 'hello.txt');
    formData.set('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));

    await expect(client.uploadFile(formData, progress)).resolves.toEqual({ id: 'file-1', name: 'hello.txt' });
    expect(progress).toHaveBeenCalledWith(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://dc.hhhl.cc/api/drive/files/create', expect.objectContaining({
      method: 'POST',
      body: formData,
    }));
  });
});
