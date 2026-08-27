import { Skeleton } from "@/components/ui/skeleton";

export default function SuperadminDashboardLoading() {
  return (
    <div className="min-h-full space-y-8 p-5 text-foreground md:p-8" aria-busy="true" aria-label="Memuat superadmin dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 bg-muted" />
        <Skeleton className="h-3 w-80 bg-muted" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-4 border border-border bg-card p-5">
            <Skeleton className="h-3 w-24 bg-muted" />
            <Skeleton className="h-9 w-32 bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 w-full bg-muted" />
        <Skeleton className="h-80 w-full bg-muted" />
      </div>
    </div>
  );
}
