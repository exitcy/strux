'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { type AuthChangeEvent, type Session, type User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

// This hook is how any component in the app accesses auth state.
// Instead of passing user/session as props through every layer,
// any component can just call useAuth(). This is the Provider Pattern —
// the most important React pattern you'll use in production codebases.
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create the client inside the effect so it's not a dependency
    const supabase = createSupabaseBrowserClient();

    // Get initial session on mount
    void supabase.auth.getSession().then(
      ({ data }: { data: { session: Session | null } }) => {
        const session = data.session;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      },
      () => {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    );

    // Subscribe to auth changes (login, logout, token refresh).
    // Observer Pattern — Supabase pushes changes to us instead of us polling.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
