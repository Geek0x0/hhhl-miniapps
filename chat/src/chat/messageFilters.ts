import type { ChatMessage } from '@/shared/types';

export function isMessageFromMutedUser(
  message: ChatMessage,
  mutedUserIds: string[],
  currentUserId: string | null,
): boolean {
  const userId = message.user?.id;
  return userId != null && userId !== currentUserId && mutedUserIds.includes(userId);
}

export function filterMutedMessages<T extends ChatMessage>(
  messages: T[],
  mutedUserIds: string[],
  currentUserId: string | null,
): T[] {
  return messages.filter((message) => !isMessageFromMutedUser(message, mutedUserIds, currentUserId));
}
