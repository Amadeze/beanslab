"use client";

import { useState } from "react";
import { Gift, PackageOpen, RotateCcw, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoidConfirmDialog } from "@/components/VoidConfirmDialog";
import { formatRupiah } from "@/lib/format";
import { voidSampleUsage, type SamplePageData, type SampleRow } from "../sample-actions";

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-ink-secondary">{label}</p><p className="mt-1 font-mono text-lg font-bold text-ink">{value}</p><p className="mt-1 text-[11px] text-ink-secondary">{detail}</p></div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--status-warning)]/10 text-[var(--status-warning)]">{icon}</span>
      </div>
    </div>
  );
}

export function SampleUsagePanel({ data }: { data: SamplePageData }) {
  const router = useRouter();
  const [voidTarget, setVoidTarget] = useState<SampleRow | null>(null);
  const activeRows = data.samples.filter((sample) => sample.status === "COMPLETED");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Sample hari ini" value={`${data.todaySummary.packCount} pack`} detail={`${data.todaySummary.totalGrams.toLocaleString("id-ID")} g · ${data.todaySummary.transactionCount} transaksi`} icon={<Gift size={17} />} />
        <SummaryCard label="HPP hari ini" value={formatRupiah(data.todaySummary.totalCost)} detail="Biaya sample & promosi, non-kas" icon={<Scale size={17} />} />
        <SummaryCard label="Sample bulan ini" value={`${data.monthSummary.packCount} pack`} detail={`${data.monthSummary.totalGrams.toLocaleString("id-ID")} g · ${data.monthSummary.transactionCount} transaksi`} icon={<PackageOpen size={17} />} />
        <SummaryCard label="HPP bulan ini" value={formatRupiah(data.monthSummary.totalCost)} detail="Masuk laporan laba-rugi" icon={<Scale size={17} />} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Riwayat pemberian sample</h2>
          <p className="mt-0.5 text-xs text-ink-secondary">Setiap baris langsung mengurangi stok dan mencatat HPP.</p>
        </div>
        <Table>
          <TableHeader className="bg-surface-sunken">
            <TableRow>
              <TableHead>Waktu & kode</TableHead><TableHead>Sample</TableHead><TableHead>Penerima</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead className="text-right">HPP</TableHead><TableHead>Petugas</TableHead><TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.samples.length === 0 && <TableRow><TableCell colSpan={7} className="h-28 text-center text-sm text-ink-secondary">Belum ada sample yang tercatat.</TableCell></TableRow>}
            {data.samples.map((sample) => (
              <TableRow key={sample.id} className={sample.status === "VOID" ? "opacity-50" : ""}>
                <TableCell><p className="text-xs font-medium text-ink">{new Date(sample.givenAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p><p className="mt-0.5 font-mono text-[11px] text-ink-secondary">{sample.code}{sample.status === "VOID" ? " · VOID" : ""}</p></TableCell>
                <TableCell><p className="text-sm font-semibold text-ink">{sample.sourceLabel}</p><p className="mt-0.5 max-w-[300px] truncate text-[11px] text-ink-secondary" title={sample.components.map((item) => `${item.label}${item.ratioPercent ? ` ${item.ratioPercent}%` : ""}`).join(" · ")}>{sample.components.map((item) => `${item.label}${item.ratioPercent ? ` ${item.ratioPercent}%` : ""}`).join(" · ")}</p></TableCell>
                <TableCell className="text-xs text-ink">{sample.recipient || "—"}</TableCell>
                <TableCell className="text-right"><p className="font-mono text-sm font-semibold">{sample.packCount} pack</p><p className="text-[11px] text-ink-secondary">{sample.totalGrams.toLocaleString("id-ID")} g</p></TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">{formatRupiah(sample.totalCost)}</TableCell>
                <TableCell className="text-xs text-ink">{sample.givenBy}</TableCell>
                <TableCell>{data.canVoid && sample.status === "COMPLETED" &&                 <Button type="button" size="icon" variant="ghost" title="Void sample" aria-label="Void sample" onClick={() => setVoidTarget(sample)} className="text-ink-secondary hover:text-[var(--status-danger)]"><RotateCcw size={15} /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {activeRows.length > 0 && <div className="border-t border-border bg-surface-sunken px-4 py-3 text-xs text-ink">Total aktif: <strong>{activeRows.reduce((sum, item) => sum + item.packCount, 0)} pack</strong> · <strong>{activeRows.reduce((sum, item) => sum + item.totalGrams, 0).toLocaleString("id-ID")} g</strong> · HPP <strong>{formatRupiah(activeRows.reduce((sum, item) => sum + item.totalCost, 0))}</strong></div>}
      </div>

      <VoidConfirmDialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
        title="Void pemberian sample?"
        description="Stok kopi dan kemasan akan dikembalikan otomatis. Laporan sample dan laba-rugi juga dikoreksi."
        onConfirm={async (reason) => {
          if (!voidTarget) return { success: false, error: "Transaksi tidak ditemukan." };
          const result = await voidSampleUsage(voidTarget.id, reason);
          if (result.success) router.refresh();
          return result;
        }}
      />
    </div>
  );
}
