import { type NextRequest, NextResponse } from 'next/server';

/** Supabase auth session cookies (including chunk suffixes like `.0`, `.1`). */
const AUTH_COOKIE_RE = /^sb-.*-auth-token(?:\.\d+)?$/;
const AUTH_COOKIE_EXTRA_RE = /^sb-.*-auth-token-/;

export function isSupabaseAuthCookie(name: string): boolean {
  return AUTH_COOKIE_RE.test(name) || AUTH_COOKIE_EXTRA_RE.test(name);
}

export function isInvalidUtf8AuthError(error: unknown): boolean {
  return error instanceof Error && /Invalid UTF-8 sequence/i.test(error.message);
}

/** Drop auth cookies that cannot be decoded so @supabase/ssr does not crash. */
export function sanitizeRequestCookies(
  cookies: { name: string; value: string }[]
): { name: string; value: string }[] {
  const byName = new Map(cookies.map((c) => [c.name, c.value]));
  const drop = new Set<string>();

  const baseKeys = new Set<string>();
  for (const { name } of cookies) {
    if (!AUTH_COOKIE_RE.test(name)) continue;
    baseKeys.add(name.replace(/\.\d+$/, ''));
  }

  for (const base of baseKeys) {
    const combined = combineCookieChunks(base, byName);
    if (combined == null) continue;
    if (!isDecodableAuthCookieValue(combined)) {
      drop.add(base);
      for (const { name } of cookies) {
        if (name === base || name.startsWith(`${base}.`)) drop.add(name);
      }
    }
  }

  if (drop.size === 0) return cookies;
  return cookies.filter((c) => !drop.has(c.name));
}

function combineCookieChunks(
  base: string,
  byName: Map<string, string>
): string | null {
  if (byName.has(base)) return byName.get(base)!;

  const parts: string[] = [];
  for (let i = 0; ; i += 1) {
    const part = byName.get(`${base}.${i}`);
    if (part == null) break;
    parts.push(part);
  }
  return parts.length ? parts.join('') : null;
}

function isDecodableAuthCookieValue(value: string): boolean {
  try {
    const raw = value.startsWith('base64-') ? value.slice('base64-'.length) : value;
    // Prefer standard base64url when prefixed; otherwise accept JSON session blobs.
    if (value.startsWith('base64-')) {
      const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
      const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
      const json = Buffer.from(normalized + pad, 'base64').toString('utf8');
      JSON.parse(json);
      return true;
    }
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  for (const { name } of request.cookies.getAll()) {
    if (!isSupabaseAuthCookie(name)) continue;
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
    });
  }
  return response;
}
