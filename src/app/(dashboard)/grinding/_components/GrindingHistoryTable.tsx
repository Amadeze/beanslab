"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VoidConfirmDialog } from "@/components/VoidConfirmDialog";
import { voidGrindingBatch, type GrindingBatchRow } from "../actions";
import { formatKg, formatRupiah, formatDate } from "@/lib/format";
import { GRIND_SIZE_LABELS } from "@/lib/grind-size";

const GRIND_SIZE_LABELS_MAP: Record<string, string> = {
  WHOLE_BEAN: "Whole Bean",
  COARSE: "Coarse",
  MEDIUM_COARSE: "Medium Coarse",
  MEDIUM: "Medium",
  MEDIUM_FINE: "Medium Fine",
  FINE: "Fine",
  ESPRESSO: "Espresso",
  CUSTOM: "Custom",
};

export function GrindingHistoryTable({ batches }: { batches: GrindingBatchRow[] }) {
  const [voidTarget, setVoidTarget] = useState<GrindingBatchRow | null>(null);

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-zinc-500">Belum ada batch grinding</p>
        <p className="text-xs text-zinc-400 mt-1">Klik tombol di atas untuk membuat batch baru.</p>
      </div>
    );
  }

  return (
    <>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/60 text-xs uppercase tracking-wider text-slate-500">
            <th className="pb-2 pr-4 font-semibold">Kode</th>
            <th className="pb-2 pr-4 font-semibold">Sumber RB</th>
            <th className="pb-2 pr-4 font-semibold">Output</th>
            <th className="pb-2 pr-4 font-semibold">Ukuran Giling</th>
            <th className="pb-2 pr-4 font-semibold text-right">Masuk</th>
            <th className="pb-2 pr-4 font-semibold text-right">Hasil</th>
            <th className="pb-2 pr-4 font-semibold text-right">Susut</th>
            <th className="pb-2 pr-4 font-semibold">Status</th>
            <th className="pb-2 font-semibold">Tanggal</th>
            <th className="pb-2 pl-4 text-center font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/40">
          {batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-white/30 transition-colors">
              <td className="py-2.5 pr-4 font-mono font-semibold">{batch.code}</td>
              <td className="py-2.5 pr-4">
                <span className="block">{batch.sourceProductName}</span>
                {batch.parentRoastBatchId && batch.parentRoastBatchCode && (
                  <Link
                    href={`/roasting/batch/${batch.parentRoastBatchId}`}
                    className="mt-0.5 inline-flex text-xs font-semibold text-amber-800 hover:underline"
                  >
                    Roast {batch.parentRoastBatchCode}
                  </Link>
                )}
              </td>
              <td className="py-2.5 pr-4">{batch.outputProductName}</td>
              <td className="py-2.5 pr-4">
                {GRIND_SIZE_LABELS_MAP[batch.grindSize] ?? batch.grindSize}
                {batch.customGrindLabel && <span className="ml-1 text-slate-400">({batch.customGrindLabel})</span>}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatKg(batch.inputKg)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatKg(batch.outputKg)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-amber-700">
                {formatKg(batch.lossKg)}
              </td>
              <td className="py-2.5 pr-4">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  batch.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : batch.status === "VOID"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {batch.status}
                </span>
              </td>
              <td className="py-2.5 text-xs text-slate-500">{formatDate(batch.createdAt)}</td>
              <td className="py-2.5 pl-4 text-center">
                {batch.status === "COMPLETED" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-9 min-w-11 px-2.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
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
      description="Tindakan ini membalik konsumsi Roasted Bean dan hasil kopi giling. Batch tidak dapat di-void jika hasilnya sudah dipakai proses berikutnya."
      onConfirm={(reason) => voidGrindingBatch(voidTarget!.id, reason)}
    />
    </>
  );
}
