'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, GitBranch, Rocket, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const goToApp = () => {
    setLoading(true);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-xs font-bold">S</span>
          </div>
          <span className="text-sm font-semibold">Strux</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-7 items-center rounded-lg px-2.5 text-sm font-medium hover:bg-muted"
          >
            Sign in
          </Link>
          <Button size="sm" onClick={goToApp} disabled={loading}>
            Open app
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Design specs for software engineers
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Write the spec. Review like Git. Ship to Cursor.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Strux is a collaborative design-doc editor with branches, review comments, and one-click export to Cursor and Claude for implementation.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="gap-2" onClick={goToApp} disabled={loading}>
            Get started
            <ArrowRight className="size-4" />
          </Button>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Sign in
          </Link>
        </div>
      </main>

      <section className="border-t bg-muted/30 px-6 py-16">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-background border">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-semibold">Collaborative specs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time editing, anchored comments, and AI-assisted rewrites on design docs.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-background border">
              <GitBranch className="size-5 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-semibold">Branch and merge</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Spin off review branches, diff against main, and merge when the spec is ready.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-background border">
              <Rocket className="size-5 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-semibold">Ship to IDE</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export Cursor rules, AGENTS.md, or Claude instructions with open questions included.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
