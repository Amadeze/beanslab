"use client";

import { formatDate, formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { PurchaseRow } from "../actions";
import { Button } from "@/components/ui/button";
import { Trash2, WalletCards } from "lucide-react";
import { getPayableAgingBucket } from "@/lib/purchase-payments";

const CATEGORY_LABEL: Record<string, string> = {
  GREEN_BEAN: "Bahan Baku (Kopi)",
  PACKAGING: "Kemasan",
};

const CATEGORY_COLOR: Record<string, string> = {
  GREEN_BEAN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PACKAGING: "bg-amber-50 text-amber-700 border-amber-200",
};

interface PurchaseTableProps {
  rows: PurchaseRow[];
  onVoid: (row: PurchaseRow) => void;
  onPay: (row: PurchaseRow) => void;
}

export function PurchaseTable({ rows, onVoid, onPay }: PurchaseTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-zinc-400">Belum ada riwayat pembelian tercatat.</p>
        <p className="text-xs text-zinc-300">Pembelian aset/bahan dari menu Inventory akan muncul di sini.</p>
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.totalCost, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidAmount, 0);
  const outstanding = rows.reduce((s, r) => s + r.balance, 0);
  const aging = rows.reduce(
    (totals, row) => {
      if (row.balance <= 0) return totals;
      const bucket = getPayableAgingBucket(row.dueDate ? new Date(row.dueDate) : null);
      totals[bucket] += row.balance;
      return totals;
    },
    {
      CURRENT: 0,
      OVERDUE_1_30: 0,
      OVERDUE_31_60: 0,
      OVERDUE_61_PLUS: 0,
    },
  );

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/30 backdrop-blur-xl px-4 py-2.5 shadow-sm">
        <p className="text-xs text-zinc-500">{rows.length} pembelian tercatat</p>
        <div className="flex gap-4 font-mono text-xs font-bold">
          <span className="text-slate-600">Nilai: {formatRupiah(total)}</span>
          <span className="text-red-600">Dibayar: {formatRupiah(totalPaid)}</span>
          <span className="text-amber-700">Hutang: {formatRupiah(outstanding)}</span>
        </div>
      </div>
      {outstanding > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="px-3 py-2 text-slate-600">Belum tempo <strong className="block font-mono">{formatRupiah(aging.CURRENT)}</strong></div>
          <div className="px-3 py-2 text-amber-700">1-30 hari <strong className="block font-mono">{formatRupiah(aging.OVERDUE_1_30)}</strong></div>
          <div className="px-3 py-2 text-orange-700">31-60 hari <strong className="block font-mono">{formatRupiah(aging.OVERDUE_31_60)}</strong></div>
          <div className="px-3 py-2 text-red-700">&gt;60 hari <strong className="block font-mono">{formatRupiah(aging.OVERDUE_61_PLUS)}</strong></div>
        </div>
      )}

      <div className="hidden md:block overflow-hidden rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl shadow-lg shadow-slate-200/30">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/40 border-b border-white/50 backdrop-blur-md hover:bg-white/40">
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Tanggal / Kode</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Kategori</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Item & Qty</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Supplier</TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">Pembayaran</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-white/40 transition-colors">
                <TableCell className="text-sm text-zinc-600">
                  <div>{formatDate(row.receivedAt)}</div>
                  <div className="text-xs text-zinc-400">{row.code}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium ${CATEGORY_COLOR[row.type] ?? "bg-zinc-100 text-zinc-500"}`}
                  >
                    {CATEGORY_LABEL[row.type] ?? row.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-700">
                  {row.itemName}
                  <div className="text-xs text-slate-400 font-normal">{row.quantity}</div>
                </TableCell>
                <TableCell className="text-sm text-zinc-500">
                  {row.supplierName}
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-mono text-sm font-semibold text-slate-800">{formatRupiah(row.totalCost)}</div>
                  <div className={`text-xs font-medium ${row.isOverdue ? "text-red-600" : row.balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {row.balance > 0 ? `Sisa ${formatRupiah(row.balance)}` : "Lunas"}
                  </div>
                  {row.dueDate && row.balance > 0 && (
                    <div className="text-xs text-slate-400">Tempo {formatDate(row.dueDate)}</div>
                  )}
                </TableCell>
                <TableCell className="flex gap-1">
                  {row.balance > 0 && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="Bayar supplier"
                      aria-label={`Bayar ${row.code}`}
                      className="text-amber-800 hover:bg-amber-50"
                      onClick={() => onPay(row)}
                    >
                      <WalletCards size={14} />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Void pembelian"
                    aria-label={`Void ${row.code}`}
                    className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => onVoid(row)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className="p-4 rounded-xl border border-white/60 bg-white/30 backdrop-blur-md shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <Badge
                variant="outline"
                className={`text-xs font-bold ${CATEGORY_COLOR[row.type] ?? "bg-zinc-100 text-zinc-500"}`}
              >
                {CATEGORY_LABEL[row.type] ?? row.type}
              </Badge>
              <span className="text-xs font-semibold text-slate-500">{formatDate(row.receivedAt)}</span>
            </div>
            <div className="text-sm font-medium text-slate-800 mb-1">
              {row.itemName} <span className="font-normal text-slate-500">({row.quantity})</span>
            </div>
            <div className="text-xs text-slate-400 mb-2">
              {row.supplierName} • {row.code}
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-bold text-slate-800">{formatRupiah(row.totalCost)}</span>
              <div className={row.isOverdue ? "text-xs text-red-600" : "text-xs text-amber-700"}>
                {row.balance > 0 ? `Sisa ${formatRupiah(row.balance)}` : "Lunas"}
              </div>
            </div>
            {row.balance > 0 && (
              <Button type="button" size="sm" className="mt-3 w-full gap-2" onClick={() => onPay(row)}>
                <WalletCards size={14} />
                Bayar Supplier
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 w-full gap-2 border-red-200 text-red-600"
              onClick={() => onVoid(row)}
            >
              <Trash2 size={14} />
              Void Pembelian
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
