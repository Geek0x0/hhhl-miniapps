export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class StorageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

const TOKEN_FIELD_PATTERN =
  /\b((?:access_token|refresh_token|id_token|authToken|botToken|token)\s*[=:]\s*["']?)[^\s&"',;)}\]]+(["']?)/gi;
const BEARER_TOKEN_PATTERN = /\b(Bearer\s+)[^\s"',;)}\]]{3,}/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(/([?&]i=)[^\s&]+/g, '$1[redacted]')
    .replace(/("i"\s*:\s*")[^"]+("?)/g, '$1[redacted]$2')
    .replace(/("token"\s*:\s*")[^"]+("?)/g, '$1[redacted]$2')
    .replace(TOKEN_FIELD_PATTERN, '$1[redacted]$2')
    .replace(BEARER_TOKEN_PATTERN, '$1[redacted]');
}
