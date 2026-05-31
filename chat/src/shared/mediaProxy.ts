import { DC_HHHL_ORIGIN } from './config';

const MEDIA_PROXY_BASE_URL = `${DC_HHHL_ORIGIN}/proxy`;

function decodeHtmlEntities(value: string): string {
  return value.replace(/&amp;/g, '&');
}

function absoluteUrl(value: string): string {
  const decoded = decodeHtmlEntities(value.trim());

  if (/^(?:https?:|blob:|data:)/.test(decoded)) {
    return decoded;
  }

  return decoded.startsWith('/') ? `${DC_HHHL_ORIGIN}${decoded}` : decoded;
}

function isMediaProxyUrl(rawUrl: string, parsedUrl: URL): boolean {
  return rawUrl.startsWith(`${MEDIA_PROXY_BASE_URL}/`) || rawUrl.startsWith('/proxy/') || parsedUrl.href.startsWith(`${MEDIA_PROXY_BASE_URL}/`);
}

function proxyImageUrl(value: string, type: 'preview' | 'image'): string {
  const params = new URLSearchParams({
    url: unwrapProxyUrl(value),
    fallback: '1',
  });

  if (type === 'preview') {
    params.set('preview', '1');
  }

  return `${MEDIA_PROXY_BASE_URL}/${type === 'preview' ? 'preview.webp' : 'image.webp'}?${params.toString()}`;
}

export function unwrapProxyUrl(value: string): string {
  const rawUrl = decodeHtmlEntities(value.trim());
  const normalizedUrl = absoluteUrl(rawUrl);

  try {
    const parsedUrl = new URL(normalizedUrl, DC_HHHL_ORIGIN);
    return isMediaProxyUrl(rawUrl, parsedUrl) ? absoluteUrl(parsedUrl.searchParams.get('url') ?? normalizedUrl) : normalizedUrl;
  } catch {
    return normalizedUrl;
  }
}

export function previewProxyUrl(value: string): string {
  return proxyImageUrl(value, 'preview');
}

export function imageProxyUrl(value: string): string {
  return proxyImageUrl(value, 'image');
}
