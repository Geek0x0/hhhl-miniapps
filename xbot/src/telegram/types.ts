export type TelegramMessageKind = 'text' | 'photo' | 'document' | 'video' | 'voice' | 'unsupported';

export interface TelegramMedia {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface TelegramMessage {
  messageId: number;
  chatId: number | string;
  chatType: string;
  fromId: number | string;
  text?: string;
  caption?: string;
  replyToMessageId?: number;
  kind: TelegramMessageKind;
  media?: TelegramMedia;
}

export interface TelegramUpdate {
  updateId: number;
  message?: TelegramMessage;
}
