const TOKEN_FIELD_PATTERN =
  /\b((?:BOT_TOKEN|BOT_WEBHOOK_SECRET|HHHL_TOKEN|botToken|botWebhookSecret|hhhlToken|token|secret|access_token|i)\s*[=:]\s*["']?)(?!\[redacted\])[^&\s"',;)}]+(["']?)/gi;
const JSON_TOKEN_FIELD_PATTERN =
  /(["'](?:BOT_TOKEN|BOT_WEBHOOK_SECRET|HHHL_TOKEN|botToken|botWebhookSecret|hhhlToken|token|secret|access_token|i)["']\s*:\s*)(["'])(?!\[redacted\])(?:\\.|(?!\2)[^\\])*\2/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactSensitiveText(value: string, secrets: string[] = []): string {
  let redacted = value.replace(JSON_TOKEN_FIELD_PATTERN, '$1$2[redacted]$2');
  redacted = redacted.replace(TOKEN_FIELD_PATTERN, '$1[redacted]$2');

  const sortedSecrets = [...new Set(secrets.filter((secret) => secret.trim() !== ''))].sort(
    (left, right) => right.length - left.length,
  );

  for (const secret of sortedSecrets) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), '[redacted]');
  }

  return redacted;
}
