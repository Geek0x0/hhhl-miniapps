export interface SearchHighlightPart {
  text: string;
  match: boolean;
}

export function splitSearchHighlight(text: string, query: string): SearchHighlightPart[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [{ text, match: false }];
  }

  const parts: SearchHighlightPart[] = [];
  const lower = text.toLowerCase();
  let cursor = 0;

  for (;;) {
    const index = lower.indexOf(needle, cursor);
    if (index < 0) {
      break;
    }

    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), match: false });
    }
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }

  return parts.length === 0 ? [{ text, match: false }] : parts;
}
