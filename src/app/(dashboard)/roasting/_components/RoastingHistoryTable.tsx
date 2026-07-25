"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKg, formatDate } from "@/lib/format";
import { VoidConfirmDialog } from "@/components/VoidConfirmDialog";
import { voidParentRoastingBatch, completeParentRoastingBatch, splitBatchByCapacity, type ParentRoastingBatchRow } from "../actions";

// ─────────────────────────────────────────────
// Shrinkage badge
// ─────────────────────────────────────────────

function ShrinkageBadge({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-xs text-zinc-400 font-medium">-</span>;
  }
  const label = `${percent.toFixed(1)}%`;
  const className =
    percent > 25
      ? "bg-red-50 text-red-600 border-red-200"
      : percent > 18
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <Badge variant="outline" className={`font-mono text-[11px] ${className}`}>
      -{label}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    COMPLETED: { label: "Selesai", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    PENDING:   { label: "Proses",  className: "bg-blue-50 text-amber-800 border-blue-200"          },
    VOID:      { label: "Void",    className: "bg-zinc-100 text-zinc-400 border-zinc-200"          },
  };
  const s = map[status] ?? { label: status, className: "bg-zinc-100 text-zinc-500 border-zinc-200" };
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${s.className}`}>
      {s.label}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={9} className="py-12 text-center">
        <p className="text-sm font-medium text-zinc-400">
          {isFiltered ? "Tidak ada batch roasting yang cocok." : "Belum ada batch roasting."}
        </p>
        {!isFiltered && (
          <p className="mt-1 text-xs text-zinc-300">
            Klik "Mulai Roasting" di pojok kanan atas untuk mencatat batch pertama.
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface RoastingHistoryTableProps {
  batches: ParentRoastingBatchRow[];
  machineOptions: { id: string; name: string; capacityKg: number | null }[];
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function RoastingHistoryTable({ batches, machineOptions }: RoastingHistoryTableProps) {
  const [voidTarget, setVoidTarget] = useState<ParentRoastingBatchRow | null>(null);
  const [completeTarget, setCompleteTarget] = useState<ParentRoastingBatchRow | null>(null);
  const [splitTarget, setSplitTarget] = useState<ParentRoastingBatchRow | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [actualOutputKg, setActualOutputKg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchSearch =
        b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.inputProductName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.outputProductName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [batches, searchTerm, statusFilter]);

  const handleComplete = async () => {
    if (!completeTarget) return;
    const kg = parseFloat(actualOutputKg);
    if (isNaN(kg) || kg <= 0) {
      toast.error("Berat keluar harus lebih dari 0");
      return;
    }

    setIsSubmitting(true);
    const result = await completeParentRoastingBatch(completeTarget.id, kg);
    setIsSubmitting(false);

    if (result.success) {
      if (result.outcome?.status === "REVIEW") {
        toast.warning(
          `Batch tersimpan. Susut ${result.outcome.lossPercent}% di luar rentang biasanya ${result.outcome.expectedMinPercent}-${result.outcome.expectedMaxPercent}%. Periksa timbangan atau catatan roast.`,
        );
      } else {
        toast.success("Laporan roasting selesai dan stok langsung diperbarui.");
      }
      setCompleteTarget(null);
      setActualOutputKg("");
    } else {
      toastSafe.error(result.error);
    }
  };

  const handleSplit = async () => {
    if (!splitTarget || !selectedMachineId) return;

    setIsSubmitting(true);
    const result = await splitBatchByCapacity(splitTarget.id, selectedMachineId);
    setIsSubmitting(false);

    if (result.success) {
      toast.success(`Batch dibagi menjadi ${result.splits} batch.`);
      setShowSplitModal(false);
      setSplitTarget(null);
      setSelectedMachineId("");
    } else {
      toastSafe.error(result.error);
    }
  };

  return (
    <>
    <div className="mb-4 flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Cari kode atau nama beans..."
          className="pl-9 h-10 bg-white/40 border-white/60 backdrop-blur-md rounded-xl focus-visible:ring-slate-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="h-10 px-3 rounded-xl border border-white/60 bg-white/40 backdrop-blur-md text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
      >
        <option value="ALL">Semua Status</option>
        <option value="COMPLETED">Selesai</option>
        <option value="PENDING">Proses</option>
        <option value="VOID">Void</option>
      </select>
    </div>

    <div className="hidden md:block overflow-hidden rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl shadow-lg shadow-slate-200/30">
      <Table>
        <TableHeader>
          <TableRow className="bg-white/40 border-b border-white/50 backdrop-blur-md hover:bg-white/40">
            <TableHead className="w-36 text-xs font-bold uppercase tracking-widest text-slate-500">Kode Batch</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Green Bean</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Roasted Bean</TableHead>
            <TableHead className=" text-right text-xs font-bold uppercase tracking-widest text-slate-500">Masuk</TableHead>
            <TableHead className=" text-right text-xs font-bold uppercase tracking-widest text-slate-500">Keluar</TableHead>
            <TableHead className=" text-center text-xs font-bold uppercase tracking-widest text-slate-500">Susut</TableHead>
            <TableHead className=" text-xs font-bold uppercase tracking-widest text-slate-500">Tanggal</TableHead>
            <TableHead className="w-24 text-center text-xs font-bold uppercase tracking-widest text-slate-500">Status</TableHead>
            <TableHead className="w-16 text-center text-xs font-bold uppercase tracking-widest text-slate-500">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredBatches.length === 0 ? (
            <EmptyState isFiltered={batches.length > 0} />
          ) : (
            filteredBatches.map((b) => (
              <TableRow key={b.id} className="hover:bg-white/40 transition-colors">
                <TableCell className="font-mono text-xs font-medium text-zinc-700">
                  <Link
                    href={`/roasting/batch/${b.id}`}
                    className="hover:text-amber-600 hover:underline transition-colors"
                  >
                    {b.code}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-zinc-900">{b.inputProductName}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-zinc-900">{b.outputProductName}</p>
                </TableCell>
                <TableCell  className="text-right font-mono text-sm text-zinc-700">
                  {formatKg(b.targetWeightKg)}
                </TableCell>
                <TableCell  className="text-right font-mono text-sm font-semibold text-zinc-900">
                  {b.actualOutputKg ? formatKg(b.actualOutputKg) : "-"}
                </TableCell>
                <TableCell className="text-center">
                  <ShrinkageBadge percent={b.totalShrinkagePercent} />
                </TableCell>
                <TableCell className="text-sm text-zinc-500">
                  {formatDate(b.createdAt)}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={b.status} />
                </TableCell>
                <TableCell className="text-center">
                  {b.status === "COMPLETED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg"
                      onClick={() => setVoidTarget(b)}
                    >
                      Void
                    </Button>
                  )}
                  {b.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-amber-500 hover:bg-amber-50 hover:text-amber-600 rounded-lg"
                        onClick={() => {
                          setSplitTarget(b);
                          setShowSplitModal(true);
                        }}
                      >
                        Split
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
                        onClick={() => {
                          setCompleteTarget(b);
                          // Auto-fill from linked roast data (sum all child batches)
                          const totalRoasted = b.childBatches
                            .filter((c) => c.roastedWeightGrams)
                            .reduce((sum, c) => sum + (c.roastedWeightGrams || 0), 0);
                          if (totalRoasted > 0) {
                            setActualOutputKg((totalRoasted / 1000).toFixed(2));
                          } else {
                            setActualOutputKg("");
                          }
                        }}
                      >
                        Selesaikan
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

    <div className="md:hidden flex flex-col gap-3">
      {filteredBatches.length === 0 ? (
        <div className="py-12 text-center rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl">
           <p className="text-sm font-medium text-zinc-400">Belum ada riwayat roasting.</p>
        </div>
      ) : (
        filteredBatches.map((b) => (
          <div key={b.id} className="flex flex-col gap-2 rounded-[1.25rem] border border-white/60 bg-white/30 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-900">{b.outputProductName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Link
                    href={`/roasting/batch/${b.id}`}
                    className="font-mono text-xs font-semibold text-slate-600 hover:text-amber-600 hover:underline transition-colors"
                  >
                    {b.code}
                  </Link>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500">{b.inputProductName}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-black text-slate-900">{b.actualOutputKg ? formatKg(b.actualOutputKg) : "-"}</p>
                <p className="font-mono text-[10px] font-bold text-slate-500 mt-0.5">Masuk: {formatKg(b.targetWeightKg)}</p>
              </div>
            </div>

            <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/40">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={b.status} />
                  <ShrinkageBadge percent={b.totalShrinkagePercent} />
                </div>
                <span className="text-[10px] font-semibold text-slate-500">{formatDate(b.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {b.status === "COMPLETED" && (
                  <Button size="sm" variant="ghost" onClick={() => setVoidTarget(b)} className="h-7 px-2.5 text-[11px] font-bold uppercase text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg">
                    Void
                  </Button>
                )}
                {b.status === "PENDING" && (
                  <Button size="sm" variant="ghost" onClick={() => {
                    setCompleteTarget(b);
                    const totalRoasted = b.childBatches
                      .filter((c) => c.roastedWeightGrams)
                      .reduce((sum, c) => sum + (c.roastedWeightGrams || 0), 0);
                    if (totalRoasted > 0) {
                      setActualOutputKg((totalRoasted / 1000).toFixed(2));
                    } else {
                      setActualOutputKg("");
                    }
                  }} className="h-7 px-2.5 text-[11px] font-bold uppercase text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">
                    Validasi Sore
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>

    <VoidConfirmDialog
      open={!!voidTarget}
      onOpenChange={(v) => { if (!v) setVoidTarget(null); }}
      title={`Void Batch ${voidTarget?.code ?? ""}`}
      description="Tindakan ini akan membalik mutasi stok Green Bean dan Roasted Bean. Tidak dapat dibatalkan."
      onConfirm={async (reason) => {
        const result = await voidParentRoastingBatch(voidTarget!.id, reason);
        return result;
      }}
    />

    {completeTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
        <div className="rounded-2xl border border-stone-200/60 bg-white/70 shadow-xl backdrop-blur-md w-full max-w-sm overflow-hidden animate-in zoom-in-95">
          <div className="p-5">
            <h3 className="font-bold text-lg mb-1">Validasi Akhir Sesi</h3>
            <p className="text-xs text-slate-500 mb-4">Selesaikan {completeTarget.code} ({completeTarget.outputProductName}) dengan menginput berat akhir.</p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Berat Masuk (Kg)</label>
                <Input value={completeTarget.targetWeightKg} disabled className="bg-slate-50 font-mono text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Berat Keluar / Matang (Kg)</label>
                <Input
                  type="number"
                  autoFocus
                  placeholder="Contoh: 16.5"
                  value={actualOutputKg}
                  onChange={(e) => setActualOutputKg(e.target.value)}
                  className="font-mono text-sm font-bold border-indigo-200 focus:border-indigo-500"
                />
                {(() => {
                  const totalRoasted = completeTarget.childBatches
                    .filter((c) => c.roastedWeightGrams)
                    .reduce((sum, c) => sum + (c.roastedWeightGrams || 0), 0);
                  if (totalRoasted > 0) {
                    return (
                      <p className="text-[10px] text-indigo-500 mt-1">
                        Dari Artisan: {(totalRoasted / 1000).toFixed(2)} kg
                        ({completeTarget.childBatches.filter((c) => c.roastId).length} roast profile)
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 p-4 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCompleteTarget(null); setActualOutputKg(""); }}>Batal</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isSubmitting} onClick={handleComplete}>
              {isSubmitting ? "Menyimpan..." : "Selesaikan Laporan"}
            </Button>
          </div>
        </div>
      </div>
    )}

    {showSplitModal && splitTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
        <div className="rounded-2xl border border-stone-200/60 bg-white/70 shadow-xl backdrop-blur-md w-full max-w-sm overflow-hidden animate-in zoom-in-95">
          <div className="p-5">
            <h3 className="font-bold text-lg mb-1">Split Batch</h3>
            <p className="text-xs text-slate-500 mb-4">
              Batch {splitTarget.code} ({splitTarget.targetWeightKg} kg) akan dibagi berdasarkan kapasitas mesin.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Berat Masuk (Kg)</label>
                <Input value={splitTarget.targetWeightKg} disabled className="bg-slate-50 font-mono text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Pilih Mesin</label>
                <select
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                >
                  <option value="">-- Pilih Mesin --</option>
                  {machineOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.capacityKg ? `(${m.capacityKg} kg)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 p-4 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowSplitModal(false); setSplitTarget(null); setSelectedMachineId(""); }}>Batal</Button>
            <Button disabled={isSubmitting || !selectedMachineId} onClick={handleSplit}>
              {isSubmitting ? "Memproses..." : "Split Batch"}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
