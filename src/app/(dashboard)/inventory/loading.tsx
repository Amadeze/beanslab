import { PageHeaderSkeleton } from "@/components/layout/PageHeader";

export default function InventoryLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Memuat inventory">
      <PageHeaderSkeleton stage />
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-4 space-y-3">
                <div className="h-2.5 w-20 animate-pulse rounded bg-[var(--glass-bg)]" />
                <div className="h-6 w-28 animate-pulse rounded bg-[var(--glass-bg)]" />
              </div>
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-[1.25rem] bg-[var(--glass-bg)]" />
        </div>
      </div>
    </div>
  );
}
