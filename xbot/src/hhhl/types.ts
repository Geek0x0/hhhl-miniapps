export type HhhlFetch = typeof fetch;

export type EndpointParams = object;

export interface HhhlEndpointCaller {
  callEndpoint<TResponse = unknown>(endpoint: string, params?: EndpointParams): Promise<TResponse>;
}

export interface HhhlUploadClient {
  uploadFile(formData: FormData): Promise<unknown>;
}

export interface PaginationParams {
  limit?: number;
  sinceId?: string;
  untilId?: string;
}

export interface HhhlUser {
  id: string;
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  avatarFallbackUrl?: string | null;
}

export interface HhhlRoom {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  joinMode?: string | null;
}

export interface HhhlDriveFile {
  id: string;
  name: string;
  type?: string | null;
  size?: number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  blurhash?: string | null;
  isSensitive?: boolean | null;
  properties?: {
    width?: number | null;
    height?: number | null;
  } | null;
}

export interface HhhlMessageReaction {
  reaction: string;
  count: number;
  reacted?: boolean;
}

export interface HhhlChatMessage {
  id: string;
  roomId: string;
  createdAt: string;
  text?: string | null;
  user?: HhhlUser | null;
  file?: HhhlDriveFile | null;
  reactions?: HhhlMessageReaction[];
  replyId?: string | null;
  reply?: HhhlChatMessage | null;
  quoteId?: string | null;
  quote?: HhhlChatMessage | null;
}

export interface CreateRoomMessageParams {
  toRoomId: string;
  text?: string;
  fileId?: string;
  replyId?: string;
  quoteId?: string;
}

export interface DriveUploadParams {
  blob: Blob;
  name: string;
  type?: string;
}
