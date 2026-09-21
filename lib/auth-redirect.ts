/**
 * Allow only same-origin relative paths after OAuth.
 * Rejects protocol-relative URLs (`//evil.com`), absolute URLs, and path tricks.
 */
export function safeAuthNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('://') || next.includes('\\') || next.includes('\0')) return fallback;
  return next;
}
