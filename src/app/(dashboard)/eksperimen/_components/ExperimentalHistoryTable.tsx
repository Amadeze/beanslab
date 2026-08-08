"use client";

import { PackageSearch } from "lucide-react";
import { ExperimentalProductionRow } from "../actions";
import { formatKg, formatRupiah, formatDate } from "@/lib/format";

export function ExperimentalHistoryTable({ batches, onPromote }: { batches: ExperimentalProductionRow[]; onPromote?: (batch: ExperimentalProductionRow) => void }) {
  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-zinc-500">Belum ada batch eksperimental</p>
        <p className="text-xs text-zinc-400 mt-1">Klik tombol di atas untuk membuat batch baru.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/60 text-xs uppercase tracking-wider text-slate-500">
            <th className="pb-2 pr-4 font-semibold">Kode</th>
            <th className="pb-2 pr-4 font-semibold">Nama</th>
            <th className="pb-2 pr-4 font-semibold">Output</th>
            <th className="pb-2 pr-4 font-semibold text-right">Masuk</th>
            <th className="pb-2 pr-4 font-semibold text-right">Hasil</th>
            <th className="pb-2 pr-4 font-semibold text-right">HPP/kg</th>
            <th className="pb-2 pr-4 font-semibold">Status</th>
            <th className="pb-2 font-semibold">Tanggal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/40">
          {batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-white/30 transition-colors">
              <td className="py-2.5 pr-4 font-mono font-semibold">{batch.code}</td>
              <td className="py-2.5 pr-4">{batch.name}</td>
              <td className="py-2.5 pr-4">{batch.outputProductName}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatKg(batch.inputKg)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatKg(batch.outputKg)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatRupiah(batch.hppPerUnit)}</td>
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
                {batch.status === "COMPLETED" && onPromote && (
                  <button
                    type="button"
                    onClick={() => onPromote(batch)}
                    className="ml-2 inline-flex items-center gap-1 rounded-lg border border-white/60 bg-white/30 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white/50 transition-colors shadow-sm"
                    title="Jadikan Produk Katalog"
                  >
                    <PackageSearch size={12} />
                    Katalog
                  </button>
                )}
              </td>
              <td className="py-2.5 text-xs text-slate-500">{formatDate(batch.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
