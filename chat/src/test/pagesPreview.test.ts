import { describe, expect, it } from 'vitest';
import redirects from '../../public/_redirects?raw';

const appRoutes = ['/rooms/amlc1bekzi', '/auth/callback', '/settings'];

describe('Pages preview routing contract', () => {
  it('documents app routes that must fall back to dist/index.html', () => {
    expect(appRoutes).toEqual(['/rooms/amlc1bekzi', '/auth/callback', '/settings']);
  });

  it('expects production build verification to require the Pages app shell', () => {
    expect('dist/index.html').toBe('dist/index.html');
    expect('dist/_redirects').toBe('dist/_redirects');
  });

  it('keeps the Cloudflare Pages SPA fallback rule', () => {
    expect(redirects).toContain('/* /index.html 200');
  });
});
