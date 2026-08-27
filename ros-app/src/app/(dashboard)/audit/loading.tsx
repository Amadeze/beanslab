import { PageHeaderSkeleton } from "@/components/layout/PageHeader";

export default function AuditLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Memuat aktivitas dan audit">
      <PageHeaderSkeleton />
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="flex gap-6 border-b border-[var(--glass-border)] pb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 w-28 animate-pulse rounded bg-[var(--glass-bg)]" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-[1.25rem] bg-[var(--glass-bg)]" />
        </div>
      </div>
    </div>
  );
}
