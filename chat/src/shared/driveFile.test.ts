import { describe, expect, it } from 'vitest';
import { normalizeDriveFile } from './driveFile';

describe('driveFile', () => {
  it('normalizes relative Drive file URLs', () => {
    expect(normalizeDriveFile({
      id: 'file-1',
      name: 'photo.png',
      type: 'image/png',
      url: '/files/photo.png',
      thumbnailUrl: '/files/photo-thumb.png',
    })).toMatchObject({
      id: 'file-1',
      name: 'photo.png',
      type: 'image/png',
      url: 'https://dc.hhhl.cc/files/photo.png',
      thumbnailUrl: 'https://dc.hhhl.cc/files/photo-thumb.png',
    });
  });

  it('prefers public web URLs over same-origin file URLs for mini app rendering', () => {
    expect(normalizeDriveFile({
      id: 'file-1',
      name: 'photo.png',
      type: 'image/png',
      url: '/files/private-photo.png',
      webpublicUrl: '/files/public-photo.png',
      thumbnailUrl: '/files/private-thumb.png',
    })).toMatchObject({
      id: 'file-1',
      name: 'photo.png',
      type: 'image/png',
      url: 'https://dc.hhhl.cc/files/public-photo.png',
      thumbnailUrl: 'https://dc.hhhl.cc/files/private-thumb.png',
    });
  });
});
