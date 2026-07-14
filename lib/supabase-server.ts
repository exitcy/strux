import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server client — used in middleware & server components.
// Reads auth tokens from cookies so the server knows who
// the user is before any client JS runs.
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Expected in read-only Server Component context.
          }
        },
      },
    }
  );
};
