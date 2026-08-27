"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoidConfirmDialog } from "@/components/VoidConfirmDialog";
import { voidExperimentalProduction, type ExperimentalProductionRow } from "../actions";
import { formatKg, formatRupiah, formatDate } from "@/lib/format";

export function ExperimentalHistoryTable({ batches, onPromote }: { batches: ExperimentalProductionRow[]; onPromote?: (batch: ExperimentalProductionRow) => void }) {
  const [voidTarget, setVoidTarget] = useState<ExperimentalProductionRow | null>(null);

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-ink-secondary">Belum ada batch eksperimental</p>
        <p className="text-xs text-ink-secondary mt-1">Klik tombol di atas untuk membuat batch baru.</p>
      </div>
    );
  }

  return (
    <>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/60 text-xs uppercase tracking-wider text-ink-secondary">
            <th className="pb-2 pr-4 font-semibold">Kode</th>
            <th className="pb-2 pr-4 font-semibold">Nama</th>
            <th className="pb-2 pr-4 font-semibold">Output</th>
            <th className="pb-2 pr-4 font-semibold text-right">Masuk</th>
            <th className="pb-2 pr-4 font-semibold text-right">Hasil</th>
            <th className="pb-2 pr-4 font-semibold text-right">HPP/kg</th>
            <th className="pb-2 pr-4 font-semibold">Status</th>
            <th className="pb-2 font-semibold">Tanggal</th>
            <th className="pb-2 pl-4 text-center font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/40">
          {batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-card/30 transition-colors">
              <td className="py-2.5 pr-4 font-mono font-semibold">{batch.code}</td>
              <td className="py-2.5 pr-4">
                <span className="block">{batch.name}</span>
                {batch.parentRoastBatchId && batch.parentRoastBatchCode && (
                  <Link
                    href={`/roasting/batch/${batch.parentRoastBatchId}`}
                    className="mt-0.5 inline-flex text-xs font-semibold text-[var(--status-warning)] hover:underline"
                  >
                    Roast {batch.parentRoastBatchCode}
                  </Link>
                )}
              </td>
              <td className="py-2.5 pr-4">{batch.outputProductName}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatKg(batch.inputKg)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatKg(batch.outputKg)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatRupiah(batch.hppPerUnit)}</td>
              <td className="py-2.5 pr-4">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  batch.status === "COMPLETED"
                    ? "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/30"
                    : batch.status === "VOID"
                    ? "bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/30"
                    : "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border border-[var(--status-warning)]/30"
                }`}>
                  {batch.status}
                </span>
                {batch.status === "COMPLETED" && onPromote && (
                  <button
                    type="button"
                    onClick={() => onPromote(batch)}
                    className="ml-2 inline-flex items-center gap-1 rounded-lg border border-white/60 bg-card/30 px-2 py-1 text-xs font-medium text-ink hover:bg-card/50 transition-colors shadow-sm"
                    title="Jadikan Produk Katalog"
                  >
                    <PackageSearch size={12} />
                    Katalog
                  </button>
                )}
              </td>
              <td className="py-2.5 text-xs text-ink-secondary">{formatDate(batch.createdAt)}</td>
              <td className="py-2.5 pl-4 text-center">
                {batch.status === "COMPLETED" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-9 min-w-11 px-2.5 text-xs text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]"
                    onClick={() => setVoidTarget(batch)}
                  >
                    Void
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <VoidConfirmDialog
      open={!!voidTarget}
      onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
      title={`Void Batch ${voidTarget?.code ?? ""}`}
      description="Tindakan ini membalik konsumsi komponen dan hasil eksperimen. Batch tidak dapat di-void jika hasilnya sudah dipakai proses berikutnya."
      onConfirm={(reason) => voidExperimentalProduction(voidTarget!.id, reason)}
    />
    </>
  );
}
