import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background p-4 md:p-6">
      <Skeleton className="mb-6 h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
