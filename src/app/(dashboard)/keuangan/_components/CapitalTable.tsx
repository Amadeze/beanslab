"use client";

import { formatRupiah, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, PiggyBank } from "lucide-react";
import type { CapitalTransactionRow } from "../actions";

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ElementType }> = {
  INITIAL: { label: "Modal Awal", variant: "default", icon: PiggyBank },
  INJECTION: { label: "Tambahan Modal", variant: "secondary", icon: Plus },
  WITHDRAWAL: { label: "Prive", variant: "destructive", icon: Minus },
  DIVIDEND: { label: "Bagi Hasil", variant: "outline", icon: Minus },
};

interface CapitalTableProps {
  rows: CapitalTransactionRow[];
}

export function CapitalTable({ rows }: CapitalTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
        <PiggyBank size={40} className="mx-auto mb-3 text-stone-300" />
        <p className="text-sm font-medium text-stone-500">Belum ada mutasi modal</p>
        <p className="text-xs text-stone-400 mt-1">Catat setoran modal awal atau prive pemilik</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-stone-50">
            <TableHead className="text-xs uppercase tracking-widest text-stone-500 font-bold">Tipe</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-stone-500 font-bold">Tanggal</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-stone-500 font-bold">Keterangan</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-widest text-stone-500 font-bold">Nominal</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-widest text-stone-500 font-bold">Dicatat oleh</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const config = typeConfig[row.type] ?? typeConfig.INITIAL;
            const Icon = config.icon;
            const isOutgoing = row.type === "WITHDRAWAL" || row.type === "DIVIDEND";
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Badge variant={config.variant} className="gap-1.5 text-xs font-medium">
                    <Icon size={12} />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-stone-600">
                  {formatDate(row.transactionDate)}
                </TableCell>
                <TableCell className="text-sm text-stone-600 max-w-[200px] truncate">
                  {row.description || "-"}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm font-bold tabular-nums ${isOutgoing ? "text-red-500" : "text-emerald-600"}`}>
                  {isOutgoing ? "-" : "+"}{formatRupiah(row.amount)}
                </TableCell>
                <TableCell className="text-right text-sm text-stone-500">
                  {row.createdByName}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
