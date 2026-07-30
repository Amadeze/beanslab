type GrowthPoint = { name: string; tenants: number };

export function TenantGrowthChart({ data }: { data: GrowthPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Belum ada data pertumbuhan.</div>;
  }

  const max = Math.max(1, ...data.map((point) => point.tenants));

  return (
    <div className="relative flex h-full min-h-64 flex-col" role="img" aria-label="Grafik pertumbuhan tenant enam bulan">
      <div className="pointer-events-none absolute inset-x-0 top-2 bottom-8 flex flex-col justify-between" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className="block border-t border-dashed border-border" />
        ))}
      </div>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-6 items-end gap-3 px-1 md:gap-5">
        {data.map((point, index) => {
          const height = point.tenants > 0 ? Math.max(8, (point.tenants / max) * 100) : 0;
          const latest = index === data.length - 1;
          return (
            <div key={`${point.name}-${index}`} className="flex h-full min-w-0 flex-col justify-end">
              <div className="mb-2 text-center font-mono text-[11px] font-bold tabular-nums text-foreground">{point.tenants}</div>
              <div className="flex h-[calc(100%-3.5rem)] items-end bg-muted/45">
                <div
                  className={`w-full border-t-2 ${latest ? "border-[#B65331] bg-[#B65331]/80" : "border-[#2B7567] bg-[#2B7567]/70"}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className={`mt-3 text-center text-[10px] font-black uppercase tracking-[0.14em] ${latest ? "text-domain-roasting" : "text-muted-foreground"}`}>
                {point.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
