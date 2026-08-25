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
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <PiggyBank size={40} className="mx-auto mb-3 text-ink-secondary" />
        <p className="text-sm font-medium text-ink-secondary">Belum ada mutasi modal</p>
        <p className="text-xs text-ink-secondary mt-1">Catat setoran modal awal atau prive pemilik</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-sunken">
            <TableHead className="text-xs uppercase tracking-widest text-ink-secondary font-bold">Tipe</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-ink-secondary font-bold">Tanggal</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-ink-secondary font-bold">Keterangan</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-widest text-ink-secondary font-bold">Nominal</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-widest text-ink-secondary font-bold">Dicatat oleh</TableHead>
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
                <TableCell className="text-sm text-ink">
                  {formatDate(row.transactionDate)}
                </TableCell>
                <TableCell className="text-sm text-ink max-w-[200px] truncate">
                  {row.description || "-"}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm font-bold tabular-nums ${isOutgoing ? "text-[var(--status-danger)]" : "text-[var(--status-success)]"}`}>
                  {isOutgoing ? "-" : "+"}{formatRupiah(row.amount)}
                </TableCell>
                <TableCell className="text-right text-sm text-ink-secondary">
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
