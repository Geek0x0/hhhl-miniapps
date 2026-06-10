import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import LoginGuide from './LoginGuide.vue';

describe('LoginGuide', () => {
  it('shows the app version at the bottom of the login panel', () => {
    render(LoginGuide);

    expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

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
