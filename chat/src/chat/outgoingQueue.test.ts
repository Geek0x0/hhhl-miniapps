import { describe, expect, it } from 'vitest';
import { createPendingMessage, failPendingMessage, removePendingMessage, retryPendingMessage, sendPendingMessage } from './outgoingQueue';

describe('outgoingQueue', () => {
  it('creates pending text/file/reply/quote payloads', () => {
    const pending = createPendingMessage({
      localId: 'local-1',
      roomId: 'room-1',
      text: 'hello',
      fileId: 'file-1',
      replyId: 'reply-1',
      quoteId: 'quote-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(pending).toMatchObject({
      localId: 'local-1',
      status: 'pending',
      payload: {
        toRoomId: 'room-1',
        text: 'hello',
        fileId: 'file-1',
        replyId: 'reply-1',
        quoteId: 'quote-1',
      },
    });
  });

  it('marks pending messages as sent, failed, retrying, and removable', () => {
    const first = createPendingMessage({ localId: 'local-1', roomId: 'room-1', text: 'hello', createdAt: '2026-01-01T00:00:00.000Z' });
    const failed = failPendingMessage([first], 'local-1', 'network');
    const retrying = retryPendingMessage(failed, 'local-1');
    const sent = sendPendingMessage(retrying, 'local-1', 'm1');
    const removed = removePendingMessage(failed, 'local-1');

    expect(failed[0]).toMatchObject({ status: 'failed', error: 'network' });
    expect(retrying[0]).toMatchObject({ status: 'pending', error: null });
    expect(sent[0]).toMatchObject({ status: 'sent', serverId: 'm1' });
    expect(removed).toEqual([]);
  });
});
