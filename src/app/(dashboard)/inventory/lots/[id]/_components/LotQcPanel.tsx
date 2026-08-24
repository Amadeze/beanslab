"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setLotQcStatus } from "../../../lot-actions";
import type { DefectRisk, MoistureYieldPrediction } from "@/lib/lot-intelligence";

type QcStatus = "PENDING" | "RELEASED" | "HOLD";

const QC_BADGE: Record<QcStatus, { label: string; className: string; Icon: typeof ShieldCheck }> = {
  RELEASED: { label: "Lolos QC", className: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: ShieldCheck },
  HOLD: { label: "Karantina (HOLD)", className: "bg-red-50 text-red-700 border-red-200", Icon: ShieldAlert },
  PENDING: { label: "Menunggu QC", className: "bg-amber-50 text-amber-700 border-amber-200", Icon: ShieldQuestion },
};

export function LotQcPanel({
  lotId,
  qcStatus,
  consumed,
  prediction,
  defect,
}: {
  lotId: string;
  qcStatus: QcStatus;
  consumed: boolean;
  prediction: MoistureYieldPrediction;
  defect: DefectRisk;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const badge = QC_BADGE[qcStatus];
  const BadgeIcon = badge.Icon;

  const changeStatus = async (next: QcStatus) => {
    setBusy(true);
    const result = await setLotQcStatus(lotId, next);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? "Gagal mengubah status QC.");
      return;
    }
    toast.success(next === "HOLD" ? "Lot dikarantina — tidak akan dialokasikan FEFO." : next === "RELEASED" ? "Lot dilepas dan siap dipakai." : "Status QC diperbarui.");
    startTransition(() => router.refresh());
  };

  const busyState = busy || pending;

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${badge.className}`}>
            <BadgeIcon size={13} /> {badge.label}
          </span>
          {qcStatus === "HOLD" && !consumed && (
            <span className="text-xs text-muted-foreground">FEFO melewati lot ini sampai dilepas.</span>
          )}
        </div>
        {!consumed && (
          <div className="flex gap-2">
            {qcStatus !== "HOLD" && (
              <Button size="sm" variant="outline" disabled={busyState} onClick={() => changeStatus("HOLD")}>
                Karantina
              </Button>
            )}
            {(qcStatus === "HOLD" || qcStatus === "PENDING") && (
              <Button size="sm" disabled={busyState} onClick={() => changeStatus("RELEASED")}>
                Lepas &amp; loloskan
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border bg-white/40 p-3">
          <p className="text-xs text-muted-foreground">Prediksi yield roast</p>
          <p className="mt-1 text-xl font-black tabular-nums">{prediction.expectedYieldPercent}%</p>
          <p className={`mt-0.5 text-xs ${prediction.confidence === "HIGH" ? "text-emerald-600" : prediction.confidence === "MEDIUM" ? "text-amber-600" : "text-slate-400"}`}>
            {prediction.confidence === "HIGH" ? "Keyakinan tinggi" : prediction.confidence === "MEDIUM" ? "Perlu verifikasi" : "Asumsi default"}
          </p>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">{prediction.note}</p>
        </div>
        <div className="rounded-lg border bg-white/40 p-3">
          <p className="text-xs text-muted-foreground">Risiko defect</p>
          <p className={`mt-1 text-xl font-black ${defect.severity === "HIGH" ? "text-red-600" : defect.severity === "ELEVATED" ? "text-amber-600" : "text-emerald-600"}`}>
            {defect.severity === "LOW" ? "Rendah" : defect.severity === "ELEVATED" ? "Waspada" : "Tinggi"}
          </p>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">{defect.note}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border bg-white/40 p-3 text-xs">
          <dt className="text-muted-foreground">Loss est.</dt>
          <dd className="text-right font-bold tabular-nums">{prediction.expectedLossPercent}%</dd>
          <dt className="text-muted-foreground">Penalti mutu</dt>
          <dd className="text-right font-bold tabular-nums">{defect.qualityPenaltyPercent > 0 ? `${defect.qualityPenaltyPercent}%` : "—"}</dd>
          <dt className="col-span-2 text-muted-foreground">Saran</dt>
          <dd className="col-span-2 leading-4 text-muted-foreground">
            {defect.severity === "HIGH"
              ? "Sortir ulang / klaim supplier sebelum roasting."
              : qcStatus === "PENDING"
                ? "Selesaikan pemeriksaan intake lalu lepaskan lot."
                : "Aman untuk dijadwalkan roasting."}
          </dd>
        </dl>
      </div>
    </section>
  );
}
