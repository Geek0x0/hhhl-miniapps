export const KEY_SEARCH_QUERY = 'sk-';
export const KEY_SEARCH_USER_ID = 'amk1v51gkh1u0001';

const KEY_TOKEN_PATTERN = /sk-[A-Za-z0-9]{32}(?![A-Za-z0-9])/;

export function extractKeyToken(text: string | null | undefined): string | null {
  return text?.match(KEY_TOKEN_PATTERN)?.[0] ?? null;
}
