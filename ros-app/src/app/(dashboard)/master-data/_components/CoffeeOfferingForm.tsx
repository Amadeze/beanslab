"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { createOffering, updateOffering } from "../actions";
import type { OfferingRow, ProductRow, SupplyItemRow } from "../actions";
import { cn } from "@/lib/utils";

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";

const GRIND_OPTIONS = [
  { value: "WHOLE_BEAN", label: "Biji utuh" },
  { value: "COARSE", label: "Kasar / cold brew" },
  { value: "MEDIUM_COARSE", label: "Sedang-kasar / V60" },
  { value: "MEDIUM", label: "Sedang / filter" },
  { value: "MEDIUM_FINE", label: "Sedang-halus / AeroPress" },
  { value: "FINE", label: "Halus" },
  { value: "ESPRESSO", label: "Espresso" },
  { value: "CUSTOM", label: "Ukuran custom" },
] as const;

const ROAST_LEVELS = [
  { value: "LIGHT", label: "Light" },
  { value: "MEDIUM", label: "Medium" },
  { value: "MEDIUM_DARK", label: "Medium Dark" },
  { value: "DARK", label: "Dark" },
] as const;

const variantSchema = z.object({
  packageName: z.string().trim().min(1, "Nama kemasan wajib diisi").max(80),
  netWeightGrams: z.number().finite().min(1, "Berat bersih minimal 1 gram").max(1_000_000),
  unitPrice: z.number().finite().min(0, "Harga tidak boleh negatif").max(1_000_000_000),
  supplyItemId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

const schema = z.object({
  name: z.string().trim().min(2, "Nama penawaran minimal 2 karakter").max(120),
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  roastLevel: z.enum(["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"]).nullable().optional(),
  sourceMode: z.enum(["PURCHASED_ROASTED", "INTERNAL_ROAST"]),
  coffeeSourceId: z.string().min(1, "Pilih sumber kopi"),
  lineageProductId: z.string().min(1, "Pilih material kopi siap jual"),
  grindOptions: z.array(z.enum(["WHOLE_BEAN", "COARSE", "MEDIUM_COARSE", "MEDIUM", "MEDIUM_FINE", "FINE", "ESPRESSO", "CUSTOM"])).min(1, "Pilih minimal satu opsi gilingan"),
  allowCustomGrind: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  variants: z.array(variantSchema).min(1, "Minimal satu varian kemasan"),
});

type FormValues = z.input<typeof schema>;

interface CoffeeOfferingFormProps {
  id: string;
  onSuccess: () => void;
  onPendingChange?: (isPending: boolean) => void;
  initialData?: OfferingRow;
  roastedMaterials: ProductRow[];
  supplyItems: SupplyItemRow[];
}

export function CoffeeOfferingForm({ id, onSuccess, onPendingChange, initialData, roastedMaterials, supplyItems }: CoffeeOfferingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!initialData;
  const packagingItems = supplyItems.filter((item) => item.category === "PACKAGING" && item.isActive);
  const validMaterials = roastedMaterials.filter((material) => (
    material.type === "ROASTED_BEAN"
    && material.isActive
    && material.coffeeSource
    && (
      material.materialOrigin === "PURCHASED_ROASTED"
      || (material.materialOrigin === "INTERNAL_ROAST" && material.sourceGreenBeanId)
    )
  ));
  const initialMaterial = validMaterials.find((material) => material.id === initialData?.lineageProductId)
    ?? validMaterials.find((material) => (
      material.coffeeSource?.id === initialData?.coffeeSourceId
      && material.materialOrigin === initialData?.sourceMode
      && (material.roastLevel ?? null) === (initialData?.roastLevel ?? null)
    ))
    ?? validMaterials[0];
  const coffeeSources = Array.from(
    new Map(validMaterials.flatMap((material) => material.coffeeSource ? [[material.coffeeSource.id, material.coffeeSource]] : [])).values(),
  );

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description,
          imageUrl: initialData.imageUrl,
          roastLevel: (initialData.roastLevel as FormValues["roastLevel"]) ?? null,
          sourceMode: initialData.sourceMode,
          coffeeSourceId: initialData.coffeeSourceId,
          lineageProductId: initialMaterial?.id ?? "",
          grindOptions: initialData.grindOptions as FormValues["grindOptions"],
          allowCustomGrind: initialData.allowCustomGrind,
          isActive: initialData.isActive,
          sortOrder: initialData.sortOrder,
          variants: initialData.variants.map((v) => ({
            packageName: v.packageName,
            netWeightGrams: v.netWeightGrams,
            unitPrice: v.unitPrice,
            supplyItemId: v.supplyItemId,
            isActive: v.isActive,
          })),
        }
      : {
          name: "",
          description: "",
          imageUrl: "",
          roastLevel: "MEDIUM",
          sourceMode: initialMaterial?.materialOrigin ?? "PURCHASED_ROASTED",
          coffeeSourceId: initialMaterial?.coffeeSource?.id ?? "",
          lineageProductId: initialMaterial?.id ?? "",
          grindOptions: ["WHOLE_BEAN"],
          allowCustomGrind: true,
          isActive: true,
          sortOrder: 0,
          variants: [{ packageName: "", netWeightGrams: 250, unitPrice: 0, supplyItemId: null, isActive: true }],
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });
  const grindOptions = watch("grindOptions");
  const lineageProductId = watch("lineageProductId");
  const sourceMode = watch("sourceMode");
  const selectedMaterial = validMaterials.find((material) => material.id === lineageProductId) ?? null;

  const chooseMaterial = (materialId: string) => {
    const material = validMaterials.find((item) => item.id === materialId);
    setValue("lineageProductId", materialId, { shouldDirty: true, shouldValidate: true });
    if (!material?.coffeeSource || !material.materialOrigin) return;
    setValue("coffeeSourceId", material.coffeeSource.id, { shouldDirty: true, shouldValidate: true });
    setValue("sourceMode", material.materialOrigin, { shouldDirty: true, shouldValidate: true });
    setValue("roastLevel", (material.roastLevel as FormValues["roastLevel"]) ?? null, { shouldDirty: true });
  };

  const toggleGrind = (value: string) => {
    const current = grindOptions ?? [];
    const next = current.includes(value as never)
      ? current.filter((v) => v !== value)
      : [...current, value as never];
    setValue("grindOptions", next as never, { shouldValidate: true });
  };

  const onSubmit = async (raw: FormValues) => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      toastSafe.error(parsed.error.issues[0]?.message ?? "Data penawaran tidak valid.");
      return;
    }
    const values = parsed.data;
    setIsSubmitting(true);
    onPendingChange?.(true);
    try {
      const result = isEditMode
        ? await updateOffering({ id: initialData!.id, ...values })
        : await createOffering(values);
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success(isEditMode ? `${result.code} berhasil diperbarui` : `Penawaran ${result.code} berhasil ditambahkan`);
      onSuccess();
    } catch (err) {
      console.error("[CoffeeOfferingForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
        Pilih kopi siap jual, lalu tentukan ukuran dan harga. Sistem memakai material itu untuk stok; pembeli hanya melihat kopi, kemasan, dan gilingan.
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Nama Penawaran <span className="text-red-500">*</span>
        </Label>
        <Input placeholder="Contoh: Gayo Wine Process — Premium" className={cn("h-9", glassInput)} {...register("name")} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-600">Kopi siap jual *</Label>
        <select
          value={lineageProductId}
          onChange={(event) => chooseMaterial(event.target.value)}
          className={cn("h-10 w-full rounded-md border bg-white px-3 text-sm", glassInput)}
          disabled={validMaterials.length === 0}
        >
          {validMaterials.length === 0 ? <option value="">Belum ada roasted bean yang valid</option> : null}
          {validMaterials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name} · {material.roastLevel?.replaceAll("_", " ") || "tanpa roast"} · {material.materialOrigin === "INTERNAL_ROAST" ? "sangrai sendiri" : "beli jadi"}
            </option>
          ))}
        </select>
        {errors.lineageProductId ? <p className="text-xs text-red-500">{errors.lineageProductId.message}</p> : null}
        {selectedMaterial ? (
          <p className="text-xs leading-5 text-slate-600">
            Identitas: <strong>{selectedMaterial.coffeeSource?.name}</strong> · roast <strong>{selectedMaterial.roastLevel?.replaceAll("_", " ") || "—"}</strong>. Stok akan ditahan dari material ini.
          </p>
        ) : (
          <p className="text-xs leading-5 text-amber-800">Terima atau sangrai kopi terlebih dahulu, lalu kembali untuk membuat penawaran.</p>
        )}
      </div>

      <div className="hidden">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Sumber Kopi *</Label>
          <select className={cn("h-9 w-full rounded-md border bg-white/60 px-3 text-sm", glassInput)} {...register("coffeeSourceId")}>
            {coffeeSources.map((source) => (
              <option key={source.id} value={source.id}>{source.name} · {source.code}</option>
            ))}
          </select>
          {errors.coffeeSourceId && <p className="text-xs text-red-500">{errors.coffeeSourceId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Asal Bahan</Label>
          <Controller
            control={control}
            name="sourceMode"
            render={({ field }) => (
              <div className="flex gap-2">
                {[
                  { v: "PURCHASED_ROASTED" as const, label: "Beli jadi (RB)" },
                  { v: "INTERNAL_ROAST" as const, label: "Sangrai sendiri" },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => field.onChange(v)}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
                      field.value === v
                        ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                        : "border-white/60 bg-white/40 text-slate-400 hover:border-white hover:bg-white/60 hover:text-slate-600",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          />
          <p className="text-[11px] text-slate-400">
            {sourceMode === "PURCHASED_ROASTED"
              ? "Stok ditahan dari produk roasted bean (beli jadi) sumber ini."
              : "Stok ditahan dari produk roasted bean yang sudah ada; kalau belum ada, pesanan ditolak hingga stok tersedia."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white/40 p-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Roast Level</Label>
          <select disabled className={cn("h-9 w-full rounded-md border bg-white/60 px-3 text-sm", glassInput)} {...register("roastLevel")}>
            <option value="">—</option>
            {ROAST_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Urutan Tampil</Label>
          <Input type="number" min="0" max="9999" className={cn("h-9", glassInput)} {...register("sortOrder", { valueAsNumber: true })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Deskripsi</Label>
        <textarea rows={2} placeholder="Cerita singkat tentang profil rasa, proses, dan karakter kopi ini." className={cn("w-full rounded-md border bg-white/40 px-3 py-2 text-sm", glassInput)} {...register("description")} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">URL Gambar</Label>
        <Input placeholder="https://…" className={cn("h-9", glassInput)} {...register("imageUrl")} />
      </div>

      <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white/40 p-3">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Opsi Gilingan *</Label>
        <div className="flex flex-wrap gap-2">
          {GRIND_OPTIONS.map((option) => {
            const active = (grindOptions ?? []).includes(option.value as never);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleGrind(option.value)}
                className={[
                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all",
                  active
                    ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                    : "border-white/60 bg-white/40 text-slate-400 hover:border-white hover:bg-white/60 hover:text-slate-600",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {errors.grindOptions && <p className="text-xs text-red-500">{errors.grindOptions.message}</p>}
        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer">
          <input type="checkbox" className="rounded text-amber-600" {...register("allowCustomGrind")} />
          Izinkan gilingan custom (pembeli menuliskan catatan sendiri)
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white/40 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Varian Kemasan *</Label>
          <button
            type="button"
            onClick={() => append({ packageName: "", netWeightGrams: 250, unitPrice: 0, supplyItemId: null, isActive: true })}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <Plus size={11} strokeWidth={3} /> Varian
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white/60 p-2 sm:grid-cols-12">
            <div className="sm:col-span-3">
              <Input placeholder="Nama kemasan (mis. Zipper 250g)" className="h-8 text-xs" {...register(`variants.${index}.packageName`)} />
              {errors.variants?.[index]?.packageName && <p className="text-[11px] text-red-500">{errors.variants[index]!.packageName!.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <Input type="number" min="1" placeholder="Berat (g)" className="h-8 text-xs" {...register(`variants.${index}.netWeightGrams`, { valueAsNumber: true })} />
            </div>
            <div className="sm:col-span-3">
              <Input type="number" min="0" placeholder="Harga jual (Rp)" className="h-8 text-xs" {...register(`variants.${index}.unitPrice`, { valueAsNumber: true })} />
            </div>
            <div className="sm:col-span-3">
              <select className="h-8 w-full rounded-md border bg-white/60 px-2 text-xs" {...register(`variants.${index}.supplyItemId`)}>
                <option value="">Tanpa bahan kemasan</option>
                {packagingItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-1">
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 cursor-pointer">
                <input type="checkbox" className="rounded text-amber-600" {...register(`variants.${index}.isActive`)} /> Jual
              </label>
              <button type="button" onClick={() => remove(index)} aria-label="Hapus varian" className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {errors.variants && !Array.isArray(errors.variants) && <p className="text-xs text-red-500">{errors.variants.message}</p>}
      </div>

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
