import type { EndpointCaller } from '@/api/endpointTypes';
import { normalizeAvatarUrl } from '@/shared/avatarUrl';
import type { UserSummary } from '@/shared/types';

export interface UserShowParams {
  userId?: string;
  userIds?: string[];
  username?: string;
  host?: string | null;
  detail?: boolean;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function recordField(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringFrom(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringField(raw[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function normalizeUserList(value: unknown): UserSummary[] {
  if (Array.isArray(value)) {
    return value.map(normalizeUserSummary).filter((user) => user.id !== '');
  }

  const user = normalizeUserSummary(value);
  return user.id === '' ? [] : [user];
}

export function normalizeUserSummary(value: unknown): UserSummary {
  const container = recordField(value) ?? {};
  const raw = recordField(container.user) ?? recordField(container.account) ?? recordField(container.profile) ?? container;
  const id = stringFrom(raw, ['id', 'userId', 'accountId', 'username', 'acct']) ?? '';
  const name = stringFrom(raw, ['name', 'displayName', 'display_name', 'nickname', 'nick', 'screenName']);
  const username = stringFrom(raw, ['username', 'userName', 'acct', 'handle', 'screenName']) ?? name ?? id;
  const avatar = normalizeAvatarUrl(raw.avatarUrl ?? raw.avatarURL ?? raw.avatarUri ?? raw.avatarURI ?? raw.avatar ?? raw.iconUrl ?? raw.iconUri ?? raw.image ?? raw.imageUrl ?? raw.photo ?? raw.photoUrl ?? raw.photoURL ?? raw.picture ?? raw.pictureUrl);

  return {
    id: id === '' ? username : id,
    username,
    name,
    avatarUrl: avatar.avatarUrl,
    avatarFallbackUrl: avatar.avatarFallbackUrl,
  };
}

export function createUserApi(client: EndpointCaller) {
  return {
    show: async (params: UserShowParams) => normalizeUserList(await client.callEndpoint<unknown>('users/show', params)),
  };
}
