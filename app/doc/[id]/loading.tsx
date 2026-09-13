import { Skeleton } from '@/components/ui/skeleton';

export default function DocLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex h-14 items-center gap-4 border-b px-6">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-1 justify-center px-8 pt-24">
        <Skeleton className="h-[800px] w-full max-w-[800px] rounded-sm" />
      </div>
    </div>
  );
}
