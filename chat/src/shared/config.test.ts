import { describe, expect, it } from 'vitest';
import { API_BASE_URL, APP_ICON_URL, DC_HHHL_ORIGIN } from './config';

describe('shared config', () => {
  it('uses the dev proxy API base while running Vite tests', () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(API_BASE_URL).toBe('/api');
  });

  it('keeps the production origin constant available for external links', () => {
    expect(DC_HHHL_ORIGIN).toBe('https://dc.hhhl.cc');
  });

  it('cache-busts the shared app icon with the app version', () => {
    const iconUrl = new URL(APP_ICON_URL);

    expect(iconUrl.origin).toBe(DC_HHHL_ORIGIN);
    expect(iconUrl.pathname).toBe('/client-assets/icon.png');
    expect(iconUrl.searchParams.get('v')).toBe(__APP_VERSION__);
  });
});
