"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { placeLot } from "@/lib/lot-placement";

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

export function PlacementForm({
  lotId,
  availableLocations,
  existingPlacements,
  remainingKg,
}: {
  lotId: string;
  availableLocations: LocationOption[];
  existingPlacements: PlacementInfo[];
  remainingKg: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [loading, setLoading] = useState(false);

  const existingForSelected = existingPlacements.find((p) => p.locationId === locationId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await placeLot({
        lotId,
        locationId,
        quantityKg: Number(quantityKg),
      });
      if (result.success) {
        toast.success("Lot berhasil ditempatkan.");
        setShowForm(false);
        setLocationId("");
        setQuantityKg("");
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          <Plus size={15} /> Tempatkan Lot
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[var(--text-primary)]">Tempatkan ke lokasi</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-[var(--text-tertiary)]">
              <X size={15} />
            </button>
          </div>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
          >
            <option value="">Pilih lokasi</option>
            {availableLocations
              .filter((loc) => !loc.isSystem)
              .map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.warehouseName} — {loc.name} [{loc.code}]
                </option>
              ))}
          </select>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Jumlah (kg)
            </label>
            <input
              type="number" step="0.001" min="0" max={remainingKg}
              value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)}
              required placeholder={existingForSelected ? undefined : "Maks: " + remainingKg}
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
            />
            {existingForSelected && (
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Saat ini: {existingForSelected.quantityKg} kg
              </p>
            )}
          </div>
          <button type="submit" disabled={loading || !locationId || !quantityKg} className="w-full rounded-xl bg-[var(--amber-warm)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan Penempatan"}
          </button>
        </form>
      )}
    </div>
  );
}
