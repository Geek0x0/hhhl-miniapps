import { describe, expect, it } from 'vitest';
import { imageProxyUrl, previewProxyUrl, unwrapProxyUrl } from './mediaProxy';

const originalUrl = 'https://remote.example.test/files/photo.png';
const proxiedPreview = 'https://dc.hhhl.cc/proxy/preview.webp?url=https%3A%2F%2Fremote.example.test%2Ffiles%2Fphoto.png&fallback=1&preview=1';
const proxiedImage = 'https://dc.hhhl.cc/proxy/image.webp?url=https%3A%2F%2Fremote.example.test%2Ffiles%2Fphoto.png&fallback=1';

describe('mediaProxy', () => {
  it('builds Sharkey-compatible preview and image proxy urls', () => {
    expect(previewProxyUrl(originalUrl)).toBe(proxiedPreview);
    expect(imageProxyUrl(originalUrl)).toBe(proxiedImage);
  });

  it('unwraps existing proxy urls before building another proxy url', () => {
    expect(unwrapProxyUrl(proxiedPreview)).toBe(originalUrl);
    expect(imageProxyUrl(proxiedPreview)).toBe(proxiedImage);
  });

  it('normalizes relative proxy urls before unwrapping', () => {
    const relativeProxy = '/proxy/image.webp?url=https%3A%2F%2Fremote.example.test%2Ffiles%2Fphoto.png&fallback=1';

    expect(unwrapProxyUrl(relativeProxy)).toBe(originalUrl);
    expect(previewProxyUrl(relativeProxy)).toBe(proxiedPreview);
  });
});
