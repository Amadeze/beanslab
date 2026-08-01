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
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-stone-500">{label}</p><p className="mt-1 font-mono text-lg font-bold text-stone-900">{value}</p><p className="mt-1 text-[11px] text-stone-500">{detail}</p></div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">{icon}</span>
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

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-stone-900">Riwayat pemberian sample</h2>
          <p className="mt-0.5 text-xs text-stone-500">Setiap baris langsung mengurangi stok dan mencatat HPP.</p>
        </div>
        <Table>
          <TableHeader className="bg-stone-50">
            <TableRow>
              <TableHead>Waktu & kode</TableHead><TableHead>Sample</TableHead><TableHead>Penerima</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead className="text-right">HPP</TableHead><TableHead>Petugas</TableHead><TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.samples.length === 0 && <TableRow><TableCell colSpan={7} className="h-28 text-center text-sm text-stone-500">Belum ada sample yang tercatat.</TableCell></TableRow>}
            {data.samples.map((sample) => (
              <TableRow key={sample.id} className={sample.status === "VOID" ? "opacity-50" : ""}>
                <TableCell><p className="text-xs font-medium text-stone-800">{new Date(sample.givenAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p><p className="mt-0.5 font-mono text-[11px] text-stone-500">{sample.code}{sample.status === "VOID" ? " · VOID" : ""}</p></TableCell>
                <TableCell><p className="text-sm font-semibold text-stone-900">{sample.sourceLabel}</p><p className="mt-0.5 max-w-[300px] truncate text-[11px] text-stone-500" title={sample.components.map((item) => `${item.label}${item.ratioPercent ? ` ${item.ratioPercent}%` : ""}`).join(" · ")}>{sample.components.map((item) => `${item.label}${item.ratioPercent ? ` ${item.ratioPercent}%` : ""}`).join(" · ")}</p></TableCell>
                <TableCell className="text-xs text-stone-600">{sample.recipient || "—"}</TableCell>
                <TableCell className="text-right"><p className="font-mono text-sm font-semibold">{sample.packCount} pack</p><p className="text-[11px] text-stone-500">{sample.totalGrams.toLocaleString("id-ID")} g</p></TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">{formatRupiah(sample.totalCost)}</TableCell>
                <TableCell className="text-xs text-stone-600">{sample.givenBy}</TableCell>
                <TableCell>{data.canVoid && sample.status === "COMPLETED" &&                 <Button type="button" size="icon" variant="ghost" title="Void sample" aria-label="Void sample" onClick={() => setVoidTarget(sample)} className="text-stone-400 hover:text-red-600"><RotateCcw size={15} /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {activeRows.length > 0 && <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">Total aktif: <strong>{activeRows.reduce((sum, item) => sum + item.packCount, 0)} pack</strong> · <strong>{activeRows.reduce((sum, item) => sum + item.totalGrams, 0).toLocaleString("id-ID")} g</strong> · HPP <strong>{formatRupiah(activeRows.reduce((sum, item) => sum + item.totalCost, 0))}</strong></div>}
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
