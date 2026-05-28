export interface UserSummary {
  id: string;
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface RoomSummary {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  joinMode?: string | null;
}

export interface DriveFile {
  id: string;
  name: string;
  type?: string | null;
  size?: number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  createdAt: string;
  text?: string | null;
  user?: UserSummary | null;
  file?: DriveFile | null;
  replyId?: string | null;
  quoteId?: string | null;
}

export interface PaginationParams {
  limit?: number;
  sinceId?: string;
  untilId?: string;
}

export type ApiEndpoint = string;
