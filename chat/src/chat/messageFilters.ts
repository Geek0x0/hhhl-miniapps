import type { ChatMessage } from '@/shared/types';

export type MutedUserIdCollection = readonly string[] | ReadonlySet<string>;

function mutedUserIdSet(mutedUserIds: MutedUserIdCollection): ReadonlySet<string> {
  return mutedUserIds instanceof Set ? mutedUserIds : new Set(mutedUserIds);
}

export function isMessageFromMutedUser(
  message: ChatMessage,
  mutedUserIds: MutedUserIdCollection,
  currentUserId: string | null,
): boolean {
  const userId = message.user?.id;
  return userId != null && userId !== currentUserId && mutedUserIdSet(mutedUserIds).has(userId);
}

export function filterMutedMessages<T extends ChatMessage>(
  messages: T[],
  mutedUserIds: MutedUserIdCollection,
  currentUserId: string | null,
): T[] {
  const mutedIds = mutedUserIdSet(mutedUserIds);
  return messages.filter((message) => !isMessageFromMutedUser(message, mutedIds, currentUserId));
}
