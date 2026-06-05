import { describe, expect, it, vi } from 'vitest';
import { ApiError, AuthError, NetworkError, StorageError, redactSensitiveText } from './errors';
import { createLogger } from './logger';

describe('typed errors', () => {
  it('stores codes and messages', () => {
    expect(new ApiError('API_FAILED', 'Request failed').code).toBe('API_FAILED');
    expect(new AuthError('TOKEN_INVALID', 'Token invalid').code).toBe('TOKEN_INVALID');
    expect(new NetworkError('TIMEOUT', 'Timed out').code).toBe('TIMEOUT');
    expect(new StorageError('STORAGE_BLOCKED', 'Storage blocked').code).toBe('STORAGE_BLOCKED');
  });
});

describe('redactSensitiveText', () => {
  it('redacts token query strings and JSON token fields', () => {
    const raw = [
      'https://dc.hhhl.cc/streaming?i=secret-token',
      'https://dc.hhhl.cc/api?room=1&i=query-token&safe=1',
      'token=form-token',
      '{"i":"json-i-token"}',
      '{"token":"json-token"}',
    ].join(' ');

    expect(redactSensitiveText(raw)).toBe([
      'https://dc.hhhl.cc/streaming?i=[redacted]',
      'https://dc.hhhl.cc/api?room=1&i=[redacted]&safe=1',
      'token=[redacted]',
      '{"i":"[redacted]"}',
      '{"token":"[redacted]"}',
    ].join(' '));
  });
});

describe('createLogger', () => {
  it('redacts secrets before logging', () => {
    const warn = vi.fn();
    const logger = createLogger({ warn });

    logger.warn('token=secret-token');

    expect(warn).toHaveBeenCalledWith('token=[redacted]');
  });
});
