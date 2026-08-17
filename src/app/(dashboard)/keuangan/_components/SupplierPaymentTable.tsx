"use client";

import { Trash2, Ban, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SupplierPaymentRow, VoidHistoryFilter } from "../actions";

export function SupplierPaymentTable({
  rows,
  onVoid,
  view = "ACTIVE",
}: {
  rows: SupplierPaymentRow[];
  onVoid: (row: SupplierPaymentRow) => void;
  view?: VoidHistoryFilter;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        {view === "VOIDED"
          ? "Tidak ada pembayaran supplier yang dibatalkan."
          : "Belum ada pembayaran supplier."}
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-white/60 bg-white/40">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 border-b border-white/60 px-4 py-3 text-xs font-bold uppercase text-slate-500">
          <span>Pembayaran</span>
          <span>Pembelian / Supplier</span>
          <span className="text-right">Nominal</span>
          <span className="w-8" />
        </div>
        {rows.map((row) => (
          <div key={row.id} className={cn("grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 border-b border-white/40 px-4 py-3 text-sm last:border-0", row.voidedAt && "bg-red-50/40")}>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                <span className={cn(row.voidedAt && "line-through opacity-60")}>{row.code}</span>
                {row.voidedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    <Ban size={10} />
                    Dibatalkan
                  </span>
                )}
                {!row.voidedAt && row.isEmbedded && (
                  <span
                    title="Dibayar saat penerimaan barang dan sudah dibukukan dalam jurnal pembelian. Tidak dapat di-void mandiri — koreksi melalui void pembelian terkait."
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                  >
                    <Info size={10} />
                    Pembayaran Awal
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">{formatDate(row.paidAt)} · {row.method}</div>
              {row.voidedAt && (
                <div className="mt-0.5 text-xs text-red-500">
                  {row.voidReason ?? "Tanpa alasan"} · {formatDate(row.voidedAt)}
                  {row.voidedByName ? ` oleh ${row.voidedByName}` : ""}
                </div>
              )}
            </div>
            <div>
              <div className="font-medium text-slate-700">{row.purchaseCode}</div>
              <div className="text-xs text-slate-500">{row.supplierName}</div>
            </div>
            <div className={cn("text-right font-mono font-bold", row.voidedAt ? "text-red-400 line-through" : "text-red-600")}>
              {formatRupiah(row.amount)}
            </div>
            {row.voidedAt || row.isEmbedded ? (
              <span />
            ) : (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title="Void pembayaran supplier"
                aria-label={`Void ${row.code}`}
                className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => onVoid(row)}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Mobile card view */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className={cn("rounded-xl border bg-white/40 p-4 backdrop-blur-md", row.voidedAt ? "border-red-200" : "border-white/60")}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                  <span className={cn(row.voidedAt && "line-through opacity-60")}>{row.code}</span>
                  {row.voidedAt && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                      <Ban size={10} />
                      Dibatalkan
                    </span>
                  )}
                  {!row.voidedAt && row.isEmbedded && (
                    <span
                      title="Dibayar saat penerimaan barang dan sudah dibukukan dalam jurnal pembelian. Tidak dapat di-void mandiri — koreksi melalui void pembelian terkait."
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                    >
                      <Info size={10} />
                      Pembayaran Awal
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">{formatDate(row.paidAt)} · {row.method}</div>
              </div>
              {!row.voidedAt && !row.isEmbedded && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  title="Void pembayaran supplier"
                  aria-label={`Void ${row.code}`}
                  className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => onVoid(row)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            {row.voidedAt && (
              <div className="mt-1 text-xs text-red-500">
                {row.voidReason ?? "Tanpa alasan"} · {formatDate(row.voidedAt)}
                {row.voidedByName ? ` oleh ${row.voidedByName}` : ""}
              </div>
            )}
            {!row.voidedAt && row.isEmbedded && (
              <p className="mt-1 text-xs leading-relaxed text-amber-700">
                Pembayaran awal saat penerimaan barang — sudah dibukukan oleh jurnal
                pembelian. Koreksi melalui void pembelian terkait.
              </p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-700">{row.purchaseCode}</div>
                <div className="text-xs text-slate-500">{row.supplierName}</div>
              </div>
              <div className={cn("font-mono text-sm font-bold", row.voidedAt ? "text-red-400 line-through" : "text-red-600")}>
                {formatRupiah(row.amount)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}