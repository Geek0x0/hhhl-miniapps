export function shouldBypassTelegramGate(mode: string = import.meta.env.MODE): boolean {
  return mode === 'development';
}

export function isAuthCallbackRoute(path: string = window.location.pathname): boolean {
  return path === '/auth/callback';
}

export function shouldRenderMiniApp(isTelegram: boolean, mode: string = import.meta.env.MODE, path: string = window.location.pathname): boolean {
  return isTelegram || shouldBypassTelegramGate(mode) || isAuthCallbackRoute(path);
}
