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

  it('treats empty Drive folder find arrays as missing folders', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async () => []) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFolder('telegram-bot-chat')).resolves.toBeNull();
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

  it('rejects folder responses without real ids', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async () => ({ name: 'telegram-bot-chat' })) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.createFolder('telegram-bot-chat')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
  });

  it('rejects folder responses without real names', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async () => ({ id: 'folder-1' })) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.createFolder('telegram-bot-chat')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
  });

  it('distinguishes missing folders from malformed folder lookup responses', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (_endpoint: string, params?: { name?: string }) => {
        if (params?.name === 'missing') return null;
        if (params?.name === 'bad-direct') return { name: 'telegram-bot-chat' };
        if (params?.name === 'bad-nested') return { folder: { name: 'telegram-bot-chat' } };
        if (params?.name === 'bad-empty-nested') return { folder: {} };
        if (params?.name === 'bad-data-empty-nested') return { data: { folder: {} } };
        if (params?.name === 'bad-result-empty-nested') return { result: { folder: {} } };
        if (params?.name === 'bad-blank-id') return { folderId: '' };
        return null;
      }) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFolder('missing')).resolves.toBeNull();
    await expect(api.findFolder('bad-direct')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.findFolder('bad-nested')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.findFolder('bad-empty-nested')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.findFolder('bad-data-empty-nested')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.findFolder('bad-result-empty-nested')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.findFolder('bad-blank-id')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FOLDER_INVALID',
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

  it('rejects malformed Drive file URL fields', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (endpoint: string) => {
        if (endpoint === 'drive/files/find') {
          return [{ id: 'file-1', name: 'settings.json', url: 'http://[bad-url' }];
        }
        if (endpoint === 'drive/files/show') {
          return { id: 'file-1', name: 'settings.json', url: 'http://[bad-url' };
        }
        return null;
      }) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFiles('settings.json', 'folder-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.showFile('file-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
  });

  it('rejects non-string Drive file URL fields', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (endpoint: string) => {
        if (endpoint === 'drive/files/find') {
          return [{ id: 'file-1', name: 'settings.json', url: 123 }];
        }
        if (endpoint === 'drive/files/show') {
          return { id: 'file-1', name: 'settings.json', thumbnailUrl: 123 };
        }
        return null;
      }) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFiles('settings.json', 'folder-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.showFile('file-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
  });

  it('treats empty Drive file find responses as no matching files', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async () => null) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFiles('settings.json', 'folder-1')).resolves.toEqual([]);
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

  it('rejects Drive file responses without real names', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn(async (endpoint: string) => {
        if (endpoint === 'drive/files/find') return [{ id: 'file-1' }];
        if (endpoint === 'drive/files/show') return { id: 'file-1' };
        return null;
      }) as never,
      uploadFile: vi.fn(async () => ({ id: 'file-1' })) as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.findFiles('settings.json', 'folder-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.showFile('file-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
    await expect(api.createJsonFile('folder-1', 'settings.json', { ok: true })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
  });

  it('rejects non-serializable JSON config values', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.createJsonFile('folder-1', 'settings.json', { value: BigInt(1) })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_JSON_NOT_SERIALIZABLE',
    } satisfies Partial<ApiError>);
  });

  it('redacts ApiError messages thrown during JSON serialization', async () => {
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(api.createJsonFile('folder-1', 'settings.json', {
      toJSON() {
        throw new ApiError('OTHER', 'token=secret-token');
      },
    })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_JSON_NOT_SERIALIZABLE',
      message: 'token=[redacted]',
    } satisfies Partial<ApiError>);
  });

  it('fetches JSON only from allowed dc.hhhl.cc file URLs without appending a token', async () => {
    const tokenProvider = vi.fn(() => 'secret-token');
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://dc.hhhl.cc/files/settings.json?download=1');
      expect(String(input)).not.toContain('secret-token');
      expect(init).toMatchObject({ redirect: 'error', credentials: 'omit' });
      return Response.json({ ok: true });
    });
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(api.fetchJsonFile('/files/settings.json?download=1')).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(tokenProvider).not.toHaveBeenCalled();
  });

  it('rejects token-bearing file URLs before fetching', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(api.fetchJsonFile('https://dc.hhhl.cc/files/settings.json?i=secret-token')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
    await expect(api.fetchJsonFile('https://dc.hhhl.cc/files/settings.json?token=secret-token')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects non-HTTPS and credentialed file URLs before fetching', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(api.fetchJsonFile('blob:https://dc.hhhl.cc/files/settings.json')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
    await expect(api.fetchJsonFile('https://user:pass@dc.hhhl.cc/files/settings.json')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects redirected file response URLs outside the Drive origin', async () => {
    const response = Response.json({ ok: true });
    Object.defineProperty(response, 'url', { value: 'https://evil.example/files/settings.json' });
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init).toMatchObject({ redirect: 'error' });
      return response;
    });
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(api.fetchJsonFile('https://dc.hhhl.cc/files/settings.json')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
  });

  it('rejects blob file response URLs inside the Drive origin', async () => {
    const response = Response.json({ ok: true });
    Object.defineProperty(response, 'url', { value: 'blob:https://dc.hhhl.cc/files/settings.json' });
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn(async () => response) as never,
    });

    await expect(api.fetchJsonFile('https://dc.hhhl.cc/files/settings.json')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
  });

  it('validates redirected file response URLs before HTTP status errors', async () => {
    const response = new Response('{}', { status: 404, statusText: 'Not Found' });
    Object.defineProperty(response, 'url', { value: 'https://evil.example/settings.json' });
    const api = createSettingsDriveApi({
      callEndpoint: vi.fn() as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn(async () => response) as never,
    });

    await expect(api.fetchJsonFile('https://dc.hhhl.cc/files/settings.json')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_URL_NOT_ALLOWED',
    } satisfies Partial<ApiError>);
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

  it('rejects malformed file find responses and invalid file list items', async () => {
    const malformedApi = createSettingsDriveApi({
      callEndpoint: vi.fn(async () => ({ ok: true })) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });
    const invalidItemApi = createSettingsDriveApi({
      callEndpoint: vi.fn(async () => [{ name: 'settings.json' }]) as never,
      uploadFile: vi.fn() as never,
      tokenProvider: () => 'secret-token',
      fetchImpl: vi.fn() as never,
    });

    await expect(malformedApi.findFiles('settings.json', 'folder-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
    } satisfies Partial<ApiError>);
    await expect(invalidItemApi.findFiles('settings.json', 'folder-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'DRIVE_FILE_INVALID',
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
