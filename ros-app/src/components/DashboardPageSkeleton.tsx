import { Skeleton } from "@/components/ui/skeleton";

interface DashboardPageSkeletonProps {
  metrics?: number;
  rows?: number;
  showSidebar?: boolean;
}

export function DashboardPageSkeleton({
  metrics = 4,
  rows = 7,
  showSidebar = false,
}: DashboardPageSkeletonProps) {
  return (
    <div className="min-h-full space-y-6 p-6" aria-busy="true" aria-label="Memuat halaman">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className={`grid gap-6 ${showSidebar ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: metrics }).map((_, index) => (
              <div key={index} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-44" />
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {showSidebar && (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
