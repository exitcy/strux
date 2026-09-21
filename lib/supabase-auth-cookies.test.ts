import { describe, expect, it } from 'vitest';
import {
  isInvalidUtf8AuthError,
  isSupabaseAuthCookie,
  sanitizeRequestCookies,
} from '@/lib/supabase-auth-cookies';

describe('supabase-auth-cookies', () => {
  it('detects auth cookie names', () => {
    expect(isSupabaseAuthCookie('sb-abc123-auth-token')).toBe(true);
    expect(isSupabaseAuthCookie('sb-abc123-auth-token.0')).toBe(true);
    expect(isSupabaseAuthCookie('sb-abc123-auth-token-code-verifier')).toBe(true);
    expect(isSupabaseAuthCookie('other')).toBe(false);
  });

  it('drops undecodable base64 auth chunks', () => {
    const cleaned = sanitizeRequestCookies([
      { name: 'theme', value: 'dark' },
      { name: 'sb-proj-auth-token.0', value: 'base64-not@base64!!!' },
      { name: 'sb-proj-auth-token.1', value: 'also-bad' },
    ]);
    expect(cleaned).toEqual([{ name: 'theme', value: 'dark' }]);
  });

  it('keeps valid json session cookies', () => {
    const value = JSON.stringify({ access_token: 'x', refresh_token: 'y' });
    const cleaned = sanitizeRequestCookies([{ name: 'sb-proj-auth-token', value }]);
    expect(cleaned).toHaveLength(1);
  });

  it('recognizes utf-8 decode errors', () => {
    expect(isInvalidUtf8AuthError(new Error('Invalid UTF-8 sequence'))).toBe(true);
    expect(isInvalidUtf8AuthError(new Error('other'))).toBe(false);
  });
});
