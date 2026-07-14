import { createBrowserClient } from '@supabase/ssr';

// Browser client — used in React components (client-side)
//
// IMPORTANT:
// Realtime presence/broadcast channels become unstable if we create a new
// Supabase client for every call site. Keep one singleton per browser tab.
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export const createSupabaseBrowserClient = () => {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
};
