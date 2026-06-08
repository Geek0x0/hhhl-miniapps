export const DC_HHHL_ORIGIN = 'https://dc.hhhl.cc';
export const API_BASE_URL = import.meta.env.DEV ? '/api' : `${DC_HHHL_ORIGIN}/api`;
export const BOT_WORKER_URL = (import.meta.env.VITE_BOT_WORKER_URL ?? '').replace(/\/$/, '');
export const STORAGE_PREFIX = 'hhhl-chat';
export const DEFAULT_PAGE_SIZE = 30;
export const MINI_APP_NAME = 'HHHL Chat Mini App';
