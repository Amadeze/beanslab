"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSupplyItem, updateSupplyItem } from "../actions";
import type { SupplyItemRow } from "../actions";
import { cn } from "@/lib/utils";

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

const CATEGORY_OPTIONS: { value: SupplyItemRow["category"]; label: string }[] = [
  { value: "PACKAGING", label: "Kemasan (pouch, valve, label, box)" },
  { value: "INGREDIENT", label: "Bahan Baku Non-Kopi" },
  { value: "CONSUMABLE", label: "Bahan Operasional Habis Pakai" },
  { value: "MERCHANDISE", label: "Merchandise (barang jualan non-kopi)" },
  { value: "SPARE_PART", label: "Suku Cadang" },
  { value: "EQUIPMENT", label: "Alat / Peralatan" },
  { value: "OTHER", label: "Lainnya" },
];

const BASE_UNIT_OPTIONS: { value: SupplyItemRow["baseUnit"]; label: string }[] = [
  { value: "PCS", label: "Pcs (satuan)" },
  { value: "BOX", label: "Box" },
  { value: "SET", label: "Set" },
  { value: "ROLL", label: "Roll" },
  { value: "KG", label: "Kg" },
  { value: "GRAM", label: "Gram" },
  { value: "LITER", label: "Liter" },
  { value: "METER", label: "Meter" },
  { value: "OTHER", label: "Satuan lain" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Nama wajib diisi (minimal 2 karakter)"),
  category: z.enum(["PACKAGING", "INGREDIENT", "CONSUMABLE", "MERCHANDISE", "SPARE_PART", "EQUIPMENT", "OTHER"]),
  baseUnit: z.enum(["KG", "GRAM", "LITER", "METER", "ROLL", "PCS", "BOX", "SET", "OTHER"]),
  trackLot: z.boolean(),
  shelfLifeDays: z.number().int().min(1).max(36_500).nullable(),
  consumableInProduction: z.boolean(),
  includeInProductHpp: z.boolean(),
  capacityGrams: z.number().min(0).nullable(),
  tareWeightGrams: z.number().min(0).nullable(),
  costPerUnit: z.number().min(0, "Harga pokok harus diisi"),
  isActive: z.boolean(),
  reorderAlertEnabled: z.boolean(),
  leadTimeDays: z.number().int().min(1).max(365),
  safetyStockQuantity: z.number().min(0),
  reorderLookbackDays: z.number().int().min(7).max(365),
});

type FormValues = z.infer<typeof schema>;

const toNullable = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface SupplyItemFormProps {
  id: string;
  onSuccess: () => void;
  onPendingChange?: (isPending: boolean) => void;
  initialData?: SupplyItemRow;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-amber-700 peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all" />
    </label>
  );
}

export function SupplyItemForm({ id, onSuccess, onPendingChange, initialData }: SupplyItemFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!initialData;

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          category: initialData.category,
          baseUnit: initialData.baseUnit,
          trackLot: initialData.trackLot,
          shelfLifeDays: initialData.shelfLifeDays,
          consumableInProduction: initialData.consumableInProduction,
          includeInProductHpp: initialData.includeInProductHpp,
          capacityGrams: initialData.capacityGrams,
          tareWeightGrams: initialData.tareWeightGrams,
          costPerUnit: initialData.costPerUnit,
          isActive: initialData.isActive,
          reorderAlertEnabled: initialData.reorderAlertEnabled,
          leadTimeDays: initialData.leadTimeDays ?? 7,
          safetyStockQuantity: initialData.safetyStockQuantity ?? 0,
          reorderLookbackDays: initialData.reorderLookbackDays ?? 30,
        }
      : {
          name: "",
          category: "PACKAGING",
          baseUnit: "PCS",
          trackLot: true,
          shelfLifeDays: null,
          consumableInProduction: false,
          includeInProductHpp: false,
          capacityGrams: null,
          tareWeightGrams: null,
          costPerUnit: 0,
          isActive: true,
          reorderAlertEnabled: false,
          leadTimeDays: 7,
          safetyStockQuantity: 0,
          reorderLookbackDays: 30,
        },
  });

  const category = watch("category");
  const trackLot = watch("trackLot");

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    onPendingChange?.(true);
    try {
      const result = isEditMode
        ? await updateSupplyItem({ id: initialData!.id, ...values, capacityGrams: toNullable(values.capacityGrams), tareWeightGrams: toNullable(values.tareWeightGrams), shelfLifeDays: toNullable(values.shelfLifeDays) })
        : await createSupplyItem({ ...values, capacityGrams: toNullable(values.capacityGrams), tareWeightGrams: toNullable(values.tareWeightGrams), shelfLifeDays: toNullable(values.shelfLifeDays) });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success(isEditMode ? `${result.code} berhasil diperbarui` : `Persediaan ${result.code} berhasil ditambahkan`);
      onSuccess();
    } catch (err) {
      console.error("[SupplyItemForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
        Kode dibuat otomatis. Stok dihitung dari transaksi (pembelian, produksi, mutasi).
      </div>

      {/* ── Identitas ── */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Nama Barang <span className="text-red-500">*</span>
        </Label>
        <Input placeholder="Contoh: Zipper Bag 250g, Label Kopi 60x40, Sirup Vanilla" className={cn("h-9", glassInput)} {...register("name")} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Kategori <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <SelectTrigger className={cn("h-9 w-full text-sm", glassInput)}>
                  <SelectValue placeholder="Pilih kategori...">
                    {field.value ? CATEGORY_OPTIONS.find((c) => c.value === field.value)?.label : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Satuan Dasar <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="baseUnit"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <SelectTrigger className={cn("h-9 w-full text-sm", glassInput)}>
                  <SelectValue placeholder="Pilih satuan...">
                    {field.value ? BASE_UNIT_OPTIONS.find((b) => b.value === field.value)?.label : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BASE_UNIT_OPTIONS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* ── Perilaku ── */}
      <div className={cn(glassCard, "space-y-3")}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Perilaku Stok</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Ikut lot &amp; FEFO</p>
              <p className="text-xs text-slate-500">Stok dipantau per lot, kedaluwarsa terpakai lebih dulu</p>
            </div>
            <Controller control={control} name="trackLot" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />} />
          </div>

          {trackLot && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Umur Simpan (hari, opsional)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="Contoh: 180"
                className={cn("h-9", glassInput)}
                {...register("shelfLifeDays", { valueAsNumber: true })}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Dikonsumsi saat produksi</p>
              <p className="text-xs text-slate-500">Muncul sebagai bahan pada form produksi &amp; packing</p>
            </div>
            <Controller control={control} name="consumableInProduction" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Masuk biaya HPP produk jadi</p>
              <p className="text-xs text-slate-500">Biaya pemakaiannya ditambahkan ke HPP produk</p>
            </div>
            <Controller control={control} name="includeInProductHpp" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />} />
          </div>
        </div>
      </div>

      {/* ── Metrik kemasan (PACKAGING only) ── */}
      {category === "PACKAGING" && (
        <div className={cn(glassCard, "space-y-3")}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Metrik Kemasan</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Kapasitas Isi Bersih (gram)</Label>
              <Input type="number" min="0" step="0.01" placeholder="Contoh: 250" className={cn("h-9", glassInput)} {...register("capacityGrams", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Berat Kemasan Kosong (gram)</Label>
              <Input type="number" min="0" step="0.01" placeholder="Contoh: 12" className={cn("h-9", glassInput)} {...register("tareWeightGrams", { valueAsNumber: true })} />
            </div>
          </div>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Info size={12} /> Digunakan untuk menghitung berat bersih produk jadi.
          </p>
        </div>
      )}

      {/* ── Biaya ── */}
      <div className={cn(glassCard, "space-y-3")}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Biaya</h3>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Harga Pokok per Satuan (Rp) <span className="text-red-500">*</span>
          </Label>
          <Input type="number" min="0" step="0.01" placeholder="Contoh: 2000" className={cn("h-9 font-semibold", glassInput)} {...register("costPerUnit", { valueAsNumber: true })} />
          {errors.costPerUnit && <p className="text-xs text-red-500">{errors.costPerUnit.message}</p>}
        </div>
        {isEditMode && initialData.avgCostPerUnit > 0 && (
          <p className="text-xs text-emerald-700">
            Rata-rata biaya aktual: Rp {initialData.avgCostPerUnit.toLocaleString("id-ID")} / {initialData.baseUnit}
          </p>
        )}
      </div>

      {/* ── Reorder ── */}
      <div className={cn(glassCard, "space-y-4")}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Ingatkan saat stok menipis</h3>
            <p className="text-xs text-slate-500">App menghitung kapan barang perlu dibeli lagi</p>
          </div>
          <Controller control={control} name="reorderAlertEnabled" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />} />
        </div>

        {watch("reorderAlertEnabled") && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Lead Time Supplier (hari)</Label>
              <Controller
                name="leadTimeDays"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    className={cn("h-9", glassInput)}
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Safety Stock ({watch("baseUnit")})</Label>
              <Controller
                name="safetyStockQuantity"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    step={0.001}
                    className={cn("h-9", glassInput)}
                    value={field.value}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Periode Analisis (hari)</Label>
              <Controller
                name="reorderLookbackDays"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={7}
                    max={365}
                    className={cn("h-9", glassInput)}
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                  />
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Status (edit mode only) ── */}
      {isEditMode && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Status</Label>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex gap-2">
                {[{ v: true, label: "Aktif", cls: "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm" }, { v: false, label: "Nonaktif", cls: "bg-zinc-100 border-zinc-300 text-zinc-500" }].map(({ v, label, cls }) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => field.onChange(v)}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
                      field.value === v ? cls : "border-white/60 bg-white/40 text-slate-400 hover:border-white hover:bg-white/60 hover:text-slate-600",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
      )}

      <button type="submit" className="hidden" disabled={isSubmitting} />
    </form>
  );
}
