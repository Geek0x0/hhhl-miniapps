const TOKEN_FIELD_PATTERN =
  /\b((?:BOT_TOKEN|HHHL_TOKEN|botToken|hhhlToken|token|access_token|i)\s*[=:]\s*["']?)(?!\[redacted\])[^&\s"',;)}]+(["']?)/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactSensitiveText(value: string, secrets: string[] = []): string {
  let redacted = value.replace(TOKEN_FIELD_PATTERN, '$1[redacted]$2');

  for (const secret of secrets) {
    if (secret.trim() === '') continue;
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), '[redacted]');
  }

  return redacted;
}
