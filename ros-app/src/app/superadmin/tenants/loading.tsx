import { Skeleton } from "@/components/ui/skeleton";

export default function SuperadminTenantsLoading() {
  return (
    <div className="min-h-full space-y-6 p-5 md:p-8" aria-busy="true" aria-label="Memuat tenant">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 bg-muted" />
        <Skeleton className="h-9 w-32 bg-muted" />
      </div>
      <div className="overflow-hidden border border-border bg-card">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border p-4">
            <Skeleton className="h-9 w-9 bg-muted" />
            <Skeleton className="h-3 w-36 bg-muted" />
            <Skeleton className="h-3 flex-1 bg-muted" />
            <Skeleton className="h-6 w-20 bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
