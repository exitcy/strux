'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signInWithOAuth, signUp } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { StruxMark } from '@/components/brand/StruxMark';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12Z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.3 4.4 15l-2.1 1.6C3.8 19.5 7.6 22 12 22c2.7 0 5-.9 6.6-2.4l-3.1-2.4c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3Z"
      />
      <path
        fill="#4A90E2"
        d="M3.3 7.4C2.5 9 2 10.9 2 12.9c0 2 .5 3.9 1.3 5.5l3-2.3c-.4-1.1-.6-2.2-.6-3.2 0-1.1.2-2.1.6-3.1L3.3 7.4Z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 1.7 14.7 1 12 1 7.6 1 3.8 3.5 2.3 7.4l3 2.3C6 7.2 8.3 4.6 12 4.6Z"
      />
    </svg>
  );
}

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('error') === 'auth') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const busy = loading || oauthLoading !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    setError('');
    setOauthLoading(provider);
    try {
      const { url } = await signInWithOAuth(provider);
      if (url) {
        window.location.assign(url);
        return;
      }
      setError('Could not start OAuth sign-in.');
      setOauthLoading(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setOauthLoading(null);
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError('');
  };

  return (
    <div className="mx-auto w-full max-w-[400px]">
      <div className="rounded-md border border-[#2e2e2e] bg-[#121212] px-8 py-10 shadow-none">
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-2 text-white">
            <StruxMark className="size-5 text-emerald-500" title="" />
            <span className="text-lg font-medium tracking-tight lowercase">strux</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1.5 text-sm text-[#8c8c8c]">
            {mode === 'signin' ? 'Sign in to your account' : 'Get started with Strux'}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleOAuth('github')}
            className="relative flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[#2e2e2e] bg-[#121212] text-sm font-medium text-white transition-colors hover:bg-[#1c1c1c] disabled:pointer-events-none disabled:opacity-50"
          >
            {oauthLoading === 'github' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitHubIcon className="size-4" />
            )}
            Continue with GitHub
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => handleOAuth('google')}
            className="relative flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[#2e2e2e] bg-[#121212] text-sm font-medium text-white transition-colors hover:bg-[#1c1c1c] disabled:pointer-events-none disabled:opacity-50"
          >
            {oauthLoading === 'google' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GoogleIcon className="size-4" />
            )}
            Continue with Google
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#2e2e2e]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#121212] px-3 text-[#8c8c8c]">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
              autoComplete="email"
              placeholder="you@example.com"
              className="h-10 w-full rounded-md border border-[#2e2e2e] bg-[#121212] px-3 text-sm text-white outline-none placeholder:text-[#5c5c5c] focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:opacity-50"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-white">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="text-sm text-[#8c8c8c] transition-colors hover:text-white"
                  tabIndex={-1}
                  onClick={(e) => e.preventDefault()}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={busy}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="At least 6 characters"
                className="h-10 w-full rounded-md border border-[#2e2e2e] bg-[#121212] px-3 pr-10 text-sm text-white outline-none placeholder:text-[#5c5c5c] focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
                disabled={busy}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#8c8c8c] hover:text-white disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : mode === 'signin' ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#8c8c8c]">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            disabled={busy}
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="font-medium text-white underline underline-offset-2 hover:text-emerald-400 disabled:opacity-50"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>

      <p className="mt-6 px-2 text-center text-xs leading-relaxed text-[#5c5c5c]">
        By continuing, you agree to Strux&apos;s{' '}
        <a href="#" className="underline underline-offset-2 hover:text-[#8c8c8c]">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline underline-offset-2 hover:text-[#8c8c8c]">
          Privacy Policy
        </a>
        , and to receive periodic emails with updates.
      </p>
    </div>
  );
}
