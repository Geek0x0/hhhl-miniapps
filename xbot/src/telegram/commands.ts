export type BotCommand =
  | { type: 'bind'; roomId: string; roomName: string | null }
  | { type: 'unbind' }
  | { type: 'rename'; roomName: string }
  | { type: 'list' }
  | { type: 'status' }
  | { type: 'help' }
  | { type: 'unknown' }
  | { type: 'invalid'; reason: string };

export const commandHelpText = [
  '可用命令：',
  '/bind <roomId> [显示名] - 绑定一个 HHHL 聊天室',
  '/unbind - 解绑当前聊天室并停止转发',
  '/rename <显示名> - 修改当前聊天室显示名',
  '/list - 查看当前绑定',
  '/status - 查看实时连接状态',
  '/help - 显示帮助',
  '/start - 显示帮助',
].join('\n');

const bindUsage = '用法：/bind <roomId> [显示名]';
const renameUsage = '用法：/rename <显示名>';
const unbindUsage = '用法：/unbind';
const listUsage = '用法：/list';
const statusUsage = '用法：/status';
const helpUsage = '用法：/help';
const startUsage = '用法：/start';

function splitCommand(text: string): { command: string; rest: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;

  const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (match == null) return null;

  return {
    command: match[1].replace(/@\w+$/, '').toLowerCase(),
    rest: (match[2] ?? '').trim(),
  };
}

export function parseCommand(text: string): BotCommand | null {
  const parsed = splitCommand(text);
  if (parsed == null) return null;

  if (parsed.command === '/bind') {
    const match = /^(\S+)(?:\s+([\s\S]+))?$/.exec(parsed.rest);
    if (match == null) return { type: 'invalid', reason: bindUsage };

    return {
      type: 'bind',
      roomId: match[1],
      roomName: match[2]?.trim() || null,
    };
  }

  if (parsed.command === '/rename') {
    if (parsed.rest === '') return { type: 'invalid', reason: renameUsage };
    return { type: 'rename', roomName: parsed.rest };
  }

  if (parsed.command === '/unbind') {
    if (parsed.rest !== '') return { type: 'invalid', reason: unbindUsage };
    return { type: 'unbind' };
  }

  if (parsed.command === '/list') {
    if (parsed.rest !== '') return { type: 'invalid', reason: listUsage };
    return { type: 'list' };
  }

  if (parsed.command === '/status') {
    if (parsed.rest !== '') return { type: 'invalid', reason: statusUsage };
    return { type: 'status' };
  }

  if (parsed.command === '/help') {
    if (parsed.rest !== '') return { type: 'invalid', reason: helpUsage };
    return { type: 'help' };
  }

  if (parsed.command === '/start') {
    if (parsed.rest !== '') return { type: 'invalid', reason: startUsage };
    return { type: 'help' };
  }

  return { type: 'unknown' };
}
