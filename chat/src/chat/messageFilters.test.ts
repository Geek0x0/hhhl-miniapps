import { describe, expect, it } from 'vitest';
import { filterMutedMessages } from './messageFilters';

const baseMessage = {
  roomId: 'room-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('messageFilters', () => {
  it('removes messages from muted users while keeping own and anonymous messages visible', () => {
    const messages = [
      { ...baseMessage, id: 'm1', text: 'blocked', user: { id: 'user-1', username: 'alice' } },
      { ...baseMessage, id: 'm2', text: 'visible', user: { id: 'user-2', username: 'bob' } },
      { ...baseMessage, id: 'm3', text: 'own', user: { id: 'me', username: 'me' } },
      { ...baseMessage, id: 'm4', text: 'system', user: null },
    ];

    expect(filterMutedMessages(messages, ['user-1', 'me'], 'me').map((message) => message.id)).toEqual(['m2', 'm3', 'm4']);
  });
});
