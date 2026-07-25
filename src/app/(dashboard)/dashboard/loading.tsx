import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/layout/PageHeader";

export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeaderSkeleton />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>

        {/* Activity table skeleton */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-3.5">
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-zinc-50 px-5 py-3">
              <Skeleton className="h-6 w-6 rounded-md shrink-0" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
