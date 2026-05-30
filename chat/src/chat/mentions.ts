import type { UserSummary } from '@/shared/types';

export interface MentionTextPart {
  kind: 'text';
  text: string;
}

export interface MentionUserPart {
  kind: 'mention';
  text: string;
  user: UserSummary;
}

export type MentionPart = MentionTextPart | MentionUserPart;

const MENTION_PATTERN = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9_]{1,32})/g;
const DEFAULT_MENTION_CANDIDATE_LIMIT = 6;

function normalizeMentionQuery(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function memberSearchValues(member: UserSummary): string[] {
  return [member.username, member.name ?? '', member.id];
}

export function mentionCandidates(members: UserSummary[], query: string, limit = DEFAULT_MENTION_CANDIDATE_LIMIT): UserSummary[] {
  const normalizedQuery = normalizeMentionQuery(query);
  if (normalizedQuery === '') {
    return members.slice(0, limit);
  }

  return members
    .filter((member) => memberSearchValues(member).some((value) => value.toLowerCase().includes(normalizedQuery)))
    .slice(0, limit);
}

export function parseMentionText(text: string, members: UserSummary[]): MentionPart[] {
  const membersByUsername = new Map(members.map((member) => [member.username.toLowerCase(), member]));
  const parts: MentionPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const prefix = match[1] ?? '';
    const username = match[2] ?? '';
    const member = membersByUsername.get(username.toLowerCase());
    if (member == null) {
      continue;
    }

    const matchIndex = match.index ?? 0;
    const mentionStart = matchIndex + prefix.length;
    if (mentionStart > lastIndex) {
      parts.push({ kind: 'text', text: text.slice(lastIndex, mentionStart) });
    }

    parts.push({ kind: 'mention', text: `@${username}`, user: member });
    lastIndex = mentionStart + username.length + 1;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return parts.length === 0 ? [{ kind: 'text', text }] : parts;
}
