const ALLOWED_HOSTS = new Set([
  "api.cashercollection.com",
  "cashercollection.com",
]);

export function isProxyableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return ALLOWED_HOSTS.has(u.host);
  } catch {
    return false;
  }
}

export function proxyImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!isProxyableImageUrl(url)) return url;
  return `/api/img?url=${encodeURIComponent(url)}`;
}

export const ALLOWED_IMAGE_HOSTS = ALLOWED_HOSTS;
