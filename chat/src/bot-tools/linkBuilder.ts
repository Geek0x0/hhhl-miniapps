const BOT_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertNoTokenLikeValue(value: string): void {
  if (/(^|[?&\s])(token|i)=/i.test(value) || /secret/i.test(value)) {
    throw new Error('TOKEN_LIKE_VALUE');
  }
}

export function buildStartAppLink(botUsername: string, roomId: string): string {
  const bot = botUsername.trim();
  const room = roomId.trim();

  assertNoTokenLikeValue(bot);
  assertNoTokenLikeValue(room);

  if (bot.startsWith('@') || !BOT_USERNAME_PATTERN.test(bot)) {
    throw new Error('BOT_USERNAME_INVALID');
  }

  if (room === '' || !ROOM_ID_PATTERN.test(room)) {
    throw new Error('ROOM_ID_INVALID');
  }

  return `https://t.me/${bot}?startapp=room_${room}`;
}
