import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background" aria-busy="true" aria-label="Memuat ruang kendali roastery">
      <div className="shrink-0 border-b border-white/10 bg-[#05090D] text-white">
        <div className="mx-auto flex min-h-11 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-2.5 w-44 bg-white/10" />
          <Skeleton className="hidden h-2.5 w-64 bg-white/10 sm:block" />
        </div>
        <div className="border-t border-white/[0.06] bg-[#0B141B]/60 px-4 py-2 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-64 bg-white/10" />
        </div>
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-5 border-t border-white/[0.06]">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex min-w-0 flex-col items-start gap-1.5 border-r border-white/10 px-2 py-3 last:border-r-0 sm:flex-row sm:items-center sm:gap-2 sm:px-4 sm:py-4">
              <Skeleton className="h-6 w-6 shrink-0 bg-white/10 sm:h-7 sm:w-7" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-2 w-10 bg-white/10" />
                <Skeleton className="h-2.5 w-14 max-w-full bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6 lg:p-7">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
            <section className="overflow-hidden rounded-[14px] border border-border bg-card">
              <div className="flex min-h-16 items-center justify-between border-b border-stone-200 px-5">
                <div className="space-y-2"><Skeleton className="h-2 w-24" /><Skeleton className="h-4 w-44" /></div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex min-h-[66px] items-center gap-3 border-b border-stone-100 px-5 last:border-0">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-2.5 w-2/3" /><Skeleton className="h-2 w-1/2" /></div>
                </div>
              ))}
            </section>
            <section className="min-h-[300px] rounded-[14px] border border-white/10 bg-[#0B141B] p-5">
              <Skeleton className="h-2 w-24 bg-white/10" />
              <Skeleton className="mt-4 h-8 w-3/4 bg-white/10" />
              <Skeleton className="mt-6 h-1.5 w-full bg-white/10" />
              <div className="mt-8 grid grid-cols-2 gap-6"><Skeleton className="h-16 bg-white/10" /><Skeleton className="h-16 bg-white/10" /></div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
            <Skeleton className="h-64 rounded-[14px]" />
            <Skeleton className="h-64 rounded-[14px]" />
          </div>
        </div>
      </main>
    </div>
  );
}
