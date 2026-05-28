export type StartParam =
  | { type: 'none' }
  | { type: 'room'; roomId: string }
  | { type: 'invalid'; raw: string };

export function parseStartParam(raw: string | undefined): StartParam {
  if (raw == null || raw.trim() === '') {
    return { type: 'none' };
  }

  const value = raw.trim();
  const roomMatch = /^room_([A-Za-z0-9_-]+)$/.exec(value);

  if (roomMatch != null) {
    return { type: 'room', roomId: roomMatch[1] };
  }

  return { type: 'invalid', raw: value };
}
