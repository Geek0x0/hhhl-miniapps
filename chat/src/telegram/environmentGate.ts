export function shouldBypassTelegramGate(mode: string = import.meta.env.MODE): boolean {
  return mode === 'development';
}

export function shouldRenderMiniApp(isTelegram: boolean, mode: string = import.meta.env.MODE): boolean {
  return isTelegram || shouldBypassTelegramGate(mode);
}
