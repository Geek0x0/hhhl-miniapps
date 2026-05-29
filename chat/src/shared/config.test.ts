import { describe, expect, it } from 'vitest';
import { API_BASE_URL, DC_HHHL_ORIGIN } from './config';

describe('shared config', () => {
  it('uses the dev proxy API base while running Vite tests', () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(API_BASE_URL).toBe('/api');
  });

  it('keeps the production origin constant available for external links', () => {
    expect(DC_HHHL_ORIGIN).toBe('https://dc.hhhl.cc');
  });
});
