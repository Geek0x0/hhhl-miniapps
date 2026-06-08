import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/shared/types';
import { deliverKeySearchResultToBot } from './keyDelivery';

const KEY_TEXT = 'sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd';

function message(text: string): ChatMessage {
  return {
    id: 'key-1',
    roomId: 'amlc1bekzi',
    createdAt: '2026-06-08T00:00:00.000Z',
    text,
    user: { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' },
  };
}

function createSuccessfulFetcher() {
  return vi.fn(async (input: string, init: RequestInit) => {
    void input;
    void init;
    return Response.json({ ok: true });
  });
}

describe('deliverKeySearchResultToBot', () => {
  it('posts only the extracted key result to the bot worker', async () => {
    const fetcher = createSuccessfulFetcher();

    await expect(deliverKeySearchResultToBot({
      roomId: 'amlc1bekzi',
      message: message(`提前发一下${KEY_TEXT}`),
      initData: 'signed-telegram-init-data',
      botWorkerUrl: 'https://bot.example.com/',
      fetcher,
    })).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith('https://bot.example.com/webapp/key-result', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        initData: 'signed-telegram-init-data',
        roomId: 'amlc1bekzi',
        status: 'found',
        key: KEY_TEXT,
      }),
    });
    expect(String((fetcher.mock.calls[0]?.[1] as RequestInit).body)).not.toContain('hhhl-token');
  });

  it('reports no result without sending a key field', async () => {
    const fetcher = createSuccessfulFetcher();

    await expect(deliverKeySearchResultToBot({
      roomId: 'amlc1bekzi',
      message: null,
      initData: 'signed-telegram-init-data',
      botWorkerUrl: 'https://bot.example.com',
      fetcher,
    })).resolves.toBe(true);

    expect(JSON.parse(String((fetcher.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      initData: 'signed-telegram-init-data',
      roomId: 'amlc1bekzi',
      status: 'not_found',
    });
  });

  it('reports key search failures without sending a key field', async () => {
    const fetcher = createSuccessfulFetcher();

    await expect(deliverKeySearchResultToBot({
      roomId: 'amlc1bekzi',
      message: message(KEY_TEXT),
      initData: 'signed-telegram-init-data',
      botWorkerUrl: 'https://bot.example.com',
      fetcher,
      failed: true,
    })).resolves.toBe(true);

    expect(JSON.parse(String((fetcher.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      initData: 'signed-telegram-init-data',
      roomId: 'amlc1bekzi',
      status: 'failed',
    });
  });
});
