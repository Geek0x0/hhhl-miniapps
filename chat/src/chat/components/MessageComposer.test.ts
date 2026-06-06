import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MessageComposer from './MessageComposer.vue';

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('deferred promise was not initialized');
  };
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderComposer(props: Partial<InstanceType<typeof MessageComposer>['$props']> = {}) {
  return render(MessageComposer, {
    props: {
      replyTarget: null,
      quoteTarget: null,
      mentionMembers: [],
      draftText: '',
      ...props,
    },
  });
}

describe('MessageComposer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders draft text and emits draft changes', async () => {
    const { emitted, getByPlaceholderText, rerender } = renderComposer({ draftText: 'saved draft' });
    const input = getByPlaceholderText('Message') as HTMLTextAreaElement;

    expect(input.value).toBe('saved draft');

    await fireEvent.update(input, 'edited draft');

    expect(emitted('draft-change')?.at(-1)).toEqual(['edited draft']);

    await rerender({ draftText: 'restored room draft' });

    expect(input.value).toBe('restored room draft');
  });

  it('does not emit draft changes for parent-driven draft restores', async () => {
    const { emitted, getByPlaceholderText, rerender } = renderComposer({ draftText: 'saved draft' });
    const input = getByPlaceholderText('Message') as HTMLTextAreaElement;

    await rerender({ draftText: 'restored room draft' });

    await waitFor(() => {
      expect(input.value).toBe('restored room draft');
    });
    expect(emitted('draft-change')).toBeUndefined();

    await fireEvent.update(input, 'user draft');

    expect(emitted('draft-change')?.at(-1)).toEqual(['user draft']);
  });

  it('keeps failed uploads in the composer and allows retry', async () => {
    const sendFileRequest = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, stage: 'upload', error: 'upload failed' })
      .mockResolvedValueOnce({ ok: true, localId: 'local-file', serverId: 'm9' });
    renderComposer({ sendFileRequest });
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Upload failed: upload failed')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }));

    await waitFor(() => {
      expect(sendFileRequest).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('upload failed')).not.toBeInTheDocument();
  });

  it('does not duplicate in-flight upload requests from repeated send or retry clicks', async () => {
    const firstUpload = deferred<
      { ok: false; stage: 'upload'; error: string }
    >();
    const retryUpload = deferred<
      { ok: true; localId: string; serverId: string }
    >();
    const sendFileRequest = vi
      .fn()
      .mockReturnValueOnce(firstUpload.promise)
      .mockReturnValueOnce(retryUpload.promise);
    renderComposer({ sendFileRequest });
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
    const sendButton = screen.getByRole('button', { name: 'Send' });

    await fireEvent.click(sendButton);
    await fireEvent.click(sendButton);

    expect(sendFileRequest).toHaveBeenCalledTimes(1);

    firstUpload.resolve({ ok: false, stage: 'upload', error: 'upload failed' });
    expect(await screen.findByText('Upload failed: upload failed')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Retry upload' });
    await fireEvent.click(retryButton);
    await fireEvent.click(retryButton);
    await fireEvent.click(sendButton);

    expect(sendFileRequest).toHaveBeenCalledTimes(2);

    retryUpload.resolve({ ok: true, localId: 'local-file', serverId: 'm9' });
    await waitFor(() => {
      expect(screen.queryByText('Upload failed: upload failed')).not.toBeInTheDocument();
    });
  });

  it('shows a file size validation error before sending', async () => {
    const sendFileRequest = vi.fn();
    renderComposer({ sendFileRequest });
    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.bin', { type: 'application/octet-stream' });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [oversized] } });

    expect(screen.getByText('File is larger than 25 MB.')).toBeInTheDocument();
    expect(sendFileRequest).not.toHaveBeenCalled();
  });

  it('revokes preview object URLs when uploads are removed and component unmounts', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const { unmount } = renderComposer();
    const image = new File(['image'], 'photo.png', { type: 'image/png' });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [image] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    await fireEvent.change(fileInput as HTMLInputElement, { target: { files: [image] } });
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
