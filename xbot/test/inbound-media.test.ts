import { forwardTelegramMessageToHhhl } from '../src/bridge/inbound';
import { handleRequest } from '../src/http';
import { createKeys } from '../src/state/keys';
import { KvStateStore } from '../src/state/kvStore';
import type { BindingState, MessageMapState } from '../src/state/schemas';
import type { TelegramMessage } from '../src/telegram/types';
import { createTestEnv } from './fakes';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

type CreateParams = {
  toRoomId: string;
  text?: string;
  fileId?: string;
  replyId?: string;
  quoteId?: string;
};

type MediaFailureOptions = {
  failDownload?: boolean;
  failUpload?: boolean;
  failCreate?: boolean;
  expectCreate: boolean;
};

function storeFor(env = createTestEnv()): KvStateStore {
  return new KvStateStore(env.XBOT_STATE, createKeys(env.KV_KEY_PREFIX ?? 'xbot'));
}

async function seedBinding(store: KvStateStore, overrides: Partial<BindingState> = {}): Promise<BindingState> {
  const binding: BindingState = {
    version: 1,
    telegramUserId: '42',
    roomId: 'room-1',
    roomName: 'Ops',
    boundAt: '2026-06-08T00:00:00.000Z',
    lastSeenMessageId: null,
    ...overrides,
  };
  await store.setBinding(binding);
  return binding;
}

async function seedMessageMap(store: KvStateStore, overrides: Partial<MessageMapState> = {}): Promise<MessageMapState> {
  const map: MessageMapState = {
    version: 1,
    roomId: 'room-1',
    hhhlMessageId: 'hhhl-reply-1',
    telegramUserId: '42',
    telegramMessageId: 100,
    createdAt: '2026-06-08T00:00:01.000Z',
    ...overrides,
  };
  await store.putMessageMap(map);
  return map;
}

function mediaMessage(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    messageId: 101,
    chatId: 42,
    chatType: 'private',
    fromId: 42,
    kind: 'photo',
    caption: '  media caption  ',
    media: {
      fileId: 'telegram-file-1',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    },
    ...overrides,
  };
}

function createForwardingFakes() {
  const downloaded = {
    blob: new Blob(['telegram bytes'], { type: 'image/jpeg' }),
    name: 'photo.jpg',
    type: 'image/jpeg',
  };
  const mediaDownloader = vi.fn(async () => downloaded);
  const driveApi = {
    upload: vi.fn(async () => ({
      id: 'drive-file-1',
      name: downloaded.name,
      type: downloaded.type,
    })),
  };
  const chatApi = {
    createToRoom: vi.fn(async (params: CreateParams) => ({
      id: 'hhhl-created-1',
      roomId: params.toRoomId,
      createdAt: '2026-06-08T00:00:03.000Z',
      text: params.text,
      file: params.fileId == null ? null : { id: params.fileId, name: downloaded.name },
    })),
  };
  const telegram = {
    sendMessage: vi.fn(async () => ({ messageId: 301 })),
  };

  return { chatApi, driveApi, downloaded, mediaDownloader, telegram };
}

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function requestBody(call: FetchCall): Record<string, unknown> {
  expect(typeof call.init?.body).toBe('string');
  return JSON.parse(call.init?.body as string) as Record<string, unknown>;
}

function photoUpdate(): Record<string, unknown> {
  return {
    update_id: 1,
    message: {
      message_id: 101,
      caption: '  photo caption  ',
      from: { id: 42, is_bot: false, first_name: 'K' },
      chat: { id: 42, type: 'private' },
      photo: [
        { file_id: 'small-photo-file', width: 320, height: 200, file_size: 1000 },
        { file_id: 'large-photo-file', width: 1280, height: 720, file_size: 9000 },
      ],
    },
  };
}

function documentUpdate(): Record<string, unknown> {
  return {
    update_id: 2,
    message: {
      message_id: 102,
      caption: '  document caption  ',
      from: { id: 42, is_bot: false, first_name: 'K' },
      chat: { id: 42, type: 'private' },
      document: {
        file_id: 'document-file',
        file_name: 'report.pdf',
        mime_type: 'application/pdf',
        file_size: 1234,
      },
    },
  };
}

const mediaFailureCases: Array<[string, MediaFailureOptions]> = [
  ['download', { failDownload: true, expectCreate: false }],
  ['upload', { failUpload: true, expectCreate: false }],
  ['create', { failCreate: true, expectCreate: true }],
];

async function postUpdate(update: unknown, env = createTestEnv({ HHHL_API_BASE_URL: 'https://hhhl.example/api' })): Promise<Response> {
  return handleRequest(
    new Request('https://xbot.example.com/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': env.BOT_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify(update),
    }),
    env,
    {} as ExecutionContext,
  );
}

describe('Telegram inbound media forwarding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads media, uploads it to Drive, creates an HHHL file message with caption, and stores the map', async () => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, driveApi, downloaded, mediaDownloader, telegram } = createForwardingFakes();
    const message = mediaMessage();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi,
      mediaDownloader,
      telegramUserId: '42',
      message,
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(mediaDownloader).toHaveBeenCalledWith(message);
    expect(driveApi.upload).toHaveBeenCalledWith(downloaded);
    expect(chatApi.createToRoom).toHaveBeenCalledWith({
      toRoomId: 'room-1',
      fileId: 'drive-file-1',
      text: 'media caption',
    });
    await expect(state.getMessageMapByTelegram('42', 101)).resolves.toEqual({
      version: 1,
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-created-1',
      telegramUserId: '42',
      telegramMessageId: 101,
      createdAt: '2026-06-08T00:00:04.000Z',
    });
  });

  it('uses same-room reply mapping for media replyId and quoteId', async () => {
    const state = storeFor();
    await seedBinding(state);
    await seedMessageMap(state, { roomId: 'room-1', hhhlMessageId: 'hhhl-reply-1', telegramMessageId: 100 });
    const { chatApi, driveApi, mediaDownloader, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi,
      mediaDownloader,
      telegramUserId: '42',
      message: mediaMessage({ replyToMessageId: 100 }),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).toHaveBeenCalledWith({
      toRoomId: 'room-1',
      fileId: 'drive-file-1',
      text: 'media caption',
      replyId: 'hhhl-reply-1',
      quoteId: 'hhhl-reply-1',
    });
  });

  it('omits text from HHHL media create params when the Telegram media has no caption', async () => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, driveApi, mediaDownloader, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi,
      mediaDownloader,
      telegramUserId: '42',
      message: mediaMessage({ caption: undefined }),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).toHaveBeenCalledWith({
      toRoomId: 'room-1',
      fileId: 'drive-file-1',
    });
    expect(chatApi.createToRoom.mock.calls[0][0]).not.toHaveProperty('text');
  });

  it('does not download, upload, or create another HHHL message for duplicate media in the same room', async () => {
    const state = storeFor();
    await seedBinding(state);
    await seedMessageMap(state, {
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-created-1',
      telegramMessageId: 101,
      createdAt: '2026-06-08T00:00:04.000Z',
    });
    const { chatApi, driveApi, mediaDownloader, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi,
      mediaDownloader,
      telegramUserId: '42',
      message: mediaMessage(),
      now: () => '2026-06-08T00:00:05.000Z',
    });

    expect(mediaDownloader).not.toHaveBeenCalled();
    expect(driveApi.upload).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    await expect(state.getMessageMapByTelegram('42', 101)).resolves.toMatchObject({
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-created-1',
      createdAt: '2026-06-08T00:00:04.000Z',
    });
  });

  it.each(mediaFailureCases)('sends a Telegram failure notice and does not store a map when media %s fails', async (_label, options) => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, driveApi, mediaDownloader, telegram } = createForwardingFakes();
    if (options.failDownload) {
      mediaDownloader.mockRejectedValueOnce(new Error('download failed'));
    }
    if (options.failUpload) {
      driveApi.upload.mockRejectedValueOnce(new Error('upload failed'));
    }
    if (options.failCreate) {
      chatApi.createToRoom.mockRejectedValueOnce(new Error('create failed'));
    }

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi,
      mediaDownloader,
      telegramUserId: '42',
      message: mediaMessage(),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(chatApi.createToRoom).toHaveBeenCalledTimes(options.expectCreate ? 1 : 0);
    expect(telegram.sendMessage).toHaveBeenCalledWith(42, '媒体发送失败');
    await expect(state.getMessageMapByTelegram('42', 101)).resolves.toBeNull();
  });

  it('sends an unsupported-message notice for media when Drive or media downloading is unavailable', async () => {
    const state = storeFor();
    await seedBinding(state);
    const { chatApi, mediaDownloader, telegram } = createForwardingFakes();

    await forwardTelegramMessageToHhhl({
      state,
      chatApi,
      telegram,
      driveApi: null,
      mediaDownloader,
      telegramUserId: '42',
      message: mediaMessage(),
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(mediaDownloader).not.toHaveBeenCalled();
    expect(chatApi.createToRoom).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(42, '暂不支持这类 Telegram 消息。');
  });

  it.each([
    ['photo', photoUpdate(), 'large-photo-file', 'photo-large-photo-file.jpg', 'photo caption', 101],
    ['document', documentUpdate(), 'document-file', 'report.pdf', 'document caption', 102],
  ] as const)(
    'routes authorized %s media through Telegram download, Drive upload, and HHHL without placeholder replies',
    async (_kind, update, telegramFileId, uploadName, caption, telegramMessageId) => {
      const env = createTestEnv({ HHHL_API_BASE_URL: 'https://hhhl.example/api' });
      const state = storeFor(env);
      await seedBinding(state);
      const calls: FetchCall[] = [];
      const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
        const call = { url: input.toString(), init };
        calls.push(call);
        if (call.url === 'https://api.telegram.org/bot123456:telegram-secret/getFile') {
          expect(requestBody(call)).toEqual({ file_id: telegramFileId });
          return jsonResponse({ ok: true, result: { file_path: `downloads/${telegramFileId}` } });
        }
        if (call.url === `https://api.telegram.org/file/bot123456:telegram-secret/downloads/${telegramFileId}`) {
          return new Response('telegram file bytes', { headers: { 'content-type': 'application/octet-stream' } });
        }
        if (call.url === 'https://hhhl.example/api/drive/files/create') {
          expect(call.init?.body).toBeInstanceOf(FormData);
          const formData = call.init?.body as FormData;
          expect(formData.get('name')).toBe(uploadName);
          expect(formData.get('i')).toBe('hhhl-secret');
          expect(formData.get('force')).toBe('true');
          expect(formData.get('file')).toBeInstanceOf(Blob);
          return jsonResponse({ fileId: 'drive-file-1', filename: uploadName });
        }
        if (call.url === 'https://hhhl.example/api/chat/messages/create-to-room') {
          return jsonResponse({ message: { id: 'hhhl-created-1', roomId: 'room-1', fileId: 'drive-file-1' } });
        }
        throw new Error(`unexpected fetch ${call.url}`);
      });
      vi.stubGlobal('fetch', fetchImpl);

      const response = await postUpdate(update, env);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
      expect(calls.map((call) => call.url)).toEqual([
        'https://api.telegram.org/bot123456:telegram-secret/getFile',
        `https://api.telegram.org/file/bot123456:telegram-secret/downloads/${telegramFileId}`,
        'https://hhhl.example/api/drive/files/create',
        'https://hhhl.example/api/chat/messages/create-to-room',
      ]);
      expect(requestBody(calls[3])).toEqual({
        toRoomId: 'room-1',
        fileId: 'drive-file-1',
        text: caption,
        i: 'hhhl-secret',
      });
      expect(calls.map((call) => call.url)).not.toContain('https://api.telegram.org/bot123456:telegram-secret/sendMessage');
      await expect(state.getMessageMapByTelegram('42', telegramMessageId)).resolves.toMatchObject({
        roomId: 'room-1',
        hhhlMessageId: 'hhhl-created-1',
        telegramMessageId,
      });
    },
  );
});
