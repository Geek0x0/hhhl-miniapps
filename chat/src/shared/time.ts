export function nowIso(): string {
  return new Date().toISOString();
}

export function formatShortTime(value: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function twoDigit(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatMessageTimestamp(value: string): string {
  const date = new Date(value);

  return `${twoDigit(date.getMonth() + 1)}-${twoDigit(date.getDate())} ${twoDigit(date.getHours())}:${twoDigit(date.getMinutes())}`;
}
