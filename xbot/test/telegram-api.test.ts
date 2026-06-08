import { TelegramApi } from '../src/telegram/api';
import { downloadTelegramMedia, selectTelegramDownloadName } from '../src/telegram/media';
import type { TelegramMedia } from '../src/telegram/types';

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

describe('TelegramApi', () => {
  it('posts sendMessage JSON and returns the message id', async () => {
    const { fetchImpl, calls } = createFetch([
      jsonResponse({ ok: true, result: { message_id: 321 } }),
    ]);
    const api = new TelegramApi('secret-token', fetchImpl);

    await expect(api.sendMessage(123, 'hello', { replyToMessageId: 99 })).resolves.toEqual({ messageId: 321 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.telegram.org/botsecret-token/sendMessage');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(requestBody(calls[0])).toEqual({
      chat_id: 123,
      text: 'hello',
      reply_to_message_id: 99,
      allow_sending_without_reply: true,
    });
  });

  it('posts media messages with captions and optional replies', async () => {
    const { fetchImpl, calls } = createFetch([
      jsonResponse({ ok: true, result: { message_id: 1 } }),
      jsonResponse({ ok: true, result: { message_id: 2 } }),
    ]);
    const api = new TelegramApi('secret-token', fetchImpl);

    await expect(api.sendPhoto('@room', 'photo-file', { caption: 'photo caption' })).resolves.toEqual({ messageId: 1 });
    await expect(api.sendDocument('@room', 'doc-file', { caption: 'doc caption', replyToMessageId: 10 })).resolves.toEqual({
      messageId: 2,
    });

    expect(calls[0].url).toBe('https://api.telegram.org/botsecret-token/sendPhoto');
    expect(requestBody(calls[0])).toEqual({
      chat_id: '@room',
      photo: 'photo-file',
      caption: 'photo caption',
    });
    expect(calls[1].url).toBe('https://api.telegram.org/botsecret-token/sendDocument');
    expect(requestBody(calls[1])).toEqual({
      chat_id: '@room',
      document: 'doc-file',
      caption: 'doc caption',
      reply_to_message_id: 10,
      allow_sending_without_reply: true,
    });
  });

  it('posts sendVideo and sendVoice with the correct method fields', async () => {
    const { fetchImpl, calls } = createFetch([
      jsonResponse({ ok: true, result: { message_id: 3 } }),
      jsonResponse({ ok: true, result: { message_id: 4 } }),
    ]);
    const api = new TelegramApi('secret-token', fetchImpl);

    await expect(api.sendVideo(123, 'video-file', { caption: 'video caption' })).resolves.toEqual({ messageId: 3 });
    await expect(api.sendVoice(123, 'voice-file', { caption: 'voice caption', replyToMessageId: 11 })).resolves.toEqual({
      messageId: 4,
    });

    expect(calls[0].url).toBe('https://api.telegram.org/botsecret-token/sendVideo');
    expect(requestBody(calls[0])).toEqual({
      chat_id: 123,
      video: 'video-file',
      caption: 'video caption',
    });
    expect(calls[1].url).toBe('https://api.telegram.org/botsecret-token/sendVoice');
    expect(requestBody(calls[1])).toEqual({
      chat_id: 123,
      voice: 'voice-file',
      caption: 'voice caption',
      reply_to_message_id: 11,
      allow_sending_without_reply: true,
    });
  });

  it('omits caption from media sends when no non-empty caption is provided', async () => {
    const { fetchImpl, calls } = createFetch([
      jsonResponse({ ok: true, result: { message_id: 5 } }),
      jsonResponse({ ok: true, result: { message_id: 6 } }),
    ]);
    const api = new TelegramApi('secret-token', fetchImpl);

    await expect(api.sendPhoto('@room', 'photo-file')).resolves.toEqual({ messageId: 5 });
    await expect(api.sendDocument('@room', 'doc-file', { caption: '' })).resolves.toEqual({ messageId: 6 });

    expect(requestBody(calls[0])).toEqual({
      chat_id: '@room',
      photo: 'photo-file',
    });
    expect(requestBody(calls[0])).not.toHaveProperty('caption');
    expect(requestBody(calls[1])).toEqual({
      chat_id: '@room',
      document: 'doc-file',
    });
    expect(requestBody(calls[1])).not.toHaveProperty('caption');
  });

  it('resolves getFile paths and Telegram file URLs', async () => {
    const { fetchImpl, calls } = createFetch([
      jsonResponse({ ok: true, result: { file_path: 'documents/file.txt' } }),
    ]);
    const api = new TelegramApi('secret-token', fetchImpl);

    await expect(api.getFilePath('file-id')).resolves.toBe('documents/file.txt');
    expect(api.fileUrl('documents/file.txt')).toBe('https://api.telegram.org/file/botsecret-token/documents/file.txt');
    expect(calls[0].url).toBe('https://api.telegram.org/botsecret-token/getFile');
    expect(requestBody(calls[0])).toEqual({ file_id: 'file-id' });
  });

  it('throws sanitized errors for successful send envelopes without a message id', async () => {
    const token = 'secret-token';
    const { fetchImpl } = createFetch([jsonResponse({ ok: true, result: {} })]);
    const api = new TelegramApi(token, fetchImpl);

    const error = await api.sendMessage(123, 'hello').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('sendMessage failed with invalid response');
    expect((error as Error).message).not.toContain(token);
  });

  it('throws sanitized errors for successful getFile envelopes without a usable file path', async () => {
    const token = 'secret-token';
    const missingPath = new TelegramApi(token, createFetch([jsonResponse({ ok: true, result: {} })]).fetchImpl);
    const blankPath = new TelegramApi(
      token,
      createFetch([jsonResponse({ ok: true, result: { file_path: '   ' } })]).fetchImpl,
    );

    const missingError = await missingPath.getFilePath('file-id').catch((caught: unknown) => caught);
    expect(missingError).toBeInstanceOf(Error);
    expect((missingError as Error).message).toBe('getFile failed with invalid response');
    expect((missingError as Error).message).not.toContain(token);

    const blankError = await blankPath.getFilePath('file-id').catch((caught: unknown) => caught);
    expect(blankError).toBeInstanceOf(Error);
    expect((blankError as Error).message).toBe('getFile failed with invalid response');
    expect((blankError as Error).message).not.toContain(token);
  });

  it('downloads Telegram files and throws sanitized errors for non-ok responses', async () => {
    const token = 'secret-token';
    const okFetch = createFetch([new Response('file bytes', { headers: { 'content-type': 'text/plain' } })]);
    const api = new TelegramApi(token, okFetch.fetchImpl);

    const blob = await api.downloadFile('documents/file.txt');
    await expect(blob.text()).resolves.toBe('file bytes');
    expect(blob.type).toBe('text/plain');

    const failedFetch = createFetch([new Response('missing', { status: 404 })]);
    const failedApi = new TelegramApi(token, failedFetch.fetchImpl);
    const error = await failedApi.downloadFile('documents/file.txt').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('downloadFile failed with status 404');
    expect((error as Error).message).not.toContain(token);
    expect((error as Error).message).not.toContain('/file/bot');
  });

  it('throws sanitized errors when file download fetch rejects', async () => {
    const token = 'secret-token';
    const fetchImpl: typeof fetch = async () => {
      throw new Error(`network failed for https://api.telegram.org/file/bot${token}/documents/file.txt`);
    };
    const api = new TelegramApi(token, fetchImpl);

    const error = await api.downloadFile('documents/file.txt').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('downloadFile failed');
    expect((error as Error).message).not.toContain(token);
    expect((error as Error).message).not.toContain('/file/bot');
  });

  it('throws sanitized errors for Telegram API ok false payloads', async () => {
    const token = 'secret-token';
    const { fetchImpl } = createFetch([
      jsonResponse({ ok: false, error_code: 400, description: `Bad token ${token}` }, { status: 200 }),
    ]);
    const api = new TelegramApi(token, fetchImpl);

    const error = await api.sendMessage(123, 'hello').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('sendMessage failed');
    expect((error as Error).message).toContain('status 400');
    expect((error as Error).message).not.toContain(token);
  });

  it('throws sanitized errors when Telegram API fetch rejects', async () => {
    const token = 'secret-token';
    const fetchImpl: typeof fetch = async () => {
      throw new Error(`network failed for https://api.telegram.org/bot${token}/sendMessage`);
    };
    const api = new TelegramApi(token, fetchImpl);

    const error = await api.sendMessage(123, 'hello').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('sendMessage failed');
    expect((error as Error).message).not.toContain(token);
    expect((error as Error).message).not.toContain('/bot');
  });
});

describe('Telegram media downloads', () => {
  it('selects explicit filenames before generated media names', () => {
    expect(selectTelegramDownloadName({ fileId: 'doc-1', fileName: 'report.pdf' }, 'document')).toBe('report.pdf');
    expect(selectTelegramDownloadName({ fileId: 'photo-1' }, 'photo')).toBe('photo-photo-1.jpg');
    expect(selectTelegramDownloadName({ fileId: 'video-1' }, 'video')).toBe('video-video-1.mp4');
    expect(selectTelegramDownloadName({ fileId: 'voice-1' }, 'voice')).toBe('voice-voice-1.ogg');
    expect(selectTelegramDownloadName({ fileId: 'doc-1' }, 'document')).toBe('document-doc-1.bin');
  });

  it('sanitizes explicit Telegram filenames before using them', () => {
    expect(selectTelegramDownloadName({ fileId: 'doc-1', fileName: '../bad/name.txt' }, 'document')).toBe('name.txt');
    expect(selectTelegramDownloadName({ fileId: 'voice-1', fileName: 'C:\\temp\\voice.ogg' }, 'voice')).toBe(
      'voice.ogg',
    );
    expect(selectTelegramDownloadName({ fileId: 'doc-2', fileName: 'bad\u0000\nname.txt' }, 'document')).toBe(
      'bad_name.txt',
    );
    expect(selectTelegramDownloadName({ fileId: 'doc-3', fileName: '\u0000\n\t' }, 'document')).toBe(
      'document-doc-3.bin',
    );
  });

  it('falls back to generated names for dot-only explicit Telegram filenames', () => {
    expect(selectTelegramDownloadName({ fileId: 'doc-1', fileName: '.' }, 'document')).toBe('document-doc-1.bin');
    expect(selectTelegramDownloadName({ fileId: 'doc-2', fileName: '..' }, 'document')).toBe('document-doc-2.bin');
    expect(selectTelegramDownloadName({ fileId: 'doc-3', fileName: '../..' }, 'document')).toBe('document-doc-3.bin');
  });

  it('downloads media with resolved name, type, and blob', async () => {
    const media: TelegramMedia = { fileId: 'file-id', fileName: 'clip.mp4', mimeType: 'video/mp4' };
    const api = {
      getFilePath: vi.fn(async () => 'videos/clip.mp4'),
      downloadFile: vi.fn(async () => new Blob(['video bytes'], { type: 'application/octet-stream' })),
    };

    const result = await downloadTelegramMedia(api, media, 'video');

    expect(api.getFilePath).toHaveBeenCalledWith('file-id');
    expect(api.downloadFile).toHaveBeenCalledWith('videos/clip.mp4');
    expect(result.name).toBe('clip.mp4');
    expect(result.type).toBe('video/mp4');
    await expect(result.blob.text()).resolves.toBe('video bytes');
  });

  it('uses the response content-type when media mimeType is missing', async () => {
    const api = {
      getFilePath: vi.fn(async () => 'documents/file.txt'),
      downloadFile: vi.fn(async () => new Blob(['text'], { type: 'text/plain' })),
    };

    const result = await downloadTelegramMedia(api, { fileId: 'doc-1' }, 'document');

    expect(result.name).toBe('document-doc-1.bin');
    expect(result.type).toBe('text/plain');
  });
});
