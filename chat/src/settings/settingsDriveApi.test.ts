import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/shared/errors';
import { createSettingsDriveApi } from './settingsDriveApi';

describe('settingsDriveApi', () => {
  it('uses exact Drive folder and file endpoint payloads', async () => {
    const calls: Array<{ endpoint: string; params: object }> = [];
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (endpoint: string, params?: object) => {
        calls.push({ endpoint, params: params ?? {} });
        if (endpoint === 'drive/folders/find') return { id: 'folder-1', name: 'telegram-bot-chat' };
        if (endpoint === 'drive/folders/create') return { id: 'folder-2', name: 'telegram-bot-chat' };
        if (endpoint === 'drive/files/find') return [{ id: 'file-1', name: 'settings.json', url: '/files/settings.json' }];
        if (endpoint === 'drive/files/show') return { id: 'file-1', name: 'settings.json', url: '/files/settings.json' };
        if (endpoint === 'drive/files/delete') return { ok: true };
        return null;
      }) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFolder('telegram-bot-chat')).resolves.toEqual({ id: 'folder-1', name: 'telegram-bot-chat' });
    await expect(api.createFolder('telegram-bot-chat')).resolves.toEqual({ id: 'folder-2', name: 'telegram-bot-chat' });
    await expect(api.findFiles('settings.json', 'folder-1')).resolves.toEqual([{ id: 'file-1', name: 'settings.json', url: 'https://dc.hhhl.cc/files/settings.json' }]);
    await expect(api.showFile('file-1')).resolves.toEqual({ id: 'file-1', name: 'settings.json', url: 'https://dc.hhhl.cc/files/settings.json' });
    await api.deleteFile('file-1');

    expect(calls).toEqual([
      { endpoint: 'drive/folders/find', params: { name: 'telegram-bot-chat' } },
      { endpoint: 'drive/folders/create', params: { name: 'telegram-bot-chat' } },
      { endpoint: 'drive/files/find', params: { name: 'settings.json', folderId: 'folder-1' } },
      { endpoint: 'drive/files/show', params: { fileId: 'file-1' } },
      { endpoint: 'drive/files/delete', params: { fileId: 'file-1' } },
    ]);
  });

  it('sends optional parentId for folder lookup and creation', async () => {
    const calls: Array<{ endpoint: string; params: object }> = [];
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (endpoint: string, params?: object) => {
        calls.push({ endpoint, params: params ?? {} });
        if (endpoint === 'drive/folders/find') return { id: 'folder-1', name: 'child' };
        if (endpoint === 'drive/folders/create') return { id: 'folder-2', name: 'child' };
        return null;
      }) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFolder('child', 'parent-1')).resolves.toEqual({ id: 'folder-1', name: 'child' });
    await expect(api.createFolder('child', 'parent-1')).resolves.toEqual({ id: 'folder-2', name: 'child' });

    expect(calls).toEqual([
      { endpoint: 'drive/folders/find', params: { name: 'child', parentId: 'parent-1' } },
      { endpoint: 'drive/folders/create', params: { name: 'child', parentId: 'parent-1' } },
    ]);
  });

  it('rejects invalid folder and file responses with contract error codes', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (endpoint: string) => {
        if (endpoint === 'drive/folders/create') return null;
        if (endpoint === 'drive/files/show') return null;
        return null;
      }) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.createFolder('child')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.showFile('file-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
  });

  it('normalizes path-relative file URLs against the Drive origin', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (endpoint: string) => {
        if (endpoint === 'drive/files/find') {
          return [{ id: 'file-1', name: 'settings.json', url: 'files/settings.json' }];
        }
        if (endpoint === 'drive/files/show') {
          return { id: 'file-1', name: 'settings.json', url: 'files/settings.json' };
        }
        return null;
      }) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFiles('settings.json', 'folder-1')).resolves.toEqual([
      { id: 'file-1', name: 'settings.json', url: 'https://dc.hhhl.cc/files/settings.json' },
    ]);
    await expect(api.showFile('file-1')).resolves.toEqual({
      id: 'file-1',
      name: 'settings.json',
      url: 'https://dc.hhhl.cc/files/settings.json',
    });
  });

  it('creates JSON config files with token, folderId, force flag, and JSON blob', async () => {
    const uploadFile = vi.fn(async (formData: FormData) => {
      expect(formData.get('i')).toBe('secret-token');
      expect(formData.get('folderId')).toBe('folder-1');
      expect(formData.get('force')).toBe('true');
      expect(formData.get('isSensitive')).toBe('false');
      expect(formData.get('name')).toBe('settings.json');
      const file = formData.get('file');
      expect(file).toBeInstanceOf(File);
      expect((file as File).name).toBe('settings.json');
      expect((file as File).type).toBe('application/json');
      expect(await (file as File).text()).toBe('{"ok":true}\n');
      return { id: 'file-2', name: 'settings.json', url: '/files/settings.json' };
    });
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: uploadFile as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.createJsonFile('folder-1', 'settings.json', { ok: true })).resolves.toEqual({
      id: 'file-2',
      name: 'settings.json',
      url: 'https://dc.hhhl.cc/files/settings.json',
    });
  });

  it('rejects invalid JSON config upload responses', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn(async () => ({ name: 'settings.json' })) as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.createJsonFile('folder-1', 'settings.json', { ok: true })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
  });

  it('fetches JSON only from allowed dc.hhhl.cc file URLs without appending a token', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe('https://dc.hhhl.cc/files/settings.json?download=1');
      expect(String(input)).not.toContain('secret-token');
      return Response.json({ ok: true });
    });
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(api.fetchJsonFile('/files/settings.json?download=1')).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects external file URLs and unreadable file responses', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn(async () => new Response('not found', { status: 404, statusText: 'Not Found' })) as never,
    });

    await expect(api.fetchJsonFile('https://evil.example/settings.json')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
    await expect(api.fetchJsonFile('https://dc.hhhl.cc/files/missing.json')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'HTTP_404',
    } satisfies Partial<ApiError>);
  });

  it('maps fetch and JSON read failures to redacted NetworkError', async () => {
    const failedFetchApi = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn(async () => {
        throw new Error('request failed https://dc.hhhl.cc/files/settings.json?i=secret-token token=secret-token');
      }) as never,
    });
    const invalidJsonApi = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn(async () => new Response('not json', { status: 200 })) as never,
    });

    await expect(failedFetchApi.fetchJsonFile('https://dc.hhhl.cc/files/settings.json')).rejects.toMatchObject({
      name: 'NetworkError',
      code: 'NETWORK_ERROR',
      message: 'request failed https://dc.hhhl.cc/files/settings.json?i=[redacted] token=[redacted]',
    } satisfies Partial<NetworkError>);
    await expect(invalidJsonApi.fetchJsonFile('https://dc.hhhl.cc/files/settings.json')).rejects.toMatchObject({
      name: 'NetworkError',
      code: 'NETWORK_ERROR',
    } satisfies Partial<NetworkError>);
  });
});
