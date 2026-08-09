"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Loader2, Save, X, Package, Calendar } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createOpnameDraft, type OpnameItem } from "../actions";

const INPUT_GLASS =
  "w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50";
const BTN_PRIMARY =
  "rounded-xl bg-[var(--amber-warm)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50";
const BTN_GHOST =
  "rounded-xl border border-[var(--glass-border)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition";

const schema = z.object({
  lotId: z.string().min(1, "Pilih lot"),
  locationId: z.string().min(1, "Pilih lokasi"),
  countedQuantity: z.number().min(0, "Jumlah harus ≥ 0"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export interface OpnameDraftClientProps {
  items: OpnameItem[];
  warehouses: Array<{
    id: string;
    name: string;
    code: string;
    locations: Array<{ id: string; name: string; code: string }>;
  }>;
}

export function OpnameDraftClient({ items, warehouses }: OpnameDraftClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      lotId: "",
      locationId: "",
      countedQuantity: 0,
      notes: "",
    },
  });

  const selectedLot = items.find((i) => i.lotId === watch("lotId"));
  const isSupply = selectedLot?.supplyItemName != null && selectedLot?.productName == null && selectedLot?.packagingName == null;
  const isPackaging = selectedLot?.packagingName != null;
  const isProduct = selectedLot?.productName != null;
  const unitLabel = isSupply || isPackaging ? "Unit" : "Kg";

  function handleOpenForm() {
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    reset();
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const item = items.find((i) => i.lotId === data.lotId);
      if (!item) throw new Error("Lot tidak valid");

      const result = await createOpnameDraft({
        lotId: data.lotId,
        locationId: data.locationId,
        countedQuantityKg: isProduct ? data.countedQuantity : undefined,
        countedQuantityUnit: isPackaging ? Math.round(data.countedQuantity) : undefined,
        countedSupplyQty: isSupply ? data.countedQuantity : undefined,
        notes: data.notes,
      });

      if (!result.success) {
        toastSafe.error(result.error || "Gagal membuat draft opname.");
      } else {
        toast.success("Draft opname berhasil dibuat!");
        reset();
        setShowForm(false);
      }
    } catch (err: any) {
      toastSafe.error(err.message || "Gagal memproses form");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {!showForm && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Opname Stok Lokasi</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Hitung stok fisik per lot per lokasi. {items.length} lot dengan penempatan aktif.
            </p>
          </div>
          <button onClick={handleOpenForm} className="flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition">
            <Package size={16} /> Buat Draft Opname
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Draft Opname Baru</h3>
            <button type="button" onClick={handleCloseForm} className={BTN_GHOST_ICON}>
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Lot / Barang</Label>
            <select
              className={`w-full h-11 rounded-lg border px-3 text-sm transition-all appearance-none outline-none ${INPUT_GLASS} ${errors.lotId ? "border-red-400 ring-red-400" : ""}`}
              {...register("lotId")}
            >
              <option value="">-- Pilih lot... --</option>
              {items.map((item) => (
                <option key={item.lotId} value={item.lotId}>
                  {item.label} [{item.batchCode}] — {item.locationName}
                </option>
              ))}
            </select>
            {errors.lotId && <p className="text-sm text-red-500">{errors.lotId.message}</p>}
          </div>

          {selectedLot && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="glass-card rounded-xl p-3">
                  <span className="text-[var(--text-tertiary)]">Sistem (placement)</span>
                  <p className="font-bold text-[var(--text-primary)]">
                    {isSupply
                      ? `${selectedLot.placementSupply} ${unitLabel}`
                      : isPackaging
                      ? `${selectedLot.placementUnit} ${unitLabel}`
                      : `${selectedLot.placementKg} ${unitLabel}`}
                  </p>
                </div>
                <div className="glass-card rounded-xl p-3">
                  <span className="text-[var(--text-tertiary)]">Lokasi</span>
                  <p className="font-bold text-[var(--text-primary)]">{selectedLot.locationName}</p>
                </div>
              </div>

              {selectedLot.expiryDate && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <Calendar size={14} />
                  Kedaluwarsa: {new Date(selectedLot.expiryDate).toLocaleDateString("id-ID")}
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Jumlah Terhitung ({unitLabel})</Label>
            <Input
              type="number"
              step="any"
              min="0"
              className={`h-11 font-mono ${INPUT_GLASS}`}
              placeholder="0"
              {...register("countedQuantity", { valueAsNumber: true })}
            />
            {errors.countedQuantity && <p className="text-sm text-red-500">{errors.countedQuantity.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Lokasi Penyimpanan</Label>
            <select
              className={`w-full h-11 rounded-lg border px-3 text-sm transition-all appearance-none outline-none ${INPUT_GLASS} ${errors.locationId ? "border-red-400 ring-red-400" : ""}`}
              {...register("locationId")}
            >
              <option value="">-- Pilih lokasi... --</option>
              {warehouses.map((w) =>
                w.locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {w.name} / {loc.name} [{loc.code}]
                  </option>
                )),
              )}
            </select>
            {errors.locationId && <p className="text-sm text-red-500">{errors.locationId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Catatan (opsional)</Label>
            <Textarea
              placeholder="Misal: stok usang, stok tumpah, rusak..."
              className="resize-none"
              {...register("notes")}
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting || !watch("lotId") || !watch("locationId")} className={BTN_PRIMARY}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="ml-2">Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save size={16} /> Simpan Draft
                </>
              )}
            </button>
            <button type="button" onClick={handleCloseForm} className={BTN_GHOST}>
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const BTN_GHOST_ICON =
  "rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition";
