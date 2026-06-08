import { forwardHhhlMessageToTelegram } from '../src/bridge/outbound';
import type { HhhlChatMessage, HhhlDriveFile, HhhlUser } from '../src/hhhl/types';
import { createKeys } from '../src/state/keys';
import { KvStateStore } from '../src/state/kvStore';
import type { BindingState, MessageMapState } from '../src/state/schemas';
import { createTestEnv } from './fakes';

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

function user(overrides: Partial<HhhlUser> = {}): HhhlUser {
  return {
    id: 'hhhl-user-1',
    username: 'alice',
    name: 'Alice',
    ...overrides,
  };
}

function driveFile(overrides: Partial<HhhlDriveFile> = {}): HhhlDriveFile {
  return {
    id: 'file-1',
    name: 'file.bin',
    type: 'application/octet-stream',
    url: 'https://hhhl.example/files/file.bin',
    ...overrides,
  };
}

function hhhlMessage(overrides: Partial<HhhlChatMessage> = {}): HhhlChatMessage {
  return {
    id: 'hhhl-message-1',
    roomId: 'room-1',
    createdAt: '2026-06-08T00:00:03.000Z',
    text: '  hello Telegram  ',
    user: user(),
    ...overrides,
  };
}

type TelegramChatId = number | string;
type TelegramSendResult = { messageId: number };
type TelegramMessageOptions = { replyToMessageId?: number };
type TelegramMediaOptions = { caption?: string; replyToMessageId?: number };
type SendMessage = (chatId: TelegramChatId, text: string, options?: TelegramMessageOptions) => Promise<TelegramSendResult>;
type SendMedia = (chatId: TelegramChatId, file: string, options?: TelegramMediaOptions) => Promise<TelegramSendResult>;

function createTelegramFake() {
  let nextMessageId = 300;
  const nextResult = async () => ({ messageId: ++nextMessageId });

  return {
    sendMessage: vi.fn<SendMessage>(nextResult),
    sendPhoto: vi.fn<SendMedia>(nextResult),
    sendDocument: vi.fn<SendMedia>(nextResult),
    sendVideo: vi.fn<SendMedia>(nextResult),
    sendVoice: vi.fn<SendMedia>(nextResult),
  };
}

function expectNoTelegramSend(telegram: ReturnType<typeof createTelegramFake>): void {
  expect(telegram.sendMessage).not.toHaveBeenCalled();
  expect(telegram.sendPhoto).not.toHaveBeenCalled();
  expect(telegram.sendDocument).not.toHaveBeenCalled();
  expect(telegram.sendVideo).not.toHaveBeenCalled();
  expect(telegram.sendVoice).not.toHaveBeenCalled();
}

describe('HHHL outbound Telegram forwarding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters bot-authored messages while advancing lastSeen', async () => {
    const state = storeFor();
    await seedBinding(state);
    const telegram = createTelegramFake();

    await forwardHhhlMessageToTelegram({
      message: hhhlMessage({ id: 'hhhl-bot-message', user: user({ id: 'hhhl-bot-user' }) }),
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expectNoTelegramSend(telegram);
    await expect(state.getBinding('42')).resolves.toMatchObject({ lastSeenMessageId: 'hhhl-bot-message' });
    await expect(state.getMessageMapByHhhl('room-1', 'hhhl-bot-message')).resolves.toBeNull();
  });

  it('dedupes existing HHHL to Telegram mappings while advancing lastSeen', async () => {
    const state = storeFor();
    await seedBinding(state);
    await seedMessageMap(state, {
      hhhlMessageId: 'hhhl-message-1',
      telegramMessageId: 222,
      createdAt: '2026-06-08T00:00:02.000Z',
    });
    const telegram = createTelegramFake();

    await forwardHhhlMessageToTelegram({
      message: hhhlMessage(),
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expectNoTelegramSend(telegram);
    await expect(state.getBinding('42')).resolves.toMatchObject({ lastSeenMessageId: 'hhhl-message-1' });
    await expect(state.getMessageMapByHhhl('room-1', 'hhhl-message-1')).resolves.toMatchObject({
      telegramMessageId: 222,
      createdAt: '2026-06-08T00:00:02.000Z',
    });
  });

  it('sends text with a native Telegram reply when the HHHL reply maps', async () => {
    const state = storeFor();
    await seedBinding(state);
    await seedMessageMap(state, { hhhlMessageId: 'hhhl-reply-1', telegramMessageId: 100 });
    const telegram = createTelegramFake();

    await forwardHhhlMessageToTelegram({
      message: hhhlMessage({ id: 'hhhl-message-2', replyId: 'hhhl-reply-1' }),
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).toHaveBeenCalledWith(42, 'alice: hello Telegram', { replyToMessageId: 100 });
    await expect(state.getMessageMapByHhhl('room-1', 'hhhl-message-2')).resolves.toEqual({
      version: 1,
      roomId: 'room-1',
      hhhlMessageId: 'hhhl-message-2',
      telegramUserId: '42',
      telegramMessageId: 301,
      createdAt: '2026-06-08T00:00:04.000Z',
    });
    await expect(state.getBinding('42')).resolves.toMatchObject({ lastSeenMessageId: 'hhhl-message-2' });
  });

  it('prepends a quote fallback when a reply is embedded but not mapped', async () => {
    const state = storeFor();
    await seedBinding(state);
    const telegram = createTelegramFake();

    await forwardHhhlMessageToTelegram({
      message: hhhlMessage({
        id: 'hhhl-message-3',
        text: '  response  ',
        user: null,
        replyId: 'missing-reply',
        reply: hhhlMessage({
          id: 'missing-reply',
          text: '  original text  ',
          user: user({ id: 'bob-id', username: '', name: 'Bob' }),
        }),
      }),
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).toHaveBeenCalledWith(42, '引用：Bob: original text\nHHHL: response');
    expect(telegram.sendMessage.mock.calls[0]).toHaveLength(2);
  });

  it('selects the Telegram file method by MIME type and includes captions and replies', async () => {
    const state = storeFor();
    await seedBinding(state);
    await seedMessageMap(state, { hhhlMessageId: 'hhhl-reply-1', telegramMessageId: 100 });
    const telegram = createTelegramFake();
    const options = {
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    };

    await forwardHhhlMessageToTelegram({
      ...options,
      message: hhhlMessage({
        id: 'hhhl-image',
        text: 'look',
        replyId: 'hhhl-reply-1',
        file: driveFile({ name: 'photo.png', type: 'image/png', url: 'https://hhhl.example/photo.png' }),
      }),
    });
    await forwardHhhlMessageToTelegram({
      ...options,
      message: hhhlMessage({
        id: 'hhhl-video',
        text: null,
        file: driveFile({ name: 'clip.mp4', type: 'video/mp4', url: 'https://hhhl.example/clip.mp4' }),
      }),
    });
    await forwardHhhlMessageToTelegram({
      ...options,
      message: hhhlMessage({
        id: 'hhhl-voice',
        text: null,
        file: driveFile({ name: 'voice.ogg', type: 'audio/ogg', url: 'https://hhhl.example/voice.ogg' }),
      }),
    });
    await forwardHhhlMessageToTelegram({
      ...options,
      message: hhhlMessage({
        id: 'hhhl-document',
        text: 'report',
        file: driveFile({ name: 'report.pdf', type: 'application/pdf', url: 'https://hhhl.example/report.pdf' }),
      }),
    });

    expect(telegram.sendPhoto).toHaveBeenCalledWith(42, 'https://hhhl.example/photo.png', {
      caption: 'alice: look',
      replyToMessageId: 100,
    });
    expect(telegram.sendVideo).toHaveBeenCalledWith(42, 'https://hhhl.example/clip.mp4', { caption: 'clip.mp4' });
    expect(telegram.sendVoice).toHaveBeenCalledWith(42, 'https://hhhl.example/voice.ogg', { caption: 'voice.ogg' });
    expect(telegram.sendDocument).toHaveBeenCalledWith(42, 'https://hhhl.example/report.pdf', {
      caption: 'alice: report',
    });
    await expect(state.getBinding('42')).resolves.toMatchObject({ lastSeenMessageId: 'hhhl-document' });
  });

  it('falls back to a text send when a file has no URL', async () => {
    const state = storeFor();
    await seedBinding(state);
    const telegram = createTelegramFake();

    await forwardHhhlMessageToTelegram({
      message: hhhlMessage({
        id: 'hhhl-file-no-url',
        text: '  file without url  ',
        file: driveFile({ name: 'photo.png', type: 'image/png', url: null }),
      }),
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).toHaveBeenCalledWith(42, 'alice: file without url');
    expect(telegram.sendPhoto).not.toHaveBeenCalled();
    await expect(state.getMessageMapByHhhl('room-1', 'hhhl-file-no-url')).resolves.toMatchObject({
      telegramMessageId: 301,
    });
  });

  it.each([
    ['blob URL', 'blob:https://hhhl.example/file'],
    ['data URL', 'data:text/plain;base64,SGVsbG8='],
    ['bare path', '/files/file-1'],
  ] as const)('falls back to text send for unsupported %s media URLs', async (_label, url) => {
    const state = storeFor();
    await seedBinding(state);
    const telegram = createTelegramFake();

    await forwardHhhlMessageToTelegram({
      message: hhhlMessage({
        id: `hhhl-unsupported-url-${_label}`,
        text: 'file with unsupported url',
        file: driveFile({ name: 'photo.png', type: 'image/png', url }),
      }),
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    });

    expect(telegram.sendMessage).toHaveBeenCalledWith(42, 'alice: file with unsupported url');
    expect(telegram.sendPhoto).not.toHaveBeenCalled();
  });

  it('advances lastSeen when Telegram send succeeds but message map persistence fails', async () => {
    const state = storeFor();
    await seedBinding(state);
    const telegram = createTelegramFake();
    vi.spyOn(state, 'putMessageMap').mockRejectedValueOnce(new Error('map persistence failed'));

    await expect(forwardHhhlMessageToTelegram({
      message: hhhlMessage({ id: 'hhhl-map-fails' }),
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    })).rejects.toThrow('map persistence failed');

    expect(telegram.sendMessage).toHaveBeenCalledWith(42, 'alice: hello Telegram');
    await expect(state.getBinding('42')).resolves.toMatchObject({ lastSeenMessageId: 'hhhl-map-fails' });
    await expect(state.getMessageMapByHhhl('room-1', 'hhhl-map-fails')).resolves.toBeNull();
  });

  it('truncates long text and captions to Telegram limits', async () => {
    const state = storeFor();
    await seedBinding(state);
    const telegram = createTelegramFake();
    const longBody = 'x'.repeat(5000);
    const options = {
      telegramUserId: '42',
      chatId: 42,
      state,
      telegram,
      hhhlBotUserId: 'hhhl-bot-user',
      now: () => '2026-06-08T00:00:04.000Z',
    };

    await forwardHhhlMessageToTelegram({
      ...options,
      message: hhhlMessage({ id: 'hhhl-long-text', text: longBody, file: null }),
    });
    await forwardHhhlMessageToTelegram({
      ...options,
      message: hhhlMessage({
        id: 'hhhl-long-caption',
        text: longBody,
        file: driveFile({ name: 'photo.png', type: 'image/png', url: 'https://hhhl.example/photo.png' }),
      }),
    });

    const sentText = telegram.sendMessage.mock.calls[0][1];
    const sentCaption = telegram.sendPhoto.mock.calls[0][2]?.caption;

    expect(sentText).toHaveLength(4096);
    expect(sentText.endsWith('...')).toBe(true);
    expect(sentCaption).toHaveLength(1024);
    expect(sentCaption?.endsWith('...')).toBe(true);
  });
});
