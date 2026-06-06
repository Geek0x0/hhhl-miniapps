import { describe, expect, it } from 'vitest';
import { splitSearchHighlight } from './searchHighlight';

describe('splitSearchHighlight', () => {
  it('splits text into safe text parts around case-insensitive matches', () => {
    expect(splitSearchHighlight('Hello hello', 'he')).toEqual([
      { text: 'He', match: true },
      { text: 'llo ', match: false },
      { text: 'he', match: true },
      { text: 'llo', match: false },
    ]);
  });

  it('returns one non-match part for empty query and treats regex characters literally', () => {
    expect(splitSearchHighlight('a+b a+b', 'a+b')).toEqual([
      { text: 'a+b', match: true },
      { text: ' ', match: false },
      { text: 'a+b', match: true },
    ]);
    expect(splitSearchHighlight('<b>hello</b>', '')).toEqual([
      { text: '<b>hello</b>', match: false },
    ]);
  });
});
