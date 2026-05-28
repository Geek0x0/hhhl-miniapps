import { describe, expect, it } from 'vitest';
import { parseStartParam } from './startParam';

describe('parseStartParam', () => {
  it('parses room deep links', () => {
    expect(parseStartParam('room_amlc1bekzi')).toEqual({ type: 'room', roomId: 'amlc1bekzi' });
  });

  it('returns none for empty params', () => {
    expect(parseStartParam('')).toEqual({ type: 'none' });
    expect(parseStartParam(undefined)).toEqual({ type: 'none' });
  });

  it('returns invalid for malformed params', () => {
    expect(parseStartParam('room_')).toEqual({ type: 'invalid', raw: 'room_' });
    expect(parseStartParam('unknown')).toEqual({ type: 'invalid', raw: 'unknown' });
  });
});
