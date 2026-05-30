import { describe, expect, it } from 'vitest';
import type { UserSummary } from '@/shared/types';
import { mentionCandidates, parseMentionText } from './mentions';

const members: UserSummary[] = [
  { id: 'user-1', username: 'alice', name: 'Alice', avatarUrl: '/avatar/alice.png' },
  { id: 'user-2', username: 'bob', name: 'Bob' },
  { id: 'user-3', username: 'carol', name: 'Carol' },
];

describe('mentions', () => {
  it('filters mention candidates by username, name, and leading @', () => {
    expect(mentionCandidates(members, '@bo').map((member) => member.id)).toEqual(['user-2']);
    expect(mentionCandidates(members, 'ALI').map((member) => member.id)).toEqual(['user-1']);
    expect(mentionCandidates(members, '').map((member) => member.id)).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('limits mention candidates to 6 users by default', () => {
    const manyMembers = Array.from({ length: 7 }, (_value, index) => ({
      id: `user-${index + 1}`,
      username: `member${index + 1}`,
      name: `Member ${index + 1}`,
    }));

    expect(mentionCandidates(manyMembers, '').map((member) => member.id)).toEqual([
      'user-1',
      'user-2',
      'user-3',
      'user-4',
      'user-5',
      'user-6',
    ]);
  });

  it('parses known @username tokens into mention parts and leaves unknown names as text', () => {
    expect(parseMentionText('hi @alice and @nobody', members)).toEqual([
      { kind: 'text', text: 'hi ' },
      { kind: 'mention', text: '@alice', user: members[0] },
      { kind: 'text', text: ' and @nobody' },
    ]);
  });

  it('does not parse email addresses or partial username prefixes as mentions', () => {
    expect(parseMentionText('mail a@alice.test and ping @alice_ok', members)).toEqual([
      { kind: 'text', text: 'mail a@alice.test and ping @alice_ok' },
    ]);
  });
});
