"use client";

import { formatDate, formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ExpenseRow } from "../actions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  GAJI:        "Gaji & Tunjangan",
  UTILITAS:    "Utilitas",
  OPERASIONAL: "Operasional",
  LAINNYA:     "Lain-lain",
};

const CATEGORY_COLOR: Record<string, string> = {
  GAJI:        "bg-blue-50 text-blue-800 border-blue-200",
  UTILITAS:    "bg-amber-50 text-amber-700 border-amber-200",
  OPERASIONAL: "bg-violet-50 text-violet-700 border-violet-200",
  LAINNYA:     "bg-zinc-100 text-zinc-600 border-zinc-200",
};

interface ExpenseTableProps {
  rows: ExpenseRow[];
  onVoid: (row: ExpenseRow) => void;
}

export function ExpenseTable({ rows, onVoid }: ExpenseTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-zinc-400">Belum ada pengeluaran tercatat.</p>
        <p className="text-xs text-zinc-300">Klik "Catat Pengeluaran" untuk mencatat OPEX.</p>
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/30 backdrop-blur-xl px-4 py-2.5 shadow-sm">
        <p className="text-xs text-zinc-500">{rows.length} pengeluaran tercatat</p>
        <p className="font-mono text-sm font-bold text-red-600">
          Total: {formatRupiah(total)}
        </p>
      </div>

      <div className="hidden md:block overflow-hidden rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl shadow-lg shadow-slate-200/30">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/40 border-b border-white/50 backdrop-blur-md hover:bg-white/40">
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Tanggal</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Kategori</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Keterangan</TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">Nominal</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-white/40 transition-colors">
                <TableCell  className="text-sm text-zinc-600">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium ${CATEGORY_COLOR[row.category] ?? "bg-zinc-100 text-zinc-500"}`}
                  >
                    {CATEGORY_LABEL[row.category] ?? row.category}
                  </Badge>
                </TableCell>
                <TableCell  className="text-sm text-zinc-500">
                  {row.description ?? <span className="italic text-zinc-300">—</span>}
                </TableCell>
                <TableCell  className="text-right font-mono text-sm font-semibold text-red-600">
                  {formatRupiah(row.amount)}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Void pengeluaran"
                    aria-label={`Void pengeluaran ${row.id}`}
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
                className={`text-xs font-bold ${CATEGORY_COLOR[row.category] ?? "bg-zinc-100 text-zinc-500"}`}
              >
                {CATEGORY_LABEL[row.category] ?? row.category}
              </Badge>
              <span className="text-xs font-semibold text-slate-500">{formatDate(row.date)}</span>
            </div>
            <div className="text-sm font-medium text-slate-800 mb-1">
              {row.description ?? <span className="italic text-zinc-400">Tanpa keterangan</span>}
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-bold text-red-600">{formatRupiah(row.amount)}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 w-full gap-2 border-red-200 text-red-600"
              onClick={() => onVoid(row)}
            >
              <Trash2 size={14} />
              Void Pengeluaran
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}


