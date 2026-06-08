import { commandHelpText, parseCommand } from '../src/telegram/commands';
import { parseTelegramUpdate } from '../src/telegram/updates';

describe('parseCommand', () => {
  it('parses supported commands', () => {
    expect(parseCommand('/bind room-1 测试房间')).toEqual({ type: 'bind', roomId: 'room-1', roomName: '测试房间' });
    expect(parseCommand('/bind room-1')).toEqual({ type: 'bind', roomId: 'room-1', roomName: null });
    expect(parseCommand('/unbind')).toEqual({ type: 'unbind' });
    expect(parseCommand('/rename 新名字')).toEqual({ type: 'rename', roomName: '新名字' });
    expect(parseCommand('/list')).toEqual({ type: 'list' });
    expect(parseCommand('/status')).toEqual({ type: 'status' });
    expect(parseCommand('/help')).toEqual({ type: 'help' });
    expect(parseCommand('/start')).toEqual({ type: 'help' });
  });

  it('reports invalid commands with Chinese usage text', () => {
    expect(parseCommand('/bind')).toEqual({ type: 'invalid', reason: '用法：/bind <roomId> [显示名]' });
    expect(parseCommand('/rename')).toEqual({ type: 'invalid', reason: '用法：/rename <显示名>' });
  });

  it('returns unknown for unsupported slash commands', () => {
    expect(parseCommand('/unknown')).toEqual({ type: 'unknown' });
  });

  it('returns null for non-command text', () => {
    expect(parseCommand('普通消息')).toBeNull();
  });

  it('contains Chinese help copy for every supported command', () => {
    expect(commandHelpText).toContain('可用命令');
    expect(commandHelpText).toContain('/bind <roomId> [显示名]');
    expect(commandHelpText).toContain('/unbind');
    expect(commandHelpText).toContain('/rename <显示名>');
    expect(commandHelpText).toContain('/list');
    expect(commandHelpText).toContain('/status');
    expect(commandHelpText).toContain('/help');
    expect(commandHelpText).toContain('/start');
  });
});

describe('parseTelegramUpdate', () => {
  it('normalizes private text message updates', () => {
    const parsed = parseTelegramUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        text: 'hello',
        from: { id: 42, is_bot: false, first_name: 'K' },
        chat: { id: 42, type: 'private' },
      },
    });

    expect(parsed).toEqual({
      updateId: 1,
      message: {
        messageId: 10,
        chatId: 42,
        chatType: 'private',
        fromId: 42,
        text: 'hello',
        kind: 'text',
      },
    });
  });

  it('preserves group chat type on parsed messages', () => {
    const parsed = parseTelegramUpdate({
      update_id: 2,
      message: {
        message_id: 11,
        text: 'group text',
        from: { id: 42, is_bot: false, first_name: 'K' },
        chat: { id: -100, type: 'group', title: 'Group' },
      },
    });

    expect(parsed?.message).toMatchObject({
      chatId: -100,
      chatType: 'group',
      kind: 'text',
      text: 'group text',
    });
  });

  it('normalizes document caption and reply metadata', () => {
    const parsed = parseTelegramUpdate({
      update_id: 3,
      message: {
        message_id: 12,
        caption: 'caption',
        document: {
          file_id: 'doc-file',
          file_name: 'doc.txt',
          mime_type: 'text/plain',
          file_size: 321,
        },
        reply_to_message: { message_id: 10 },
        from: { id: 42, is_bot: false, first_name: 'K' },
        chat: { id: 42, type: 'private' },
      },
    });

    expect(parsed).toMatchObject({
      updateId: 3,
      message: {
        messageId: 12,
        chatType: 'private',
        replyToMessageId: 10,
        caption: 'caption',
        kind: 'document',
        media: {
          fileId: 'doc-file',
          fileName: 'doc.txt',
          mimeType: 'text/plain',
          fileSize: 321,
        },
      },
    });
  });

  it('chooses the largest photo by file size and keeps photo metadata', () => {
    const parsed = parseTelegramUpdate({
      update_id: 4,
      message: {
        message_id: 13,
        caption: 'photo caption',
        photo: [
          { file_id: 'small', file_size: 100, width: 90, height: 90 },
          { file_id: 'large', file_size: 1000, width: 1280, height: 720 },
          { file_id: 'medium', file_size: 500, width: 640, height: 360 },
        ],
        from: { id: 42, is_bot: false, first_name: 'K' },
        chat: { id: 42, type: 'private' },
      },
    });

    expect(parsed?.message).toMatchObject({
      kind: 'photo',
      caption: 'photo caption',
      media: {
        fileId: 'large',
        fileSize: 1000,
        width: 1280,
        height: 720,
      },
    });
  });

  it('normalizes video and voice media metadata', () => {
    const video = parseTelegramUpdate({
      update_id: 5,
      message: {
        message_id: 14,
        video: {
          file_id: 'video-file',
          file_name: 'clip.mp4',
          mime_type: 'video/mp4',
          file_size: 2048,
          width: 1920,
          height: 1080,
          duration: 30,
        },
        from: { id: 42, is_bot: false, first_name: 'K' },
        chat: { id: 42, type: 'private' },
      },
    });
    const voice = parseTelegramUpdate({
      update_id: 6,
      message: {
        message_id: 15,
        voice: {
          file_id: 'voice-file',
          mime_type: 'audio/ogg',
          file_size: 512,
          duration: 7,
        },
        from: { id: 42, is_bot: false, first_name: 'K' },
        chat: { id: 42, type: 'private' },
      },
    });

    expect(video?.message).toMatchObject({
      kind: 'video',
      media: {
        fileId: 'video-file',
        fileName: 'clip.mp4',
        mimeType: 'video/mp4',
        fileSize: 2048,
        width: 1920,
        height: 1080,
        duration: 30,
      },
    });
    expect(voice?.message).toMatchObject({
      kind: 'voice',
      media: {
        fileId: 'voice-file',
        mimeType: 'audio/ogg',
        fileSize: 512,
        duration: 7,
      },
    });
  });

  it('returns unsupported for messages without text or media', () => {
    const parsed = parseTelegramUpdate({
      update_id: 7,
      message: {
        message_id: 16,
        from: { id: 42, is_bot: false, first_name: 'K' },
        chat: { id: 42, type: 'private' },
      },
    });

    expect(parsed?.message).toMatchObject({
      messageId: 16,
      chatType: 'private',
      kind: 'unsupported',
    });
  });

  it('returns an update id object for updates without messages', () => {
    expect(parseTelegramUpdate({ update_id: 8, edited_message: { message_id: 17 } })).toEqual({ updateId: 8 });
  });

  it('returns null for invalid updates', () => {
    expect(parseTelegramUpdate(null)).toBeNull();
    expect(parseTelegramUpdate({ update_id: 9, message: { message_id: 18 } })).toBeNull();
  });
});
