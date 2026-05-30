import { describe, expect, it } from 'vitest';
import { avatarDisplayUrl, avatarFallbackUrl, normalizeAvatarUrl, useAvatarFallback } from './avatarUrl';

const proxyUrl = 'https://dc.hhhl.cc/proxy/avatar.webp?url=https%3A%2F%2Fdc.hhhl.cc%2Ffiles%2Fwebpublic-avatar.png&avatar=1';
const originalUrl = 'https://dc.hhhl.cc/files/webpublic-avatar.png';

describe('avatarUrl', () => {
  it('extracts original file urls from dc proxy avatar urls', () => {
    expect(normalizeAvatarUrl(proxyUrl)).toEqual({
      avatarUrl: proxyUrl,
      avatarFallbackUrl: originalUrl,
    });
  });

  it('renders proxied avatars first and keeps the original file url as fallback', () => {
    expect(avatarDisplayUrl(proxyUrl, null)).toBe(proxyUrl);
    expect(avatarDisplayUrl(proxyUrl, originalUrl)).toBe(proxyUrl);
    expect(avatarFallbackUrl(proxyUrl, null)).toBe(originalUrl);
  });

  it('keeps non-proxy avatar urls unchanged for rendering', () => {
    expect(avatarDisplayUrl('/avatar.png', null)).toBe('https://dc.hhhl.cc/avatar.png');
    expect(avatarFallbackUrl('/avatar.png', null)).toBeNull();
  });

  it('falls back to the original file url when a proxied avatar image errors', () => {
    const image = document.createElement('img');
    image.src = proxyUrl;
    const event = new Event('error');
    Object.defineProperty(event, 'currentTarget', { value: image });

    useAvatarFallback(event, null);

    expect(image.src).toBe(originalUrl);
  });
});
