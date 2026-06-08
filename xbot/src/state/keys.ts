export interface StateKeys {
  binding: (telegramUserId: string) => string;
  telegramMap: (telegramUserId: string, telegramMessageId: number) => string;
  telegramMapPrefix: (telegramUserId: string) => string;
  hhhlMap: (roomId: string, hhhlMessageId: string) => string;
  hhhlMapPrefix: (roomId: string) => string;
  status: (telegramUserId: string) => string;
}

function encodePart(value: string | number): string {
  return encodeURIComponent(String(value));
}

export function createKeys(prefix: string): StateKeys {
  const root = prefix.replace(/:+$/, '');

  return {
    binding: (telegramUserId) => `${root}:binding:${encodePart(telegramUserId)}`,
    telegramMap: (telegramUserId, telegramMessageId) =>
      `${root}:map:telegram:${encodePart(telegramUserId)}:${encodePart(telegramMessageId)}`,
    telegramMapPrefix: (telegramUserId) => `${root}:map:telegram:${encodePart(telegramUserId)}:`,
    hhhlMap: (roomId, hhhlMessageId) => `${root}:map:hhhl:${encodePart(roomId)}:${encodePart(hhhlMessageId)}`,
    hhhlMapPrefix: (roomId) => `${root}:map:hhhl:${encodePart(roomId)}:`,
    status: (telegramUserId) => `${root}:status:${encodePart(telegramUserId)}`,
  };
}
