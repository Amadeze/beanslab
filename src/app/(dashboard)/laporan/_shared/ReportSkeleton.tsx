import { cn } from "@/lib/utils";

interface ReportSkeletonProps {
  className?: string;
}

export function ReportSkeleton({ className }: ReportSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="h-2 w-16 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-6 w-24 animate-pulse rounded bg-stone-200" />
            <div className="mt-2 h-2 w-20 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="h-2 w-24 animate-pulse rounded bg-stone-200" />
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-stone-100" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-3">
          <div className="h-2 w-32 animate-pulse rounded bg-stone-200" />
        </div>
        <div className="divide-y divide-stone-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-3 flex-1 animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-16 animate-pulse rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
