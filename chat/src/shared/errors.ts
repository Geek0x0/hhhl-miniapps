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

export function redactSensitiveText(value: string): string {
  return value
    .replace(/([?&]i=)[^\s&]+/g, '$1[redacted]')
    .replace(/\b(token=)[^\s&]+/g, '$1[redacted]')
    .replace(/("i"\s*:\s*")[^"]+("?)/g, '$1[redacted]$2')
    .replace(/("token"\s*:\s*")[^"]+("?)/g, '$1[redacted]$2');
}
