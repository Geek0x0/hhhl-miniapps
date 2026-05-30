import { DC_HHHL_ORIGIN } from './config';

export interface NormalizedAvatarUrl {
  avatarUrl: string | null;
  avatarFallbackUrl: string | null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&amp;/g, '&');
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function absoluteUrl(value: unknown): string | null {
  const raw = stringField(value);
  if (raw == null) {
    return null;
  }

  const url = decodeHtmlEntities(raw);

  if (/^(?:https?:|blob:|data:)/.test(url)) {
    return url;
  }

  return url.startsWith('/') ? `${DC_HHHL_ORIGIN}${url}` : url;
}

function proxyAvatarFallbackUrl(avatarUrl: string | null): string | null {
  if (avatarUrl == null) {
    return null;
  }

  try {
    const url = new URL(avatarUrl, DC_HHHL_ORIGIN);
    if (!url.pathname.endsWith('/proxy/avatar.webp')) {
      return null;
    }

    return absoluteUrl(url.searchParams.get('url'));
  } catch {
    return null;
  }
}

export function normalizeAvatarUrl(value: unknown): NormalizedAvatarUrl {
  const avatarUrl = absoluteUrl(value);
  return {
    avatarUrl,
    avatarFallbackUrl: proxyAvatarFallbackUrl(avatarUrl),
  };
}

export function avatarFallbackUrl(avatarUrl: unknown, fallbackUrl: unknown): string | null {
  return absoluteUrl(fallbackUrl) ?? proxyAvatarFallbackUrl(absoluteUrl(avatarUrl));
}

export function avatarDisplayUrl(avatarUrl: unknown, fallbackUrl: unknown): string | null {
  const primary = absoluteUrl(avatarUrl);
  const fallback = avatarFallbackUrl(primary, fallbackUrl);

  if (primary == null) {
    return fallback;
  }

  return primary;
}

export function useAvatarFallback(event: Event, fallbackUrl: string | null | undefined): void {
  const element = event.currentTarget;
  if (!(element instanceof globalThis.HTMLImageElement)) {
    return;
  }

  // If the image has a referrerpolicy but no crossorigin, try adding crossorigin first
  if (!element.hasAttribute('crossorigin') && element.getAttribute('referrerpolicy') === 'no-referrer') {
    element.setAttribute('crossorigin', 'anonymous');
    element.removeAttribute('referrerpolicy');
    // Force reload by re-assigning src
    const currentSrc = element.currentSrc || element.src;
    element.src = currentSrc;
    return;
  }

  const fallback = avatarFallbackUrl(element.currentSrc || element.src, fallbackUrl);
  if (fallback == null) {
    // Hide broken image
    element.style.display = 'none';
    return;
  }

  const current = element.currentSrc || element.src;
  if (current === fallback) {
    element.style.display = 'none';
    return;
  }

  element.src = fallback;
}
