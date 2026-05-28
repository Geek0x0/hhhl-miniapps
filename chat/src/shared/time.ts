export function nowIso(): string {
  return new Date().toISOString();
}

export function formatShortTime(value: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
