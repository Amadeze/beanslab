"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoveLeft, X, AlertCircle } from "lucide-react";
import { transferLot } from "@/lib/lot-transfer";

type LocationOption = {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  warehouseName: string;
};

type PlacementInfo = {
  locationId: string;
  locationName: string;
  warehouseName: string;
  quantityKg: number;
  quantityUnit: number;
  supplyQty: number;
};

export function TransferDrawer({
  lotId,
  availableLocations,
  existingPlacements,
  remainingKg,
  initialOpen = false,
  initialSourceLocationId,
}: {
  lotId: string;
  availableLocations: LocationOption[];
  existingPlacements: PlacementInfo[];
  remainingKg: number;
  initialOpen?: boolean;
  initialSourceLocationId?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const validInitialSource = existingPlacements.some((placement) => placement.locationId === initialSourceLocationId)
    ? initialSourceLocationId
    : "";
  const [open, setOpen] = useState(initialOpen);
  const [sourceLocationId, setSourceLocationId] = useState(validInitialSource ?? "");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const sourcePlacement = existingPlacements.find((p) => p.locationId === sourceLocationId);

  const movableSources = existingPlacements.filter((p) => {
    if (p.quantityKg > 0 || p.quantityUnit > 0 || p.supplyQty > 0) {
      const loc = availableLocations.find((l) => l.id === p.locationId);
      return !loc?.isSystem;
    }
    return false;
  });
  const allLockedBySystem =
    existingPlacements.length > 0 &&
    existingPlacements.every((p) => availableLocations.find((l) => l.id === p.locationId)?.isSystem);

  useEffect(() => {
    if (!open || allLockedBySystem) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : triggerButtonRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loadingRef.current) {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [allLockedBySystem, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await transferLot({
        lotId,
        sourceLocationId,
        destinationLocationId,
        quantityKg: Number(quantityKg),
      });
      if (result.success) {
        toast.success("Lot berhasil dipindah.");
        setOpen(false);
        setSourceLocationId("");
        setDestinationLocationId("");
        setQuantityKg("");
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        ref={triggerButtonRef}
        onClick={() => setOpen(true)}
        disabled={existingPlacements.length === 0}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-50"
      >
        <MoveLeft size={15} /> Pindah Lokasi
      </button>
    );
  }

  if (allLockedBySystem) {
    return (
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        Stok di lokasi sistem dikelola otomatis oleh sistem dan tidak dapat dipindahkan secara manual.
      </div>
    );
  }

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:pt-0" role="dialog" aria-modal="true" aria-labelledby="transfer-lot-title">
      <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />
      <div className="relative w-full max-w-lg rounded-t-2xl border border-[var(--glass-border)] bg-[#0B141B] p-6 shadow-xl md:rounded-2xl md:mt-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="transfer-lot-title" className="font-semibold text-[var(--text-primary)]">Pindah Lot ke Lokasi Lain</h3>
          <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Tutup alur pindah lot" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber-warm)]">
            <X size={18} />
          </button>
        </div>

        {sourcePlacement && sourcePlacement.quantityKg < remainingKg && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/30 p-2 text-xs text-amber-800">
            <AlertCircle className="mr-1 inline h-3 w-3" />
            Sumber hanya memiliki {sourcePlacement.quantityKg.toLocaleString("id-ID")} kg. Stok belum ditempatkan: {remainingKg.toLocaleString("id-ID")} kg.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Dari Lokasi Sumber</label>
            <select
              value={sourceLocationId}
              onChange={(e) => setSourceLocationId(e.target.value)}
              required
              className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
            >
              <option value="">Pilih lokasi sumber</option>
              {movableSources.map((p) => {
                const loc = availableLocations.find((l) => l.id === p.locationId);
                return (
                  <option key={p.locationId} value={p.locationId}>
                    {loc?.warehouseName ?? p.warehouseName} — {p.locationName} [{loc?.code ?? ""}]
                  </option>
                );
              })}
            </select>
            {sourcePlacement && (
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Tersedia: {sourcePlacement.quantityKg.toLocaleString("id-ID")} kg
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ke Lokasi Tujuan</label>
            <select
              value={destinationLocationId}
              onChange={(e) => setDestinationLocationId(e.target.value)}
              required
              className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
            >
              <option value="">Pilih lokasi tujuan</option>
              {availableLocations
                .filter((l) => !l.isSystem && l.id !== sourceLocationId)
                .map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.warehouseName} — {loc.name} [{loc.code}]
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Jumlah (kg)</label>
            <input
              type="number" step="0.001" min="0"
              value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)}
              placeholder={sourcePlacement ? `Maks: ${sourcePlacement.quantityKg}` : undefined}
              required
              className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading || !sourceLocationId || !destinationLocationId || !quantityKg}
              className="min-h-11 rounded-xl bg-[var(--amber-warm)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? "Memindah..." : "Konfirmasi Pindah"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={loading}
              className="min-h-11 rounded-xl border border-[var(--glass-border)] px-5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
