interface ParseResult {
  text: string;
  index: number;
  closed: boolean;
}

export function displayMessageText(text: string): string {
  return parseText(text, 0, false).text;
}

function parseText(source: string, start: number, stopAtClosingBracket: boolean): ParseResult {
  let text = '';
  let index = start;

  while (index < source.length) {
    if (stopAtClosingBracket && source[index] === ']') {
      return { text, index: index + 1, closed: true };
    }

    const tag = parseSpecialTag(source, index);
    if (tag != null) {
      text += tag.text;
      index = tag.index;
      continue;
    }

    text += source[index];
    index += 1;
  }

  return { text, index, closed: false };
}

function parseSpecialTag(source: string, index: number): ParseResult | null {
  if (!source.startsWith('$[', index)) {
    return null;
  }

  let cursor = index + 2;
  const tagStart = cursor;
  while (cursor < source.length && source[cursor] !== ']' && !isWhitespace(source[cursor])) {
    cursor += 1;
  }

  if (cursor === tagStart || cursor >= source.length || !isWhitespace(source[cursor])) {
    return null;
  }

  while (cursor < source.length && isWhitespace(source[cursor])) {
    cursor += 1;
  }

  const inner = parseText(source, cursor, true);
  return inner.closed ? inner : null;
}

function isWhitespace(char: string | undefined): boolean {
  return char != null && /\s/u.test(char);
}
