"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatRupiah } from "@/lib/format";
import type { PaymentRow } from "../actions";

export function PaymentTable({
  rows,
  onVoid,
}: {
  rows: PaymentRow[];
  onVoid: (row: PaymentRow) => void;
}) {
  if (rows.length === 0) {
    return <div data-testid="payment-history" className="py-16 text-center text-sm text-slate-400">Belum ada pembayaran tercatat.</div>;
  }

  return (
    <div data-testid="payment-history">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-white/60 bg-white/40">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 border-b border-white/60 px-4 py-3 text-xs font-bold uppercase text-slate-500">
          <span>Pembayaran</span>
          <span>Invoice / Customer</span>
          <span className="text-right">Nominal</span>
          <span className="w-8" />
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 border-b border-white/40 px-4 py-3 text-sm last:border-0">
            <div>
              <div className="font-semibold text-slate-800">{row.code}</div>
              <div className="text-xs text-slate-500">{formatDate(row.paidAt)} · {row.method}</div>
            </div>
            <div>
              <div className="font-medium text-slate-700">{row.invoiceCode}</div>
              <div className="text-xs text-slate-500">{row.customerName}</div>
            </div>
            <div className="text-right font-mono font-bold text-emerald-700">{formatRupiah(row.amount)}</div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Void ${row.code}`}
              title="Void pembayaran"
              className="text-slate-400 hover:bg-red-50 hover:text-red-600"
              onClick={() => onVoid(row)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      {/* Mobile card view */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/60 bg-white/40 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-800">{row.code}</div>
                <div className="text-xs text-slate-500">{formatDate(row.paidAt)} · {row.method}</div>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Void ${row.code}`}
                title="Void pembayaran"
                className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => onVoid(row)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-700">{row.invoiceCode}</div>
                <div className="text-xs text-slate-500">{row.customerName}</div>
              </div>
              <div className="font-mono text-sm font-bold text-emerald-700">{formatRupiah(row.amount)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
