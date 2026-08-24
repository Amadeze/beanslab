"use client";

import { useState, useMemo, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Plus, Trash2, FlaskConical, Info, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProduct, updateProduct } from "../actions";
import type { ProductRow, PackagingRow } from "../actions";
import { cn } from "@/lib/utils";
import { STOREFRONT_GRIND_LABEL, STOREFRONT_GRIND_SIZES } from "@/lib/storefront-grind";

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Constants
// =============================================================================

const PRODUCT_TYPES = [
  { value: "GREEN_BEAN",     label: "Green Bean (Mentah)" },
  { value: "FINISHED_GOODS", label: "Produk Jadi" },
] as const;

const COFFEE_SPECIES = [
  { value: "ARABICA",  label: "Arabica" },
  { value: "ROBUSTA",  label: "Robusta" },
  { value: "LIBERICA", label: "Liberica" },
  { value: "EXCELSA",  label: "Excelsa" },
  { value: "HIBRIDA",  label: "Hibrida" },
  { value: "LAINNYA",  label: "Lainnya" },
] as const;

const FG_CATEGORIES = [
  { value: "ESPRESSO_BASE", label: "Espresso Base" },
  { value: "SPECIALTY",     label: "Specialty" },
  { value: "FILTER",        label: "Filter / Pour Over" },
  { value: "BLEND_HOUSE",   label: "House Blend" },
] as const;

const BLEND_TYPES = [
  { value: "SINGLE", label: "Single Origin" },
  { value: "BLEND",  label: "Blend" },
] as const;

// =============================================================================
// Schema
// =============================================================================

const recipeItemSchema = z.object({
  rbProductId:  z.string(),
  gramsPerUnit: z.number(),
  ratioPercent: z.number().optional(), // for BLEND mode
});

const schema = z.object({
  name:              z.string().min(1, "Nama wajib diisi"),
  type:              z.enum(["GREEN_BEAN", "FINISHED_GOODS"]),
  coffeeSpecies:     z.string().optional(),
  category:          z.string().optional(),
  blendType:         z.enum(["SINGLE", "BLEND"]).optional(),
  origin:            z.string().optional(),
  country:           z.string().optional(),
  farm:              z.string().optional(),
  varietal:          z.string().optional(),
  processMethod:     z.string().optional(),
  fermentationMethod: z.string().optional(),
  elevation:         z.string().optional(),
  cropYear:          z.string().optional(),
  certifications:    z.string().optional(),
  tastingNotes:      z.string().optional(),
  description:       z.string().optional(),
  imageUrl:          z.string().optional(),
  price:             z.number().optional(),
  priceSilver:       z.number().optional(),
  priceGold:         z.number().optional(),
  netWeightGrams:    z.number().min(1, "Berat bersih (gram) wajib diisi untuk kalkulasi ongkir produk jadi").optional(),
  isActive:          z.boolean(),
  recipePackagingId: z.string().optional(),
  recipeOutputGrams: z.number().optional(),
  recipeNotes:       z.string().optional(),
  recipeItems:       z.array(recipeItemSchema).optional(),
  storefrontGrindOptions: z.array(z.enum(STOREFRONT_GRIND_SIZES)).min(1),
  reorderAlertEnabled:  z.boolean(),
  leadTimeDays:         z.number().int().min(1).max(365),
  safetyStockQuantity:  z.number().min(0),
  reorderLookbackDays:  z.number().int().min(7).max(365),
}).superRefine((data, ctx) => {
  if (data.type === "FINISHED_GOODS") {
    // Required for FINISHED_GOODS
    if (!data.description || data.description.trim().length < 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Deskripsi minimal 50 karakter untuk produk jadi",
        path: ["description"],
      });
    }
    if (!data.imageUrl || !data.imageUrl.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Foto produk wajib diisi untuk produk jadi",
        path: ["imageUrl"],
      });
    }
    if (!data.origin || !data.origin.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Origin/Asal wajib diisi untuk produk jadi",
        path: ["origin"],
      });
    }
    // roastLevel is validated via recipe/coffeeIdentity
    if (data.type === "FINISHED_GOODS" && (!data.netWeightGrams || data.netWeightGrams <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Berat bersih pengiriman (gram) wajib diisi untuk produk jadi",
        path: ["netWeightGrams"],
      });
    }
  }
});

type FormValues = z.infer<typeof schema>;

// =============================================================================
// Props
// =============================================================================

interface ProductFormProps {
  id:           string;
  onSuccess:    () => void;
  onPendingChange?: (isPending: boolean) => void;
  initialData?: ProductRow;
  rawMaterials: Array<{ id: string; name: string; code: string; type?: string; latestHppPerKg?: number }>;
  packagings:   PackagingRow[];
}

// =============================================================================
// Component
// =============================================================================

export function ProductForm({ id, onSuccess, onPendingChange, initialData, rawMaterials, packagings }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const isEditMode = !!initialData;
  const existingRecipe = initialData?.recipe ?? null;
  const [showRecipe, setShowRecipe] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultRecipeItems = existingRecipe?.items.map((i) => {
    const ratioPercent = existingRecipe.outputGrams > 0 
      ? Math.round((i.gramsPerUnit / existingRecipe.outputGrams) * 100)
      : 0;
    return {
      rbProductId:  i.rbProductId,
      gramsPerUnit: i.gramsPerUnit,
      ratioPercent,
    };
  }) ?? [];
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          name:              initialData.name,
          type:              (initialData.type as FormValues["type"]) ?? "GREEN_BEAN",
          category:          initialData.category ?? "",
          origin:            initialData.origin ?? "",
          country:           initialData.coffeeSource?.country ?? "",
          farm:              initialData.coffeeSource?.farm ?? "",
          varietal:          initialData.coffeeSource?.varietal ?? "",
          processMethod:     initialData.coffeeSource?.processMethod ?? "",
          fermentationMethod: initialData.coffeeSource?.fermentationMethod ?? "",
          elevation:         initialData.coffeeSource?.elevation ?? "",
          cropYear:          initialData.coffeeSource?.cropYear ?? "",
          certifications:    initialData.coffeeSource?.certifications?.join(", ") ?? "",
          tastingNotes:      initialData.coffeeSource?.tastingNotes ?? "",
          description:       initialData.description ?? "",
          imageUrl:          initialData.imageUrl ?? "",
          price:             initialData.price ?? 0,
          priceSilver:       initialData.priceSilver ?? 0,
          priceGold:         initialData.priceGold ?? 0,
          netWeightGrams:    initialData.netWeightGrams ? Number(initialData.netWeightGrams) : 0,
          isActive:          initialData.isActive,
          recipePackagingId: existingRecipe?.packagingId ?? "",
          recipeOutputGrams: existingRecipe?.outputGrams ?? 0,
          recipeNotes:       existingRecipe?.notes ?? "",
          recipeItems:       defaultRecipeItems,
          storefrontGrindOptions: existingRecipe?.storefrontGrindOptions ?? ["WHOLE_BEAN"],
          blendType:         existingRecipe?.items.length === 1 ? "SINGLE" : "BLEND",
          reorderAlertEnabled:  initialData.reorderAlertEnabled ?? false,
          leadTimeDays:         initialData.leadTimeDays ?? 7,
          safetyStockQuantity:  initialData.safetyStockQuantity ?? 0,
          reorderLookbackDays:  initialData.reorderLookbackDays ?? 30,
        }
      : {
          name: "", type: "GREEN_BEAN", category: "", origin: "", blendType: "SINGLE",
          country: "", farm: "", varietal: "", processMethod: "", fermentationMethod: "",
          elevation: "", cropYear: "", certifications: "", tastingNotes: "",
          description: "", imageUrl: "", price: 0, priceSilver: 0, priceGold: 0, netWeightGrams: 0, isActive: true,
          recipePackagingId: "", recipeOutputGrams: 0, recipeNotes: "", recipeItems: [],
          storefrontGrindOptions: ["WHOLE_BEAN"],
          reorderAlertEnabled: false, leadTimeDays: 7, safetyStockQuantity: 0, reorderLookbackDays: 30,
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "recipeItems" });

  const selectedType     = watch("type");
  const blendType        = watch("blendType");
  const rawRecipeItems   = watch("recipeItems");
  const recipeItems      = useMemo(() => rawRecipeItems ?? [], [rawRecipeItems]);
  const recipeOutputGrams = watch("recipeOutputGrams") ?? 0;
  const currentImageUrl = watch("imageUrl");
  const totalGrams       = recipeItems.reduce((s, i) => s + (Number(i.gramsPerUnit) || 0), 0);
  const totalRatio       = recipeItems.reduce((s, i) => s + (Number(i.ratioPercent) || 0), 0);
  const isFG             = selectedType === "FINISHED_GOODS";
  const recipePackagingId = watch("recipePackagingId");
  const storefrontGrindOptions = watch("storefrontGrindOptions") ?? ["WHOLE_BEAN"];

  const estimatedHpp = useMemo(() => {
    if (!isFG) return 0;
    let cost = 0;
    for (const item of recipeItems) {
      if (!item.rbProductId || !item.gramsPerUnit) continue;
      const rm = rawMaterials.find(r => r.id === item.rbProductId);
      if (rm && rm.latestHppPerKg) {
        cost += (rm.latestHppPerKg * (Number(item.gramsPerUnit) / 1000));
      }
    }
    if (recipePackagingId) {
      const pkg = packagings.find(p => p.id === recipePackagingId);
      if (pkg) cost += Number(pkg.costPerUnit);
    }
    return cost > 0 ? Math.round(cost) : 0;
  }, [isFG, recipeItems, recipePackagingId, rawMaterials, packagings]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setValue("imageUrl", data.url);
        toast.success("Foto produk berhasil diunggah.");
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toastSafe.error("Upload gagal: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    onPendingChange?.(true);

    const hasItems = (values.recipeItems ?? []).length > 0;
    if (isFG && hasItems) {
      if (!values.recipePackagingId) {
        toast.error("Pilih kemasan untuk resep terlebih dahulu."); setIsSubmitting(false); onPendingChange?.(false); return;
      }
      if (!values.recipeOutputGrams || values.recipeOutputGrams <= 0) {
        toast.error("Isi output gram per unit untuk resep."); setIsSubmitting(false); onPendingChange?.(false); return;
      }
      const badItem = values.recipeItems!.find((i) => !i.rbProductId || (i.gramsPerUnit ?? 0) <= 0);
      if (badItem) { toast.error("Setiap bahan resep harus dipilih dan diisi gramnya."); setIsSubmitting(false); onPendingChange?.(false); return; }

      if (values.blendType === "BLEND") {
        const totalPct = values.recipeItems!.reduce((s, i) => s + (Number(i.ratioPercent) || 0), 0);
        if (Math.abs(totalPct - 100) > 0.5) {
          toast.error(`Total rasio harus 100%. Saat ini: ${totalPct.toFixed(0)}%`);
          setIsSubmitting(false); onPendingChange?.(false); return;
        }
        if (values.recipeItems!.length < 2) {
          toast.error("Blend harus minimal 2 bahan.");
          setIsSubmitting(false); onPendingChange?.(false); return;
        }
      }
      if (values.blendType === "SINGLE" && values.recipeItems!.length !== 1) {
        toast.error("Single Origin harus tepat 1 bahan.");
        setIsSubmitting(false); onPendingChange?.(false); return;
      }

      const typesInRecipe = new Set(values.recipeItems!.map(i => rawMaterials.find(rm => rm.id === i.rbProductId)?.type));
      if (typesInRecipe.has("GREEN_BEAN") && typesInRecipe.has("ROASTED_BEAN")) {
        toast.error("Resep tidak boleh mencampur Green Bean dan Roasted Bean."); setIsSubmitting(false); onPendingChange?.(false); return;
      }
    }

    const recipe = isFG && hasItems && values.recipePackagingId && values.recipeOutputGrams
      ? {
          packagingId: values.recipePackagingId,
          outputGrams: values.recipeOutputGrams,
          notes:       values.recipeNotes || undefined,
          storefrontGrindOptions: values.storefrontGrindOptions,
          items:       values.recipeItems!.map((i) => ({
            rbProductId:  i.rbProductId,
            gramsPerUnit: i.gramsPerUnit,
          })),
        }
      : undefined;

    const coffeeIdentity = selectedType === "GREEN_BEAN"
      ? {
          country: values.country || undefined,
          region:  values.origin || undefined,
          farm:    values.farm || undefined,
          species: values.coffeeSpecies || undefined,
          varietal: values.varietal || undefined,
          processMethod: values.processMethod || undefined,
          fermentationMethod: values.fermentationMethod || undefined,
          elevation: values.elevation || undefined,
          cropYear: values.cropYear || undefined,
          certifications: (values.certifications ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
          tastingNotes: values.tastingNotes || undefined,
        }
      : undefined;

    try {
      const result = isEditMode
        ? await updateProduct({
            id: initialData!.id,
            name: values.name,
            coffeeSpecies: values.coffeeSpecies || undefined,
            category: values.category || undefined,
            origin: values.origin,
            description: values.description,
            imageUrl: values.imageUrl,
            price: values.price,
            priceSilver: values.priceSilver,
            priceGold: values.priceGold,
            netWeightGrams: values.netWeightGrams,
            isActive: values.isActive,
            recipe,
            coffeeIdentity,
            reorderAlertEnabled: values.reorderAlertEnabled,
            leadTimeDays: values.leadTimeDays,
            safetyStockQuantity: values.safetyStockQuantity,
            reorderLookbackDays: values.reorderLookbackDays,
          })
        : await createProduct({
            name: values.name,
            type: values.type,
            coffeeSpecies: values.coffeeSpecies || undefined,
            category: values.category || undefined,
            origin: values.origin,
            description: values.description,
            imageUrl: values.imageUrl,
            price: values.price,
            priceSilver: values.priceSilver,
            priceGold: values.priceGold,
            netWeightGrams: values.netWeightGrams,
            recipe,
            coffeeIdentity,
            reorderAlertEnabled: values.reorderAlertEnabled,
            leadTimeDays: values.leadTimeDays,
            safetyStockQuantity: values.safetyStockQuantity,
            reorderLookbackDays: values.reorderLookbackDays,
          });

      if (!result.success) { toastSafe.error(result.error); return; }
      toast.success(isEditMode ? `Produk ${result.code} berhasil diperbarui` : `Produk ${result.code} berhasil ditambahkan`);
      onSuccess();
    } catch (err) {
      console.error("[ProductForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Nama Produk <span className="text-red-500">*</span></Label>
        <Input placeholder="Arabica Gayo, Full Arabica 250g, dll." className={cn("h-9 font-medium", glassInput)} {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 font-medium pt-0.5">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Tipe Produk <span className="text-red-500">*</span></Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(v) => v && field.onChange(v)} disabled={isEditMode}>
              <SelectTrigger className={cn("h-9 w-full text-sm", glassInput)}>
                <SelectValue placeholder="Pilih tipe...">
                  {field.value ? PRODUCT_TYPES.find((t) => t.value === field.value)?.label : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {isEditMode && (
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1 pt-0.5">
            <Info size={12} className="opacity-70" /> Tipe tidak dapat diubah setelah produk dibuat.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Jenis Kopi</Label>
          <Controller
            control={control}
            name="coffeeSpecies"
            render={({ field }) => (
              <Select value={field.value || ""} onValueChange={(v) => field.onChange(v || null)}>
                <SelectTrigger className={cn("h-9 w-full text-sm", glassInput)}>
                  <SelectValue placeholder="Pilih jenis kopi...">
                    {field.value ? COFFEE_SPECIES.find((s) => s.value === field.value)?.label : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COFFEE_SPECIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            {isFG ? "Kategori" : "Kategori"}
          </Label>
          {isFG ? (
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value || ""} onValueChange={(v) => field.onChange(v || null)}>
                  <SelectTrigger className={cn("h-9 w-full text-sm", glassInput)}>
                    <SelectValue placeholder="Pilih kategori...">
                      {field.value ? FG_CATEGORIES.find((c) => c.value === field.value)?.label : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FG_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <Input list="category-list" placeholder="Espresso Base, Specialty, dll." className={cn("h-9", glassInput)} {...register("category")} />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Origin / Asal</Label>
          <Input placeholder="Gayo, Toraja, Ethiopia, dll." className={cn("h-9", glassInput)} {...register("origin")} />
        </div>
      </div>

      {selectedType === "GREEN_BEAN" && (
        <div className={cn(glassCard, "space-y-4")}>
          <div>
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Identitas Kopi (CoffeeSource)</Label>
            <p className="mt-1 text-xs text-slate-500">
              Akar identitas kopi ini. Metode proses yang berbeda (mis. washed vs anaerobic natural)
              adalah identitas yang berbeda, walau dari region yang sama.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Negara</Label>
              <Input placeholder="Indonesia" className={cn("h-9", glassInput)} {...register("country")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Farm / Produser / Koperasi</Label>
              <Input placeholder="Koperasi Atu Lintang, dll." className={cn("h-9", glassInput)} {...register("farm")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Varietas</Label>
              <Input placeholder="Gayo 1, Ateng Super, dll." className={cn("h-9", glassInput)} {...register("varietal")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Metode Proses</Label>
              <Input list="process-method-list" placeholder="Washed / Natural / Honey / Anaerobic, dll." className={cn("h-9", glassInput)} {...register("processMethod")} />
              <datalist id="process-method-list">
                {["Natural", "Washed / Full Washed", "Honey", "Wet Hulled", "Anaerobic Natural", "Anaerobic Washed", "Carbonic Maceration"].map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Metode Fermentasi</Label>
              <Input placeholder="Opsional" className={cn("h-9", glassInput)} {...register("fermentationMethod")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Ketinggian</Label>
              <Input placeholder="1100–1600 mdpl" className={cn("h-9", glassInput)} {...register("elevation")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Tahun Panen</Label>
              <Input placeholder="2025" className={cn("h-9", glassInput)} {...register("cropYear")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Sertifikasi</Label>
              <Input placeholder="Fair Trade, Organic (pisahkan dengan koma)" className={cn("h-9", glassInput)} {...register("certifications")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Catatan Cita Rasa</Label>
            <Input placeholder="Flavor profile, body, acidity..." className={cn("h-9", glassInput)} {...register("tastingNotes")} />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Deskripsi (opsional)</Label>
        <Input placeholder="Tasting notes, karakteristik, dll." className={cn("h-9", glassInput)} {...register("description")} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Foto Produk</Label>
        <div className="flex items-center gap-4">
          {currentImageUrl && (
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
              <img src={currentImageUrl} alt="Product" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white transition-colors disabled:opacity-50 shadow-sm"
            >
              {isUploading ? "Mengupload..." : "Upload Foto"}
            </button>
            <p className="text-xs text-slate-500 mt-1">Format: JPG/PNG. Maksimal 2MB.</p>
          </div>
        </div>
      </div>

      {isFG && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Tipe Kopi</Label>
          <Controller
            control={control}
            name="blendType"
            render={({ field }) => (
              <div className="flex gap-2">
                {BLEND_TYPES.map((bt) => (
                  <button
                    key={bt.value}
                    type="button"
                    onClick={() => {
                      field.onChange(bt.value);
                      if (bt.value === "SINGLE" && recipeItems.length > 1) {
                        for (let i = recipeItems.length - 1; i > 0; i--) remove(i);
                      }
                    }}
                    className={cn(
                      "flex-1 rounded-xl border-2 py-2.5 text-xs font-bold transition-all",
                      field.value === bt.value
                        ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    )}
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
      )}

      {isFG && (
        <div className={cn(glassCard, "space-y-3")}>
          <div>
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Pilihan gilingan di storefront</Label>
            <p className="mt-1 text-xs text-slate-400">Kemasan tetap menjadi SKU stok. Gilingan dicatat sebagai instruksi per pesanan.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {STOREFRONT_GRIND_SIZES.map((grindSize) => {
              const selected = storefrontGrindOptions.includes(grindSize);
              return (
                <button
                  key={grindSize}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? storefrontGrindOptions.filter((value) => value !== grindSize)
                      : [...storefrontGrindOptions, grindSize];
                    if (next.length > 0) setValue("storefrontGrindOptions", next, { shouldDirty: true });
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
                    selected
                      ? "border-violet-400 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white/60 text-slate-500 hover:border-slate-300",
                  )}
                >
                  {STOREFRONT_GRIND_LABEL[grindSize]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isFG && (
        <div className={cn(glassCard, "space-y-4")}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Jual & Spesifikasi</h3>
            {estimatedHpp > 0 && (
              <span className="text-xs font-bold text-amber-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Estimasi Resep: Rp {estimatedHpp.toLocaleString("id-ID")}
              </span>
            )}
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Retail (Eceran)</Label>
            <Input type="number" placeholder="0" className={cn("h-9 font-semibold", glassInput)} {...register("price", { valueAsNumber: true })} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Grosir Silver</Label>
              <Input type="number" placeholder="0" className={cn("h-9", glassInput)} {...register("priceSilver", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Grosir Gold</Label>
              <Input type="number" placeholder="0" className={cn("h-9", glassInput)} {...register("priceGold", { valueAsNumber: true })} />
            </div>
          </div>
          
          <div className="pt-2">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Berat Pengiriman (Gram)</Label>
            <p className="mt-1 mb-2 text-xs text-slate-400">Berat bersih yang akan diteruskan ke kurir logistik (RajaOngkir).</p>
            <Input type="number" placeholder="Contoh: 250" className={cn("h-9 font-semibold", glassInput)} {...register("netWeightGrams", { valueAsNumber: true })} />
            {errors.netWeightGrams && <p className="text-xs text-red-500 mt-1">{errors.netWeightGrams.message}</p>}
          </div>
        </div>
      )}

      {/* ── Status (edit mode only) ── */}
      {isEditMode && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Status</Label>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex gap-2">
                {[{ v: true, label: "Aktif", cls: "border-emerald-600 bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600/20 ring-offset-1" }, { v: false, label: "Nonaktif", cls: "border-slate-700 bg-slate-700 text-white shadow-md ring-2 ring-slate-700/20 ring-offset-1" }].map(({ v, label, cls }) => (
                  <button key={String(v)} type="button" onClick={() => field.onChange(v)}
                    className={cn("flex-1 rounded-xl border py-2 text-xs font-bold transition-all shadow-sm",
                      field.value === v ? cls : "border-white/60 bg-white/40 text-slate-500 hover:bg-white/60")}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
      )}

      {/* ================================================================
          RECIPE SECTION — hanya untuk FINISHED_GOODS
          ================================================================ */}
      {isFG && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowRecipe((value) => !value)}
            className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2.5 text-left text-xs font-semibold text-violet-800 transition hover:bg-violet-50"
            aria-expanded={showRecipe}
          >
            <span className="flex items-center gap-2"><FlaskConical size={15} /> Resep produksi <span className="font-normal text-violet-500">(opsional)</span></span>
            <ChevronDown size={15} className={cn("transition-transform", showRecipe && "rotate-180")} />
          </button>
          {showRecipe && (
          <div className={cn(glassCard, "space-y-5")}>
          {/* Section header */}
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-violet-500 drop-shadow-sm" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Resep Produksi</h3>
            <span className="rounded-full bg-white/50 border border-white/60 px-2.5 py-0.5 text-xs font-bold tracking-wide text-slate-500 shadow-sm">opsional</span>
          </div>

          {/* Packaging + Output grams — 2 col */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Kemasan Default</Label>
              <Controller
                control={control}
                name="recipePackagingId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || "")}>
                    <SelectTrigger className={cn("h-9 w-full text-sm", glassInput)}>
                      <SelectValue placeholder="Pilih kemasan...">
                        {field.value ? packagings.find((pkg) => pkg.id === field.value)?.name : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {packagings.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Output (gram / unit)</Label>
              <Input
                type="number" min="1" step="1" placeholder="250"
                className={cn("h-9 font-semibold tabular-nums", glassInput)}
                {...register("recipeOutputGrams", { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Recipe items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                {blendType === "SINGLE" ? "Bahan Baku (100% Roasted Bean)" : "Komposisi Blend (Rasio %)"}
              </Label>
              {fields.length > 0 && recipeOutputGrams > 0 && blendType === "SINGLE" && (
                <span className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full border ${Math.abs(totalGrams - recipeOutputGrams) < 0.01 ? "bg-emerald-50/50 border-emerald-200 text-emerald-700" : "bg-amber-50/50 border-amber-200 text-amber-700"}`}>
                  Total: {totalGrams}g / {recipeOutputGrams}g
                </span>
              )}
              {fields.length > 0 && blendType === "BLEND" && (
                <span className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full border ${Math.abs(totalRatio - 100) < 0.01 ? "bg-emerald-50/50 border-emerald-200 text-emerald-700" : "bg-amber-50/50 border-amber-200 text-amber-700"}`}>
                  Total: {totalRatio.toFixed(0)}% / 100%
                </span>
              )}
            </div>

            {fields.length === 0 && (
              <p className="text-xs text-slate-400 font-medium py-2">
                {blendType === "SINGLE" ? "Pilih satu Roasted Bean sebagai bahan baku." : "Klik \"+ Tambah Bahan\" untuk menambahkan komposisi blend."}
              </p>
            )}

            <div className="space-y-2 relative">
              {fields.map((field, index) => (
                <div key={field.id} className="relative flex flex-wrap sm:flex-nowrap items-start gap-4 rounded-xl border border-white/60 bg-white/40 backdrop-blur-md p-4 shadow-sm hover:shadow transition-all group">
                  
                  {/* Remove (absolute hover) */}
                  {blendType === "BLEND" && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="absolute -top-3 -right-2 bg-white text-red-500 border border-white/60 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 shadow-sm z-10"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  
                  {/* RB selector */}
                  <div className="flex-1 min-w-[150px] space-y-1">
                    <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Bahan Baku</Label>
                    <Controller
                      control={control}
                      name={`recipeItems.${index}.rbProductId`}
                      render={({ field: f }) => (
                        <Select value={f.value ?? ""} onValueChange={(v) => f.onChange(v || "")}>
                          <SelectTrigger className={cn("h-9 w-full text-xs font-medium", glassInput)}>
                            <SelectValue placeholder="Pilih Bahan Baku...">
                              {f.value ? rawMaterials.find((rm) => rm.id === f.value)?.name : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {rawMaterials.filter((rm) => rm.type === "ROASTED_BEAN").map((rm) => {
                              const isSelected = recipeItems.some((item, i) => i !== index && item.rbProductId === rm.id);
                              return (
                                <SelectItem key={rm.id} value={rm.id} disabled={isSelected}>
                                  {rm.name} (RB)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {blendType === "SINGLE" ? (
                    /* SINGLE mode — Grams input */
                    <div className="w-36 shrink-0 space-y-1">
                      <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Gramasi</Label>
                      <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            type="number" min="0.1" step="0.1" placeholder="0"
                            className={cn("h-9 text-right tabular-nums text-sm font-semibold pr-6", glassInput)}
                            {...register(`recipeItems.${index}.gramsPerUnit`, { valueAsNumber: true })}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">g</span>
                        </div>
                        {recipeOutputGrams > 0 && (
                          <span className="w-10 shrink-0 text-right text-[11px] font-bold text-slate-400 tabular-nums">
                            {`${((Number(recipeItems[index]?.gramsPerUnit) || 0) / recipeOutputGrams * 100).toFixed(0)}%`}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* BLEND mode — Ratio % input */
                    <div className="w-36 shrink-0 space-y-1">
                      <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Rasio</Label>
                      <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                          <Controller
                            control={control}
                            name={`recipeItems.${index}.ratioPercent`}
                            render={({ field: f }) => (
                              <Input
                                type="number" min="1" max="100" step="1" placeholder="0"
                                className={cn("h-9 text-right tabular-nums text-sm font-semibold pr-6", glassInput)}
                                value={f.value ?? ""}
                                onChange={(e) => {
                                  const pct = Number(e.target.value) || 0;
                                  f.onChange(pct);
                                  // Auto-calculate grams from ratio
                                  if (recipeOutputGrams > 0) {
                                    setValue(`recipeItems.${index}.gramsPerUnit`, Math.round(recipeOutputGrams * pct / 100 * 10) / 10);
                                  }
                                }}
                              />
                            )}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                        </div>
                        {recipeOutputGrams > 0 && (
                          <span className="w-14 shrink-0 text-right text-[11px] font-bold text-slate-500 tabular-nums">
                            ≈{Math.round(recipeOutputGrams * (Number(recipeItems[index]?.ratioPercent) || 0) / 100)}g
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(blendType === "BLEND" || (blendType === "SINGLE" && fields.length === 0)) && (
              <button
                type="button"
                onClick={() => append({ rbProductId: "", gramsPerUnit: blendType === "SINGLE" ? (Number(watch("recipeOutputGrams")) || 0) : 0, ratioPercent: blendType === "SINGLE" ? 100 : 0 })}
                className="flex w-fit items-center gap-1 rounded-lg border border-white/60 bg-white/30 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white/50 transition-colors shadow-sm"
              >
                <Plus size={14} /> Tambah Bahan
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Catatan Resep (opsional)</Label>
            <Input placeholder="Instruksi, variasi, dll." className={cn("h-9", glassInput)} {...register("recipeNotes")} />
          </div>
          </div>
          )}
        </div>
      )}

      {/* ——— Reorder Configuration ——— */}
      <div className={cn(glassCard, "space-y-4")}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Ingatkan saat stok menipis</h3>
            <p className="text-xs text-slate-500">App menghitung kapan produk perlu dibeli lagi</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <Controller
              name="reorderAlertEnabled"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-700"></div>
          </label>
        </div>

        <p className="text-xs text-slate-500 italic">
          Perhitungan memakai riwayat pemakaian, waktu tunggu supplier, dan stok cadangan.
        </p>

        {watch("reorderAlertEnabled") && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Lead Time Supplier (hari)
              </Label>
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
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Safety Stock {selectedType === "FINISHED_GOODS" ? "(pcs)" : "(kg)"}
              </Label>
              <Controller
                name="safetyStockQuantity"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    className={cn("h-9", glassInput)}
                    value={field.value}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Periode Analisis (hari)
              </Label>
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

      <button type="submit" className="hidden" disabled={isSubmitting} />
    </form>
  );
}
