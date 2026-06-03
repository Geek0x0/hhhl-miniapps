import { render } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import ReplyPreview from './ReplyPreview.vue';

describe('ReplyPreview', () => {
  it('renders long reply target text in a wrapping content element', () => {
    const { container } = render(ReplyPreview, {
      props: {
        label: 'Replying to Alice',
        message: {
          id: 'm1',
          roomId: 'room-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          text: 'https://example.com/really/long/path/that/should/not/stretch/the/composer/past/the/current/width',
        },
      },
    });

    expect(container.querySelector('.reply-preview__content')).toHaveTextContent('https://example.com/really/long/path');
  });
});
