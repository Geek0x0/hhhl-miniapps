import { describe, expect, it } from 'vitest';
import { createUserApi, normalizeUserSummary } from './userApi';

describe('userApi', () => {
  it('normalizes dc user response variants', () => {
    expect(normalizeUserSummary({ id: 'user-1', username: 'alice', name: 'Alice', avatarUrl: '/avatar.png' })).toEqual({
      id: 'user-1',
      username: 'alice',
      name: 'Alice',
      avatarUrl: 'https://dc.hhhl.cc/avatar.png',
    });
  });

  it('calls users/show with batch ids and detail disabled', async () => {
    const calls: Array<{ endpoint: string; params: unknown }> = [];
    const api = createUserApi({
      callEndpoint: async (endpoint, params) => {
        calls.push({ endpoint, params });
        return [{ id: 'user-99', username: 'eve', name: 'Eve' }] as never;
      },
    });

    await expect(api.show({ userIds: ['user-99'], detail: false })).resolves.toEqual([
      { id: 'user-99', username: 'eve', name: 'Eve', avatarUrl: null },
    ]);
    expect(calls).toEqual([
      { endpoint: 'users/show', params: { userIds: ['user-99'], detail: false } },
    ]);
  });
});
