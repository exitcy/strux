import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  clearSupabaseAuthCookies,
  isInvalidUtf8AuthError,
  sanitizeRequestCookies,
} from '@/lib/supabase-auth-cookies';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return sanitizeRequestCookies(request.cookies.getAll());
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user = null;
  try {
    // Refreshes the session if expired — important for keeping users logged in.
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    // Malformed/chunked sb-*-auth-token cookies throw inside @supabase/ssr.
    if (isInvalidUtf8AuthError(error)) {
      response = clearSupabaseAuthCookies(request, response);
      user = null;
    } else {
      throw error;
    }
  }

  const { pathname } = request.nextUrl;

  // OAuth callback: refresh session cookies only; never redirect away.
  if (pathname.startsWith('/auth/callback')) {
    return response;
  }

  // Not logged in and trying to access protected routes → redirect to login
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/doc'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Logged in and on login page → redirect to dashboard
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Logged in and on root → redirect to dashboard
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

// Only run middleware on these routes (skip static assets, API routes, etc.)
export const config = {
  matcher: ['/', '/login', '/dashboard', '/doc/:path*', '/auth/callback'],
};
