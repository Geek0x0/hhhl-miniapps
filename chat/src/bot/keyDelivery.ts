import { BOT_WORKER_URL } from '@/shared/config';
import type { ChatMessage } from '@/shared/types';
import { getTelegramWebApp } from '@/telegram/telegram';
import { extractKeyToken } from '@/chat/keySearch';

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;
type KeyDeliveryRequest =
  | { initData: string; roomId: string; status: 'failed' | 'not_found' }
  | { initData: string; roomId: string; status: 'found'; key: string };

export interface DeliverKeySearchResultOptions {
  roomId: string;
  message: ChatMessage | null;
  initData?: string;
  botWorkerUrl?: string;
  fetcher?: Fetcher;
  failed?: boolean;
}

export async function deliverKeySearchResultToBot(options: DeliverKeySearchResultOptions): Promise<boolean> {
  const botWorkerUrl = (options.botWorkerUrl ?? BOT_WORKER_URL).replace(/\/$/, '');
  const initData = options.initData ?? getTelegramWebApp()?.initData ?? '';
  if (botWorkerUrl === '' || initData === '') {
    return false;
  }

  const key = options.failed === true ? null : extractKeyToken(options.message?.text);
  let body: KeyDeliveryRequest;
  if (options.failed === true) {
    body = {
      initData,
      roomId: options.roomId,
      status: 'failed',
    };
  } else if (key == null) {
    body = {
      initData,
      roomId: options.roomId,
      status: 'not_found',
    };
  } else {
    body = {
      initData,
      roomId: options.roomId,
      status: 'found',
      key,
    };
  }
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);

  try {
    const response = await fetcher(`${botWorkerUrl}/webapp/key-result`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}
