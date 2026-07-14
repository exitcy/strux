'use client';

import { Suspense, use } from 'react';
import DocumentEditor from '@/components/editor/DocumentEditor';

export default function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          Loading document…
        </div>
      }
    >
      <DocumentEditor documentId={id} />
    </Suspense>
  );
}
