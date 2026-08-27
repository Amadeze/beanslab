"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { LineageChain, LineageChip } from "@/lib/lineage";
import { fetchBatchLineageAction } from "../lineage-actions";

function Chip({ chip }: { chip: LineageChip }) {
  return (
    <Link
      href={chip.href}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-colors",
        chip.muted
          ? "border-dashed border-border opacity-60 hover:border-primary/40"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span className="min-w-0">
        <span className={cn("block truncate font-bold text-foreground", chip.muted && "line-through decoration-1")}>
          {chip.label}
        </span>
        {chip.sub ? <span className="block truncate text-[10px] text-ink-secondary">{chip.sub}</span> : null}
      </span>
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-tertiary">
        {title}
      </p>
      {children}
    </div>
  );
}

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

/** Konten panel konteks: rantai jejak satu batch roasting. */
export function BatchPanelContent({ batchId }: { batchId: string }) {
  const [chain, setChain] = useState<LineageChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchBatchLineageAction(batchId)
      .then((result) => {
        if (!alive) return;
        setChain(result ?? { hulu: [], sesi: [], hilir: [] });
      })
      .catch(() => {
        if (alive) setError("Gagal memuat rantai jejak.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-ink-secondary" role="status">
        <Loader2 size={14} className="animate-spin text-copper" /> Memuat rantai jejak…
      </div>
    );
  }

  if (error) {
    return <p className="py-4 text-xs text-[var(--status-danger)]">{error}</p>;
  }

  if (!chain || (chain.hulu.length === 0 && chain.sesi.length === 0 && chain.hilir.length === 0)) {
    return (
      <p className="py-3 text-xs leading-5 text-ink-secondary">
        Belum ada lot yang dicatat masuk ke batch ini.
      </p>
    );
  }

  return (
    <div data-testid="batch-lineage" className="space-y-3.5">
      <Group title="Berasal dari">
        {chain.hulu.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chain.hulu.map((c) => (
              <Chip key={c.href + c.label} chip={c} />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-ink-tertiary">Belum ada lot tercatat.</p>
        )}
      </Group>

      <Group title="Pemeriksaan rasa">
        {chain.sesi.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chain.sesi.map((c, i) => (
              <Chip key={c.href + i} chip={c} />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-ink-tertiary">Belum ada cupping untuk batch ini.</p>
        )}
      </Group>

      <Group title="Lanjut ke">
        {chain.hilir.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chain.hilir.map((c) => (
              <Chip key={c.href + c.label} chip={c} />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-ink-tertiary">Belum ada produksi/grinding dari batch ini.</p>
        )}
      </Group>
    </div>
  );
}
