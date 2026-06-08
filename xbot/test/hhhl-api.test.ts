import { HhhlApiClient } from '../src/hhhl/apiClient';
import { createHhhlChatApi, normalizeChatMessage, normalizeMessages, normalizeRoom, normalizeUsers } from '../src/hhhl/chatApi';
import { createHhhlDriveApi, normalizeDriveFile } from '../src/hhhl/driveApi';
import type { HhhlEndpointCaller } from '../src/hhhl/types';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function createFetch(responses: Response[]): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: input.toString(), init });
    const response = responses.shift();
    if (response == null) throw new Error('Unexpected fetch call');
    return response;
  };

  return { fetchImpl, calls };
}

function requestBody(call: FetchCall): Record<string, unknown> {
  expect(typeof call.init?.body).toBe('string');
  return JSON.parse(call.init?.body as string) as Record<string, unknown>;
}

describe('HhhlApiClient', () => {
  it('posts endpoint calls as JSON with the HHHL token', async () => {
    const { fetchImpl, calls } = createFetch([jsonResponse({ id: 'me' })]);
    const client = new HhhlApiClient({
      baseUrl: 'https://hhhl.example/api/',
      token: 'secret-token',
      fetchImpl,
    });

    await expect(client.callEndpoint('chat/rooms/show', { roomId: 'room-1', i: 'caller-token' })).resolves.toEqual({ id: 'me' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://hhhl.example/api/chat/rooms/show');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(requestBody(calls[0])).toEqual({ i: 'secret-token', roomId: 'room-1' });
  });

  it('uploads drive FormData with token and force fields', async () => {
    const { fetchImpl, calls } = createFetch([jsonResponse({ id: 'file-1', name: 'report.txt' })]);
    const client = new HhhlApiClient({
      baseUrl: 'https://hhhl.example/api',
      token: 'secret-token',
      fetchImpl,
    });
    const formData = new FormData();
    formData.set('i', 'old-token');
    formData.set('file', new Blob(['hello'], { type: 'text/plain' }), 'report.txt');

    await expect(client.uploadFile(formData)).resolves.toEqual({ id: 'file-1', name: 'report.txt' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://hhhl.example/api/drive/files/create');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers).toBeUndefined();
    expect(calls[0].init?.body).toBeInstanceOf(FormData);
    const posted = calls[0].init?.body as FormData;
    expect(posted).not.toBe(formData);
    expect(formData.get('i')).toBe('old-token');
    expect(formData.has('force')).toBe(false);
    expect(posted.get('i')).toBe('secret-token');
    expect(posted.get('force')).toBe('true');
    expect(posted.get('file')).toBeInstanceOf(Blob);
  });

  it('throws useful API errors without leaking the token or request body', async () => {
    const token = 'secret-token';
    const fetchImpl: typeof fetch = async () => {
      throw new Error(`network failed for token ${token} and text secret body`);
    };
    const client = new HhhlApiClient({
      baseUrl: 'https://hhhl.example/api',
      token,
      fetchImpl,
    });

    const error = await client.callEndpoint('chat/messages/create-to-room', { text: 'secret body' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('HHHL endpoint chat/messages/create-to-room failed');
    expect((error as Error).message).not.toContain(token);
    expect((error as Error).message).not.toContain('secret body');
  });

  it('throws sanitized upload errors without leaking the token', async () => {
    const token = 'secret-token';
    const { fetchImpl } = createFetch([jsonResponse({ error: `bad token ${token}` }, { status: 403 })]);
    const client = new HhhlApiClient({
      baseUrl: 'https://hhhl.example/api',
      token,
      fetchImpl,
    });

    const error = await client.uploadFile(new FormData()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('HHHL upload failed with status 403');
    expect((error as Error).message).not.toContain(token);
  });
});

describe('HHHL chat wrappers and normalization', () => {
  it('calls chat endpoints and normalizes user, room, member, and message payloads', async () => {
    const calls: Array<{ endpoint: string; params?: object }> = [];
    const client: HhhlEndpointCaller = {
      callEndpoint: async <TResponse = unknown>(endpoint: string, params?: object): Promise<TResponse> => {
        calls.push({ endpoint, params });
        switch (endpoint) {
          case 'i':
            return { user: { userId: 'user-1', userName: 'Ada', avatarURL: 'https://cdn.example/a.png' } } as TResponse;
          case 'chat/rooms/show':
            return { room: { roomId: 'room-1', title: 'Ops' } } as TResponse;
          case 'chat/rooms/members':
            return [{ user: { id: 'user-2', username: 'grace' } }, { member: { userId: 'user-3', name: 'Lin' } }, 'user-4'] as TResponse;
          case 'chat/messages/room-timeline':
            return {
              timeline: [
                {
                  chatMessage: {
                    chatMessageId: 'msg-1',
                    toRoomId: 'room-1',
                    body: 'hello',
                    sender: { id: 'user-2', username: 'grace' },
                  },
                },
              ],
            } as TResponse;
          case 'chat/messages/create-to-room':
            return { message: { messageId: 'msg-2', roomId: 'room-1', text: 'created' } } as TResponse;
          default:
            throw new Error(`Unexpected endpoint ${endpoint}`);
        }
      },
    };
    const api = createHhhlChatApi(client);

    await expect(api.me()).resolves.toMatchObject({ id: 'user-1', username: 'Ada', avatarUrl: 'https://cdn.example/a.png' });
    await expect(api.showRoom('room-1')).resolves.toMatchObject({ id: 'room-1', name: 'Ops' });
    await expect(api.members('room-1', { limit: 3 })).resolves.toEqual([
      expect.objectContaining({ id: 'user-2', username: 'grace' }),
      expect.objectContaining({ id: 'user-3', username: 'Lin', name: 'Lin' }),
      expect.objectContaining({ id: 'user-4', username: 'user-4' }),
    ]);
    await expect(api.roomTimeline('room-1', { untilId: 'msg-9' })).resolves.toEqual([
      expect.objectContaining({ id: 'msg-1', roomId: 'room-1', text: 'hello' }),
    ]);
    await expect(api.createToRoom({ toRoomId: 'room-1', text: 'created' })).resolves.toMatchObject({
      id: 'msg-2',
      roomId: 'room-1',
      text: 'created',
    });

    expect(calls).toEqual([
      { endpoint: 'i', params: undefined },
      { endpoint: 'chat/rooms/show', params: { roomId: 'room-1' } },
      { endpoint: 'chat/rooms/members', params: { roomId: 'room-1', limit: 3 } },
      { endpoint: 'chat/messages/room-timeline', params: { roomId: 'room-1', untilId: 'msg-9' } },
      { endpoint: 'chat/messages/create-to-room', params: { toRoomId: 'room-1', text: 'created' } },
    ]);
  });

  it('normalizes expanded room, user, and message response shapes', () => {
    expect(normalizeRoom({ roomId: 'room-1', displayName: 'Display Room' })).toMatchObject({
      id: 'room-1',
      name: 'Display Room',
    });
    expect(normalizeRoom({ room: { _id: 'room-2', roomName: 'Nested Room' } })).toMatchObject({
      id: 'room-2',
      name: 'Nested Room',
    });

    expect(normalizeUsers([{ user: { accountId: 'u1', handle: 'ada' } }, { member: { username: 'lin' } }, 'u3'])).toEqual([
      expect.objectContaining({ id: 'u1', username: 'ada' }),
      expect.objectContaining({ id: 'lin', username: 'lin' }),
      expect.objectContaining({ id: 'u3', username: 'u3' }),
    ]);

    expect(normalizeChatMessage({ message: { id: 'm1', roomId: 'r1', content: 'one' } })).toMatchObject({
      id: 'm1',
      roomId: 'r1',
      text: 'one',
    });
    expect(normalizeChatMessage({ chatMessage: { chatMessageId: 'm2', toRoom: { id: 'r2' }, message: 'two' } })).toMatchObject({
      id: 'm2',
      roomId: 'r2',
      text: 'two',
    });
    expect(normalizeMessages({ messages: [{ id: 'm3' }] })).toEqual([expect.objectContaining({ id: 'm3' })]);
    expect(normalizeMessages({ items: [{ id: 'm4' }] })).toEqual([expect.objectContaining({ id: 'm4' })]);
    expect(normalizeMessages({ data: [{ id: 'm5' }] })).toEqual([expect.objectContaining({ id: 'm5' })]);
    expect(normalizeMessages([{ id: 'm6' }])).toEqual([expect.objectContaining({ id: 'm6' })]);
  });
});

describe('HHHL drive upload and normalization', () => {
  it('builds upload FormData and normalizes the uploaded drive file', async () => {
    const uploads: FormData[] = [];
    const client = {
      uploadFile: async (formData: FormData): Promise<unknown> => {
        uploads.push(formData);
        return {
          fileId: 'file-1',
          filename: 'report.txt',
          mimeType: 'text/plain',
          webUrl: '/files/file-1',
          thumbnailURL: '/thumb/file-1',
        };
      },
    };
    const api = createHhhlDriveApi(client);
    const blob = new Blob(['hello'], { type: 'text/plain' });

    await expect(api.upload({ blob, name: 'report.txt', type: 'text/plain' })).resolves.toMatchObject({
      id: 'file-1',
      name: 'report.txt',
      type: 'text/plain',
      url: 'https://dc.hhhl.cc/files/file-1',
      thumbnailUrl: 'https://dc.hhhl.cc/thumb/file-1',
    });

    const posted = uploads[0];
    expect(posted).toBeInstanceOf(FormData);
    if (!(posted instanceof FormData)) {
      throw new Error('Expected upload FormData');
    }
    expect(posted.get('name')).toBe('report.txt');
    const file = posted.get('file') as unknown;
    expect(file).toBeInstanceOf(Blob);
    if (!(file instanceof Blob)) {
      throw new Error('Expected upload Blob');
    }
    expect((file as Blob & { name?: string }).name).toBe('report.txt');
    expect(file.type).toBe('text/plain');
  });

  it('throws when an upload response cannot be normalized to a drive file id', async () => {
    const api = createHhhlDriveApi({
      uploadFile: async () => ({ name: 'missing-id.txt' }),
    });

    const error = await api.upload({ blob: new Blob(['hello']), name: 'missing-id.txt' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('HHHL drive upload failed with invalid response');
  });

  it('normalizes expanded drive file shapes and fallback file fields', () => {
    expect(normalizeDriveFile({
      driveFileId: 'file-1',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      webpublicUrl: 'https://cdn.example/photo.jpg',
      previewUrl: 'https://cdn.example/photo-thumb.jpg',
      byteSize: '42',
      metadata: { width: '640', height: 480 },
    })).toMatchObject({
      id: 'file-1',
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 42,
      url: 'https://cdn.example/photo.jpg',
      thumbnailUrl: 'https://cdn.example/photo-thumb.jpg',
      properties: { width: 640, height: 480 },
    });
    expect(normalizeDriveFile(null, {
      attachmentId: 'attachment-1',
      filename: 'fallback.bin',
      downloadURL: '/download/attachment-1',
      thumbnail: '/thumb/attachment-1',
    })).toMatchObject({
      id: 'attachment-1',
      name: 'fallback.bin',
      url: 'https://dc.hhhl.cc/download/attachment-1',
      thumbnailUrl: 'https://dc.hhhl.cc/thumb/attachment-1',
    });
    expect(normalizeDriveFile({ id: 'file-2', name: 'src.png', src: 'blob:src', downloadUrl: 'ignored' })).toMatchObject({
      id: 'file-2',
      url: 'blob:src',
    });
    expect(normalizeDriveFile({ id: 'file-3', name: 'data.png', src: 'data:image/png;base64,abc' })).toMatchObject({
      id: 'file-3',
      url: 'data:image/png;base64,abc',
    });
    expect(normalizeDriveFile({ id: 'file-4', name: 'http.png', thumbnail: 'http://cdn.example/thumb.png' })).toMatchObject({
      id: 'file-4',
      thumbnailUrl: 'http://cdn.example/thumb.png',
    });
  });
});
