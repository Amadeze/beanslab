"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Check, X, Clock, AlertTriangle, Package, MapPin, User, Calendar, Warehouse } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { confirmOpname, cancelOpname, type LocationOpnameDraft } from "../actions";

const BTN_GHOST_ICON =
  "rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition";

export function OpnameDraftList({ initialDrafts }: { initialDrafts: LocationOpnameDraft[] }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [cancelDraftId, setCancelDraftId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  async function handleConfirm(id: string) {
    const res = await confirmOpname(id);
    if (res.success) {
      toast.success("Opname berhasil disahkan!");
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } else {
      toastSafe.error(res.error || "Gagal menyahkan opname.");
    }
  }

  async function requestCancel(id: string) {
    setCancelDraftId(id);
    setCancelReason("");
  }

  async function confirmCancel() {
    if (!cancelDraftId) return;
    const id = cancelDraftId;
    const res = await cancelOpname(id, cancelReason || undefined);
    if (res.success) {
      toast.success("Opname dibatalkan.");
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } else {
      toastSafe.error(res.error || "Gagal membatalkan opname.");
    }
    setCancelDraftId(null);
  }

  if (drafts.length === 0) {
    return (
      <div>
        <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">Draft Opname</h3>
        <div className="glass-card rounded-2xl p-12 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
          <p className="text-[var(--text-secondary)]">
            Belum ada draft opname. Buat draft di atas untuk memulai.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
        Draft Opname ({drafts.length})
      </h3>
      <div className="space-y-3">
        {drafts.map((d) => (
          <div key={d.id} className="glass-card flex items-center gap-4 rounded-2xl p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Package className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--text-primary)]">{d.lotLabel}</p>
                <span className="text-xs text-[var(--text-tertiary)]">[{d.lotId.slice(0, 8)}]</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {d.locationLabel}
                </span>
                <span className="flex items-center gap-1">
                  <Warehouse size={12} /> {d.warehouseName}
                </span>
                <span className="flex items-center gap-1">
                  <User size={12} /> {d.createdByName ?? "-"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {new Date(d.createdAt).toLocaleDateString("id-ID")}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                <div className="glass-card rounded-lg p-2">
                  <span className="text-[var(--text-tertiary)]">Sistem</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {d.systemQuantityKg > 0
                      ? `${d.systemQuantityKg} Kg`
                      : d.systemQuantityUnit > 0
                      ? `${d.systemQuantityUnit} Unit`
                      : `${d.systemSupplyQty} baseUnit`}
                  </p>
                </div>
                <div className="glass-card rounded-lg p-2">
                  <span className="text-[var(--text-tertiary)]">Terhitung</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {d.countedQuantityKg
                      ? `${d.countedQuantityKg} Kg`
                      : d.countedQuantityUnit
                      ? `${d.countedQuantityUnit} Unit`
                      : d.countedSupplyQty
                      ? `${d.countedSupplyQty} baseUnit`
                      : "-"}
                  </p>
                </div>
                <div className="glass-card rounded-lg p-2">
                  <span className="text-[var(--text-tertiary)]">Selisih</span>
                  <p
                    className={`font-medium ${
                      d.varianceKg > 0 || d.varianceUnit > 0 || d.varianceSupply > 0
                        ? "text-emerald-600"
                        : d.varianceKg < 0 || d.varianceUnit < 0 || d.varianceSupply < 0
                        ? "text-rose-600"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {d.varianceKg !== 0
                      ? `${d.varianceKg} Kg`
                      : d.varianceUnit !== 0
                      ? `${Math.sign(d.varianceUnit)}${Math.abs(d.varianceUnit)} Unit`
                      : d.varianceSupply !== 0
                      ? `${d.varianceSupply} baseUnit`
                      : "0"}
                  </p>
                </div>
              </div>
            </div>

            {(d.varianceKg !== 0 || d.varianceUnit !== 0 || d.varianceSupply !== 0) && (
              <div className="flex items-center gap-1 text-xs text-rose-500">
                <AlertTriangle size={14} />
                Perlu koreksi
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleConfirm(d.id)}
                className={BTN_GHOST_ICON}
                title="Konfirmasi & sesuaikan stok"
              >
                <Check size={18} className="text-emerald-600" />
              </button>
              <button
                onClick={() => requestCancel(d.id)}
                className={BTN_GHOST_ICON}
                title="Batalkan Opname"
              >
                <X className="h-4 w-4 text-rose-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!cancelDraftId} onOpenChange={(open) => !open && setCancelDraftId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Draft Opname</DialogTitle>
            <DialogDescription>
              Masukkan alasan pembatalan opname (opsional). Draft ini akan ditandai sebagai dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              placeholder="Alasan pembatalan..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDraftId(null)}>
              Tutup
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              Batalkan Opname
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
