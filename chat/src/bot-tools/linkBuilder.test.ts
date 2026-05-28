import { describe, expect, it } from 'vitest';
import { buildStartAppLink } from './linkBuilder';

describe('buildStartAppLink', () => {
  it('builds Telegram startapp room links', () => {
    expect(buildStartAppLink('mybot', 'amlc1bekzi')).toBe('https://t.me/mybot?startapp=room_amlc1bekzi');
  });

  it('rejects bot usernames with @', () => {
    expect(() => buildStartAppLink('@mybot', 'amlc1bekzi')).toThrow('BOT_USERNAME_INVALID');
  });

  it('rejects empty room IDs', () => {
    expect(() => buildStartAppLink('mybot', '')).toThrow('ROOM_ID_INVALID');
  });

  it('rejects token-like values', () => {
    expect(() => buildStartAppLink('mybot', 'token=secret')).toThrow('TOKEN_LIKE_VALUE');
    expect(() => buildStartAppLink('mybot', 'abc?i=secret')).toThrow('TOKEN_LIKE_VALUE');
  });
});
