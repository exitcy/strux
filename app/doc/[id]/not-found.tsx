import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DocNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-xl font-semibold">Document not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This document may have been deleted or you don&apos;t have permission to view it.
      </p>
      <Button className="mt-6" render={<Link href="/dashboard" />}>
        Back to dashboard
      </Button>
    </div>
  );
}
