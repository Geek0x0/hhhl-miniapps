import { parseStartParam, type StartParam } from './startParam';

export interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface TelegramMainButton {
  setText: (text: string) => void;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    start_param?: string;
    tgWebAppStartParam?: string;
    [key: string]: unknown;
  };
  platform: string;
  themeParams: Record<string, string | undefined>;
  ready?: () => void;
  expand?: () => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  BackButton?: TelegramBackButton;
  MainButton?: TelegramMainButton;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export interface TelegramLaunchContext {
  platform: string;
  startParam: StartParam;
  themeParams: Record<string, string | undefined>;
}

let backButtonHandler: (() => void) | undefined;

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function isTelegramEnvironment(): boolean {
  return getTelegramWebApp() != null;
}

export function getTelegramLaunchContext(): TelegramLaunchContext {
  const webApp = getTelegramWebApp();
  const rawStartParam = webApp?.initDataUnsafe.start_param ?? webApp?.initDataUnsafe.tgWebAppStartParam;

  return {
    platform: webApp?.platform ?? 'unknown',
    startParam: parseStartParam(rawStartParam),
    themeParams: webApp?.themeParams ?? {},
  };
}

export function readyTelegram(): void {
  getTelegramWebApp()?.ready?.();
}

export function expandTelegram(): void {
  getTelegramWebApp()?.expand?.();
}

export function openExternalLink(url: string): void {
  const webApp = getTelegramWebApp();

  if (webApp?.openLink != null) {
    webApp.openLink(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export function showBackButton(callback: () => void): void {
  const button = getTelegramWebApp()?.BackButton;
  if (button == null) {
    return;
  }

  if (backButtonHandler != null) {
    button.offClick(backButtonHandler);
  }

  backButtonHandler = callback;
  button.onClick(callback);
  button.show();
}

export function hideBackButton(): void {
  const button = getTelegramWebApp()?.BackButton;
  if (button == null) {
    backButtonHandler = undefined;
    return;
  }

  if (backButtonHandler != null) {
    button.offClick(backButtonHandler);
  }

  backButtonHandler = undefined;
  button.hide();
}
