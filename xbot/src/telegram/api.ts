type FetchImpl = typeof fetch;

type TelegramChatId = number | string;

export interface TelegramSendOptions {
  caption?: string;
  replyToMessageId?: number;
}

export interface TelegramSendResult {
  messageId: number;
}

interface TelegramApiEnvelope {
  ok?: unknown;
  result?: unknown;
  error_code?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function statusFromEnvelope(envelope: TelegramApiEnvelope, response: Response): number {
  return typeof envelope.error_code === 'number' ? envelope.error_code : response.status;
}

function messageIdFrom(result: unknown): number | null {
  if (!isRecord(result)) return null;
  return typeof result.message_id === 'number' && Number.isInteger(result.message_id) ? result.message_id : null;
}

function filePathFrom(result: unknown): string | null {
  if (!isRecord(result)) return null;
  if (typeof result.file_path !== 'string') return null;
  const filePath = result.file_path.trim();
  return filePath !== '' ? filePath : null;
}

export class TelegramApi {
  private readonly apiBaseUrl: string;
  private readonly fileBaseUrl: string;

  constructor(
    private readonly botToken: string,
    private readonly fetchImpl: FetchImpl = globalThis.fetch,
  ) {
    this.apiBaseUrl = `https://api.telegram.org/bot${botToken}`;
    this.fileBaseUrl = `https://api.telegram.org/file/bot${botToken}`;
  }

  async sendMessage(chatId: TelegramChatId, text: string, options?: TelegramSendOptions): Promise<TelegramSendResult> {
    return this.postMessage('sendMessage', {
      chat_id: chatId,
      text,
      ...replyPayload(options),
    });
  }

  async sendPhoto(
    chatId: TelegramChatId,
    photo: string,
    options?: TelegramSendOptions,
  ): Promise<TelegramSendResult> {
    return this.postMessage('sendPhoto', {
      chat_id: chatId,
      photo,
      ...captionPayload(options),
      ...replyPayload(options),
    });
  }

  async sendDocument(
    chatId: TelegramChatId,
    document: string,
    options?: TelegramSendOptions,
  ): Promise<TelegramSendResult> {
    return this.postMessage('sendDocument', {
      chat_id: chatId,
      document,
      ...captionPayload(options),
      ...replyPayload(options),
    });
  }

  async sendVideo(
    chatId: TelegramChatId,
    video: string,
    options?: TelegramSendOptions,
  ): Promise<TelegramSendResult> {
    return this.postMessage('sendVideo', {
      chat_id: chatId,
      video,
      ...captionPayload(options),
      ...replyPayload(options),
    });
  }

  async sendVoice(
    chatId: TelegramChatId,
    voice: string,
    options?: TelegramSendOptions,
  ): Promise<TelegramSendResult> {
    return this.postMessage('sendVoice', {
      chat_id: chatId,
      voice,
      ...captionPayload(options),
      ...replyPayload(options),
    });
  }

  async getFilePath(fileId: string): Promise<string> {
    const envelope = await this.postJson('getFile', { file_id: fileId });
    const filePath = filePathFrom(envelope.result);
    if (filePath == null) throw new Error('getFile failed with invalid response');
    return filePath;
  }

  fileUrl(filePath: string): string {
    return `${this.fileBaseUrl}/${filePath}`;
  }

  async downloadFile(filePath: string): Promise<Blob> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.fileUrl(filePath));
    } catch {
      throw new Error('downloadFile failed');
    }

    if (!response.ok) throw new Error(`downloadFile failed with status ${response.status}`);

    try {
      return await response.blob();
    } catch {
      throw new Error('downloadFile failed');
    }
  }

  private async postMessage(method: string, body: Record<string, unknown>): Promise<TelegramSendResult> {
    const envelope = await this.postJson(method, body);
    const messageId = messageIdFrom(envelope.result);
    if (messageId == null) throw new Error(`${method} failed with invalid response`);
    return { messageId };
  }

  private async postJson(method: string, body: Record<string, unknown>): Promise<TelegramApiEnvelope> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiBaseUrl}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(`${method} failed`);
    }

    let envelope: TelegramApiEnvelope;
    try {
      const parsed: unknown = await response.json();
      envelope = isRecord(parsed) ? parsed : {};
    } catch {
      throw new Error(`${method} failed with status ${response.status}`);
    }

    if (!response.ok || envelope.ok !== true) {
      throw new Error(`${method} failed with status ${statusFromEnvelope(envelope, response)}`);
    }

    return envelope;
  }
}

function captionPayload(options?: TelegramSendOptions): Record<string, unknown> {
  if (options?.caption == null || options.caption === '') return {};
  return { caption: options.caption };
}

function replyPayload(options?: TelegramSendOptions): Record<string, unknown> {
  if (options?.replyToMessageId == null) return {};
  return {
    reply_to_message_id: options.replyToMessageId,
    allow_sending_without_reply: true,
  };
}
