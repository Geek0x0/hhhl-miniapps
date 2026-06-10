import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import LoginGuide from './LoginGuide.vue';

describe('LoginGuide', () => {
  it('shows auth errors in a floating alert', () => {
    render(LoginGuide, {
      props: {
        error: 'authorization failed',
      },
    });

    const alert = screen.getByRole('alert');

    expect(alert).toHaveTextContent('authorization failed');
    expect(alert).toHaveClass('key-copy-toast');
    expect(alert).toHaveClass('key-copy-toast--error');
  });
});
