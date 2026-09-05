"use client";

import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import type { HppKpi } from "../hpp-actions";

interface HppKpiTileProps {
  data: HppKpi;
}

const IDR = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

export function HppKpiTile({ data }: HppKpiTileProps) {
  const driftTone = data.driftCount === 0 ? "ready" : "critical";
  const driftColor = driftTone === "ready" ? "text-emerald-700" : "text-amber-700";

  return (
    <Card padding="md" variant="default" className="flex flex-col">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
            HPP weighted-average
          </p>
          <h3 className="mt-1 font-heading text-base font-bold tracking-[-0.02em] text-ink">
            HPP barang jadi
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-2.5 py-1 text-[11px] font-bold ${driftColor}`}
          aria-label={driftTone === "ready" ? "HPP in sync" : `${data.driftCount} produk drift`}
        >
          {driftTone === "ready" ? (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-3.5" aria-hidden="true" />
          )}
          {driftTone === "ready"
            ? "Sync"
            : `${data.driftCount} drift`}
        </span>
      </header>
      <div className="mt-4">
        <Stat
          label="Rata-rata HPP"
          value={IDR(data.meanHpp)}
          sub="Dihitung dari ledger · diperbarui tiap batch"
        />
      </div>
      {data.items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-secondary">
          Belum ada barang jadi. Selesaikan satu batch produksi untuk mengisi HPP.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.items.slice(0, 5).map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-3 rounded-card border border-border/60 bg-paper-sunken/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {item.productCode} · {item.productName}
                </p>
                <p className="text-xs text-ink-secondary">
                  {item.latestBatchDate
                    ? `Sumber: batch ${item.latestBatchDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}`
                    : "Belum ada batch selesai"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="font-heading text-sm font-bold tabular-nums text-ink">
                  {IDR(item.lastHpp)}
                </span>
                {item.latestBatchId ? (
                  <Link
                    href={`/produksi/${item.latestBatchId}`}
                    className="text-ink-tertiary transition hover:text-copper"
                    aria-label={`Lihat batch sumber untuk ${item.productCode}`}
                  >
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.driftCount > 0 && (
        <p className="mt-3 rounded-card border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Jalankan <code className="font-mono text-[11px]">{data.lastRebuildHint}</code> untuk menyinkronkan HPP dari ledger.
        </p>
      )}
    </Card>
  );
}