import { fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/shared/types';
import KeySearchPanel from './KeySearchPanel.vue';

const KEY_TEXT = 'sk-rMxrGBt05fjW2JMOBz6c085AExVE7qrd';

function message(text: string): ChatMessage {
  return {
    id: 'key-1',
    roomId: 'room-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    text,
    user: { id: 'amk1v51gkh1u0001', username: 'ls', name: 'LS' },
  };
}

describe('KeySearchPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows and copies only the key token from messages with surrounding text', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(KeySearchPanel, {
      props: {
        results: [message(`提前发一下${KEY_TEXT}，晚点用`)],
        loading: false,
        error: null,
      },
    });

    expect(screen.getByText(KEY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(/提前发一下/)).not.toBeInTheDocument();

    await fireEvent.click(screen.getByText(KEY_TEXT));

    expect(writeText).toHaveBeenCalledWith(KEY_TEXT);
  });
});
