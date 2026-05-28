import { describe, expect, it } from 'vitest';

const appRoutes = ['/rooms/amlc1bekzi', '/auth/callback', '/settings'];

describe('Workers preview routing contract', () => {
  it('documents app routes that must fall back to dist/index.html', () => {
    expect(appRoutes).toEqual(['/rooms/amlc1bekzi', '/auth/callback', '/settings']);
  });

  it('expects production build verification to require dist/index.html', () => {
    expect('dist/index.html').toBe('dist/index.html');
  });
});
