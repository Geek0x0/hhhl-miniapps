#!/usr/bin/env node

const BOT_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertNoTokenLikeValue(value) {
  if (/(^|[?&\s])(token|i)=/i.test(value) || /secret/i.test(value)) {
    throw new Error('TOKEN_LIKE_VALUE');
  }
}

function buildStartAppLink(botUsername, roomId) {
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

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || process.argv[index + 1] == null) {
    return null;
  }
  return process.argv[index + 1];
}

try {
  const bot = readArg('--bot');
  const room = readArg('--room');

  if (bot == null || room == null) {
    throw new Error('USAGE: generate-startapp-link --bot <username> --room <roomId>');
  }

  process.stdout.write(`${buildStartAppLink(bot, room)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
