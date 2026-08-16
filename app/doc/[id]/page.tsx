'use client';

import { Suspense, use } from 'react';
import dynamic from 'next/dynamic';
import DocLoading from './loading';

const DocumentEditor = dynamic(() => import('@/components/editor/DocumentEditor'), {
  ssr: false,
  loading: () => <DocLoading />,
});

export default function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <Suspense fallback={<DocLoading />}>
      <DocumentEditor documentId={id} />
    </Suspense>
  );
}
