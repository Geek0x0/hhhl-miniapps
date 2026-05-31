import { describe, expect, it } from 'vitest';
import { formatMessageTimestamp } from './time';

describe('formatMessageTimestamp', () => {
  it('formats chat timestamps as month-day and hour-minute', () => {
    const value = new Date(2026, 0, 2, 3, 4).toISOString();

    expect(formatMessageTimestamp(value)).toBe('01-02 03:04');
  });
});
