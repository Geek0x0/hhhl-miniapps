import { describe, expect, it } from 'vitest';
import {
  CLOUD_SETTINGS_APP,
  CLOUD_SETTINGS_SCHEMA_VERSION,
  compareUpdatedAt,
  createCloudSettingsDocument,
  parseCloudSettingsJson,
  SETTINGS_UPDATED_AT_KEY,
} from './settingsConfig';

describe('settingsConfig', () => {
  it('creates a versioned cloud settings document with UTC updatedAt', () => {
    const document = createCloudSettingsDocument({
      language: 'zh',
      themeMode: 'dark',
      favoriteUserIds: ['user-2', 'user-1'],
    }, '2026-06-05T01:02:03.004Z');

    expect(document).toEqual({
      schemaVersion: CLOUD_SETTINGS_SCHEMA_VERSION,
      app: CLOUD_SETTINGS_APP,
      updatedAt: '2026-06-05T01:02:03.004Z',
      preferences: {
        language: 'zh',
        themeMode: 'dark',
        favoriteUserIds: ['user-2', 'user-1'],
      },
    });
    expect(SETTINGS_UPDATED_AT_KEY).toBe('hhhl-chat:settings-updated-at');
  });

  it('parses and normalizes a valid cloud settings JSON document', () => {
    const parsed = parseCloudSettingsJson(JSON.stringify({
      schemaVersion: 1,
      app: 'hhhl-chat',
      updatedAt: '2026-06-05T01:02:03.004Z',
      preferences: {
        language: 'zh-CN',
        themeMode: 'light',
        favoriteUserIds: [' user-1 ', 'user-1', '', 'user-2'],
      },
      extraField: { keep: true },
    }));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document.preferences).toEqual({
        language: 'zh',
        themeMode: 'light',
        favoriteUserIds: ['user-1', 'user-2'],
      });
      expect(parsed.document.extraField).toEqual({ keep: true });
    }
  });

  it('rejects unsupported schema versions without producing a document', () => {
    const parsed = parseCloudSettingsJson(JSON.stringify({
      schemaVersion: 2,
      app: 'hhhl-chat',
      updatedAt: '2026-06-05T01:02:03.004Z',
      preferences: {
        language: 'en',
        themeMode: 'system',
        favoriteUserIds: [],
      },
    }));

    expect(parsed).toEqual({
      ok: false,
      code: 'UNSUPPORTED_SCHEMA',
      message: 'Unsupported settings schema version',
    });
  });

  it('rejects invalid JSON, invalid timestamps, and invalid preference shapes', () => {
    expect(parseCloudSettingsJson('{bad json')).toMatchObject({ ok: false, code: 'INVALID_JSON' });
    expect(parseCloudSettingsJson(JSON.stringify({
      schemaVersion: 1,
      app: 'hhhl-chat',
      updatedAt: '2026-06-05T01:02:03Z',
      preferences: { language: 'en', themeMode: 'system', favoriteUserIds: [] },
    }))).toMatchObject({ ok: false, code: 'INVALID_UPDATED_AT' });
    expect(parseCloudSettingsJson(JSON.stringify({
      schemaVersion: 1,
      app: 'hhhl-chat',
      updatedAt: '2026-06-05T01:02:03.000Z',
      preferences: { language: 'de', themeMode: 'system', favoriteUserIds: [] },
    }))).toMatchObject({ ok: false, code: 'INVALID_PREFERENCES' });
    expect(parseCloudSettingsJson(JSON.stringify({
      schemaVersion: 1,
      app: 'hhhl-chat',
      updatedAt: '2026-06-05T01:02:03.000Z',
      preferences: { language: 'en', themeMode: 'neon', favoriteUserIds: [] },
    }))).toMatchObject({ ok: false, code: 'INVALID_PREFERENCES' });
    expect(parseCloudSettingsJson(JSON.stringify({
      schemaVersion: 1,
      app: 'hhhl-chat',
      updatedAt: '2026-06-05T01:02:03.000Z',
      preferences: { language: 'en', themeMode: 'system', favoriteUserIds: 'user-1' },
    }))).toMatchObject({ ok: false, code: 'INVALID_PREFERENCES' });
  });

  it('compares updatedAt values by instant', () => {
    expect(compareUpdatedAt('2026-06-05T01:00:00.000Z', '2026-06-05T01:00:00.000Z')).toBe(0);
    expect(compareUpdatedAt('2026-06-05T01:00:01.000Z', '2026-06-05T01:00:00.000Z')).toBe(1);
    expect(compareUpdatedAt('2026-06-05T00:59:59.000Z', '2026-06-05T01:00:00.000Z')).toBe(-1);
    expect(() => compareUpdatedAt('bad-date', '2026-06-05T01:00:00.000Z')).toThrow('Invalid updatedAt timestamp');
  });

  it('preserves unknown compatible fields when building from a base document', () => {
    const base = {
      schemaVersion: 1 as const,
      app: 'hhhl-chat' as const,
      updatedAt: '2026-06-05T01:00:00.000Z',
      preferences: {
        language: 'en' as const,
        themeMode: 'system' as const,
        favoriteUserIds: [],
      },
      extraField: { keep: true },
    };

    const document = createCloudSettingsDocument({
      language: 'zh',
      themeMode: 'dark',
      favoriteUserIds: ['user-1'],
    }, '2026-06-05T02:00:00.000Z', base);

    expect(document.extraField).toEqual({ keep: true });
    expect(document.preferences).toEqual({
      language: 'zh',
      themeMode: 'dark',
      favoriteUserIds: ['user-1'],
    });
  });
});
