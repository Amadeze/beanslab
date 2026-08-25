"use client";

import { useForm, useFieldArray, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { AlertTriangle, Calculator, ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatKg, formatRupiah, formatUnit } from "@/lib/format";
import {
  createProductionBatch,
  type FGProductOption,
  type RBStockOption,
  type PackagingOption,
  type SupplyConsumptionOption,
} from "../actions";
import { InventoryDestinationField } from "@/components/inventory/InventoryDestinationField";
import type { InventoryLocationOption } from "@/lib/storage-location";
import {
  calculatePackagingSuggestion,
  isPackagingOverCapacity,
} from "@/lib/production-packaging";

// =============================================================================
// Zod schema
// =============================================================================

const rbComponentSchema = z.object({
  productId:   z.string().min(1, "Pilih RB"),
  productName: z.string(),
  actualGrams: z.number().positive("> 0").optional(), // kept for compatibility if needed
  gramsPerUnit: z.number().positive("> 0"),
});

const supplyComponentSchema = z.object({
  supplyItemId:   z.string().min(1, "Pilih item non-kopi"),
  supplyItemName: z.string(),
  quantityPerUnit: z.number().positive("> 0"),
});

const schema = z.object({
  outputProductId: z.string().min(1, "Wajib pilih produk"),
  recipeId:        z.string().optional(),
  packagingId:     z.string().min(1, "Wajib pilih kemasan"),
  unitsProduced:   z.number().int().positive("Minimal 1 unit"),
  rbComponents:    z.array(rbComponentSchema).min(1, "Minimal 1 komponen RB"),
  supplyComponents: z.array(supplyComponentSchema).optional(),
  laborCost:       z.coerce.number().min(0).optional(),
  overheadAllocated: z.coerce.number().min(0).optional(),
  destinationLocationId: z.string().optional(),
  notes:           z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const glassInput = "bg-card/40 border-white/60 backdrop-blur-md transition-all focus:bg-card/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-card/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Field helpers
// =============================================================================

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-[var(--status-danger)]">{message}</p>;
}

// =============================================================================
// HPP preview (bottom summary)
// =============================================================================

function HppSummary({
  rbComponents,
  rbOptions,
  packagingOptions,
  supplyOptions,
  supplyComponents,
  packagingId,
  unitsProduced,
  laborCost,
  overheadAllocated,
}: {
  rbComponents: Array<{ productId: string; actualGrams?: number; gramsPerUnit: number }>;
  rbOptions: RBStockOption[];
  packagingOptions: PackagingOption[];
  supplyOptions: SupplyConsumptionOption[];
  initialOutputProductId?: string;
  initialUnitsProduced?: number;
  supplyComponents?: Array<{ supplyItemId: string; quantityPerUnit: number }>;
  packagingId: string;
  unitsProduced: number;
  laborCost: number;
  overheadAllocated: number;
}) {
  if (unitsProduced < 1) return null;

  const rbPerUnit = rbComponents.reduce((s, c) => s + (Number(c.gramsPerUnit) || 0), 0);
  const totalRbGrams = rbPerUnit * unitsProduced;
  const pkg = packagingOptions.find((p) => p.id === packagingId);

  const supplyCostPerUnit = (supplyComponents ?? []).reduce((sum, comp) => {
    const item = supplyOptions.find((o) => o.id === comp.supplyItemId);
    return sum + (item ? item.costPerUnit * (Number(comp.quantityPerUnit) || 0) : 0);
  }, 0);

  const { rbCostPerUnit, hasMissingCost } = rbComponents.reduce((summary, comp) => {
    const rb = rbOptions.find((r) => r.id === comp.productId);
    if (!rb) return summary;

    return {
      rbCostPerUnit:
        summary.rbCostPerUnit +
        ((Number(comp.gramsPerUnit) || 0) / 1000) * (rb.avgCostPerKg || 0),
      hasMissingCost: summary.hasMissingCost || !rb.avgCostPerKg,
    };
  }, { rbCostPerUnit: 0, hasMissingCost: false });

  const directCostPerUnit = ((laborCost || 0) + (overheadAllocated || 0)) / unitsProduced;
  const estimatedHpp = rbCostPerUnit + (pkg?.costPerUnit || 0) + supplyCostPerUnit + directCostPerUnit;
  const isOverCapacity = isPackagingOverCapacity(rbPerUnit, pkg?.capacityGrams ?? null);

  return (
    <div className={cn(glassCard, "p-4 space-y-3 mt-4")}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
        Ringkasan Produksi
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-medium">
        <span className="text-ink">Unit diproduksi</span>
        <span className="font-semibold text-ink text-right">{formatUnit(unitsProduced)}</span>
        <span className="text-ink">Total RB digunakan</span>
        <span className="font-semibold text-ink text-right">{formatKg(totalRbGrams / 1000)}</span>
        <span className="text-ink">Rata-rata RB/unit</span>
        <span className={cn("font-semibold text-right", isOverCapacity ? "text-[var(--status-warning)]" : "text-ink")}>
          {unitsProduced > 0
            ? `${(totalRbGrams / unitsProduced).toFixed(1)} g`
            : "—"}
        </span>
        {pkg && (
          <>
            <span className="text-ink">Kemasan digunakan</span>
            <span className="font-semibold text-ink text-right text-xs mt-0.5">
              1 unit {pkg.name} / unit FG
            </span>
          </>
        )}
        {supplyCostPerUnit > 0 && (
          <>
            <span className="text-ink">Komponen non-kopi lain</span>
            <span className="font-semibold text-ink text-right text-xs mt-0.5">
              {formatRupiah(supplyCostPerUnit)}/unit
            </span>
          </>
        )}
        {(laborCost || 0) > 0 && (
          <><span className="text-ink">Biaya Tenaga Kerja</span>
            <span className="font-semibold text-ink text-right">{formatRupiah(laborCost)}</span>
            <span className="text-[10px] text-ink-secondary text-right -mt-1">per batch ({formatRupiah((laborCost || 0) / unitsProduced)}/unit)</span>
            <span></span>
          </>
        )}
        {(overheadAllocated || 0) > 0 && (
          <><span className="text-ink">Alokasi Overhead</span>
            <span className="font-semibold text-ink text-right">{formatRupiah(overheadAllocated)}</span>
            <span className="text-[10px] text-ink-secondary text-right -mt-1">per batch ({formatRupiah((overheadAllocated || 0) / unitsProduced)}/unit)</span>
            <span></span>
          </>
        )}
        <span className="text-ink mt-1 pt-2 border-t border-border/50">Estimasi HPP/unit</span>
        <span className="font-semibold text-ink text-right mt-1 pt-2 border-t border-border/50">
          {hasMissingCost ? (
            <span className="text-[var(--status-warning)] text-xs flex flex-col items-end">
              <span>{formatRupiah(estimatedHpp)}</span>
              <span className="text-[10px] font-normal mt-0.5">⚠ data harga RB tidak lengkap</span>
            </span>
          ) : (
            formatRupiah(estimatedHpp)
          )}
        </span>
      </div>
      {isOverCapacity && pkg?.capacityGrams && (
        <div className="mt-2 flex gap-2 rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 p-2 text-xs text-[var(--status-warning)]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Isi kopi {rbPerUnit.toFixed(1)} g melebihi kapasitas nominal kemasan {pkg.capacityGrams.toFixed(0)} g.
            Pilih kemasan lebih besar atau kurangi gramasi.
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Props
// =============================================================================

interface ProductionFormProps {
  id: string;
  fgOptions: FGProductOption[];
  rbOptions: RBStockOption[];
  packagingOptions: PackagingOption[];
  supplyOptions: SupplyConsumptionOption[];
  locationOptions: InventoryLocationOption[];
  initialOutputProductId?: string;
  initialUnitsProduced?: number;
  /** Batch roasting sumber (dari aksi di rekap roasting). Opsional. */
  parentRoastBatchId?: string;
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ProductionForm({
  id,
  fgOptions,
  rbOptions,
  packagingOptions,
  supplyOptions,
  locationOptions,
  initialOutputProductId = "",
  initialUnitsProduced = 1,
  parentRoastBatchId,
  onSuccess,
  onPendingChange,
}: ProductionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [showRecipeDetails, setShowRecipeDetails] = useState(false);
  const [targetRbKg, setTargetRbKg] = useState("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      outputProductId: initialOutputProductId,
      recipeId:        "",
      packagingId:     "",
      unitsProduced:   initialUnitsProduced,
      rbComponents:    [{ productId: "", productName: "", gramsPerUnit: 0 }],
      supplyComponents: [],
      destinationLocationId: locationOptions[0]?.id ?? "",
      notes:           "",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "rbComponents",
  });

  const {
    fields: supplyFields,
    append: appendSupply,
    remove: removeSupply,
    replace: replaceSupply,
  } = useFieldArray({
    control,
    name: "supplyComponents",
  });

  const [outputProductId, unitsProduced, packagingId, rbComponents, supplyComponents, laborCost, overheadAllocated, destinationLocationId] = watch([
    "outputProductId",
    "unitsProduced",
    "packagingId",
    "rbComponents",
    "supplyComponents",
    "laborCost",
    "overheadAllocated",
    "destinationLocationId",
  ]);

  // ── Auto-fill dari resep saat user pilih FG ──
  useEffect(() => {
    if (!outputProductId) return;
    setShowRecipeDetails(false);

    const fg = fgOptions.find((f) => f.id === outputProductId);
    if (!fg?.recipe) return;

    const recipe = fg.recipe;

    // Set packaging default dari resep (canonical supply item bila tersedia)
    setValue("packagingId", recipe.packagingSupplyItemId ?? recipe.packagingId);
    setValue("recipeId", recipe.id);

    // Set komponen RB dengan saran gramasi
    if (recipe.items.length > 0) {
      replace(
        recipe.items.map((item) => ({
          productId:   item.productId,
          productName: item.productName,
          gramsPerUnit: Number(item.gramsPerUnit),
        }))
      );
    }

    // Set komponen non-kopi dengan saran dari resep
    if (recipe.supplyItems.length > 0) {
      replaceSupply(
        recipe.supplyItems.map((item) => ({
          supplyItemId:   item.supplyItemId,
          supplyItemName: item.supplyItemName,
          quantityPerUnit: Number(item.quantityPerUnit),
        }))
      );
    } else {
      replaceSupply([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputProductId]);

  // ── Submit ──
  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const result = await createProductionBatch({
        operationKey,
        outputProductId: values.outputProductId,
        recipeId:        values.recipeId || undefined,
        // Kemasan dipilih dari InventorySupplyItem (canonical). Bila nilainya
        // bukan item supply (kemasan legacy dari resep lama), kirim packagingId.
        packagingSupplyItemId: packagingOptions.some((p) => p.id === values.packagingId)
          ? values.packagingId
          : undefined,
        packagingId: packagingOptions.some((p) => p.id === values.packagingId)
          ? undefined
          : values.packagingId,
        unitsProduced:   values.unitsProduced,
        rbComponents:    values.rbComponents.map((c) => ({
          productId:   c.productId,
          productName: c.productName,
          actualGrams: Math.round(c.gramsPerUnit * values.unitsProduced),
        })),
        supplyComponents: (values.supplyComponents ?? [])
          .filter((c) => c.supplyItemId)
          .map((c) => ({
            supplyItemId: c.supplyItemId,
            quantity: Number(c.quantityPerUnit) * values.unitsProduced,
          })),
        laborCost:         values.laborCost,
        overheadAllocated: values.overheadAllocated,
        notes: values.notes,
        destinationLocationId: values.destinationLocationId || undefined,
        parentRoastBatchId: parentRoastBatchId || undefined,
      });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }

      toast.success(`Batch produksi dicatat — ${result.batchCode}`);
      reset();
      setTargetRbKg("");
      setOperationKey(crypto.randomUUID());
      onSuccess();
    } catch (err) {
      console.error("[ProductionForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  const selectedFG = fgOptions.find((f) => f.id === outputProductId);
  const selectedPackaging = packagingOptions.find((item) => item.id === packagingId);
  const coffeeGramsPerUnit = (rbComponents ?? []).reduce(
    (sum, component) => sum + (Number(component.gramsPerUnit) || 0),
    0,
  );
  const packagingSuggestion = calculatePackagingSuggestion({
    targetRbKg: Number(targetRbKg),
    coffeeGramsPerUnit,
    capacityGrams:
      coffeeGramsPerUnit > 0 || rbComponents.length === 1
        ? selectedPackaging?.capacityGrams ?? null
        : null,
  });

  const applyPackagingSuggestion = () => {
    if (!packagingSuggestion) return;
    if (
      coffeeGramsPerUnit <= 0 &&
      rbComponents.length === 1 &&
      selectedPackaging?.capacityGrams
    ) {
      setValue("rbComponents.0.gramsPerUnit", selectedPackaging.capacityGrams, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    setValue("unitsProduced", packagingSuggestion.units, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">
      {/* ── Pilih FG ── */}
      <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">
          Produk Jadi <span className="text-[var(--status-danger)]">*</span>
        </Label>
        <Controller
          control={control}
          name="outputProductId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val: string | null) => field.onChange(val ?? "")}
            >
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih SKU Produk Jadi...">
                  {field.value ? fgOptions.find((f) => f.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fgOptions.length === 0 ? (
                  <SelectItem value="_empty" disabled>Belum ada produk FG</SelectItem>
                ) : (
                  fgOptions.map((fg) => (
                    <SelectItem key={fg.id} value={fg.id}>
                      {fg.name}
                      {fg.recipe && (
                        <span className="ml-1 text-ink-secondary">✓ resep</span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        {selectedFG?.recipe && (
          <p className="text-xs text-[var(--status-success)]">
            ✓ Resep "{selectedFG.recipe.items.map((i) => i.productName).join(" + ")}" dimuat otomatis. Gramasi bisa diedit bebas.
          </p>
        )}
        {selectedFG && !selectedFG.recipe && (
          <p className="text-xs text-[var(--status-warning)]">
            Produk ini belum memiliki resep. Tambahkan komponen RB secara manual.
          </p>
        )}
        <FieldError message={errors.outputProductId?.message} />
      </FieldGroup>

      {/* ── Jumlah Unit ── */}
      <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">
          Jumlah Unit Diproduksi <span className="text-[var(--status-danger)]">*</span>
        </Label>
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="1"
          className={cn("h-9 tabular-nums font-semibold", glassInput)}
          {...register("unitsProduced", { valueAsNumber: true })}
        />
        <FieldError message={errors.unitsProduced?.message} />
      </FieldGroup>

      {selectedFG?.recipe && (
        <button
          type="button"
          onClick={() => setShowRecipeDetails((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--status-success)]/30 bg-[var(--status-success)]/10/70 px-4 py-3 text-left text-xs font-semibold text-[var(--status-success)]"
        >
          <span>
            Resep otomatis · {selectedFG.recipe.items.map((item) => item.productName).join(" + ")} · {selectedFG.recipe.packagingName}
          </span>
          <ChevronDown size={14} className={cn("shrink-0 transition-transform", showRecipeDetails && "rotate-180")} />
        </button>
      )}

      {(!selectedFG?.recipe || showRecipeDetails) && (
        <>
      <Separator className="bg-card/50" />

      {/* ── Komponen Roasted Bean ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">
            Komponen Roasted Bean <span className="text-[var(--status-danger)]">*</span>
          </Label>
          <button
            type="button"
            onClick={() => append({ productId: "", productName: "", gramsPerUnit: 0 })}
            className="flex items-center gap-1 rounded-lg border border-white/60 bg-card/30 px-3 py-1 text-xs font-medium text-ink hover:bg-card/50 transition-colors shadow-sm"
          >
            <Plus size={14} /> Tambah
          </button>
        </div>

        {typeof errors.rbComponents?.message === "string" && (
          <FieldError message={errors.rbComponents.message} />
        )}

        <div className="space-y-2">
          {fields.map((field, index) => {
            const comp = rbComponents?.[index];
            const selectedRB = rbOptions.find((r) => r.id === comp?.productId);
            const neededKg = ((Number(comp?.gramsPerUnit) || 0) * (Number(unitsProduced) || 1)) / 1000;
            const isOverStock = selectedRB ? neededKg > selectedRB.stockKg : false;

            return (
              <div
                key={field.id}
                className="relative flex flex-wrap sm:flex-nowrap items-start gap-4 rounded-xl border border-white/60 bg-card/40 backdrop-blur-md p-4 shadow-sm hover:shadow transition-all group"
              >
                {/* Delete button (absolute top right) */}
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="absolute -right-2 -top-3 z-10 flex min-h-9 min-w-9 items-center justify-center rounded-full border border-white/60 bg-card p-2 text-[var(--status-danger)] opacity-100 shadow-sm transition-opacity hover:bg-[var(--status-danger)]/10 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    title="Hapus Komponen"
                    aria-label={`Hapus komponen kopi ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                {/* Pilih RB */}
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-ink-secondary mb-1 block tracking-wider">Roasted Bean</Label>
                  <Controller
                    control={control}
                    name={`rbComponents.${index}.productId`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value}
                        onValueChange={(val: string | null) => {
                          const v = val ?? "";
                          f.onChange(v);
                          const rb = rbOptions.find((r) => r.id === v);
                          setValue(`rbComponents.${index}.productName`, rb?.name ?? "");
                        }}
                      >
                        <SelectTrigger className={cn("h-9 text-xs font-medium", glassInput)}>
                          <SelectValue placeholder="Pilih Roasted Bean...">
                            {f.value ? rbOptions.find((r) => r.id === f.value)?.name : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {rbOptions.length === 0 ? (
                            <SelectItem value="_empty" disabled>Tidak ada RB tersedia</SelectItem>
                          ) : (
                            rbOptions.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                                {r.roastLevel ? ` · ${r.roastLevel.replace("_", " ")}` : ""}
                                {" "}
                                <span className="text-ink-secondary font-normal">({formatKg(r.stockKg)})</span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {selectedRB && (
                    <p className={`text-[10px] font-medium pt-1 ${isOverStock ? "text-[var(--status-danger)]" : "text-ink-secondary"}`}>
                      Stok: {formatKg(selectedRB.stockKg)}
                      {isOverStock && " — ⚠ melebihi stok"}
                    </p>
                  )}
                </div>

                {/* Gram input */}
                <div className="w-36 shrink-0 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-ink-secondary mb-1 block tracking-wider">Gramasi per Unit</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="e.g. 1000"
                      className={cn("h-9 tabular-nums font-semibold pr-8 text-ink", glassInput, 
                        errors.rbComponents?.[index]?.gramsPerUnit ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10/50 focus:border-[var(--status-danger)]/30 focus:bg-card" : "")
                      }
                      {...register(`rbComponents.${index}.gramsPerUnit`, { valueAsNumber: true })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-secondary">g</span>
                  </div>
                  <FieldError message={errors.rbComponents?.[index]?.gramsPerUnit?.message} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator className="bg-card/50" />

      {/* ── Kemasan ── */}
      <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">
          Kemasan (Item Non-Kopi) <span className="text-[var(--status-danger)]">*</span>
        </Label>
        <Controller
          control={control}
          name="packagingId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val: string | null) => field.onChange(val ?? "")}
            >
              <SelectTrigger className={cn("w-full h-9 font-medium", glassInput)}>
                <SelectValue placeholder="Pilih kemasan...">
                  {field.value ? packagingOptions.find((p) => p.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {packagingOptions.length === 0 ? (
                  <SelectItem value="_empty" disabled>Tidak ada kemasan tersedia</SelectItem>
                ) : (
                  packagingOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {" "}
                      <span className="text-ink-secondary font-normal">
                        ({p.code} · {formatUnit(p.stockUnit)} {p.baseUnit} · {formatRupiah(p.costPerUnit)}/{p.baseUnit})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.packagingId?.message} />
        {selectedPackaging?.capacityGrams && (
          <div className="mt-2 rounded-xl border border-[var(--instrument)]/30 bg-[var(--instrument)]/70 p-3">
            <div className="flex items-start gap-2">
              <Calculator size={16} className="mt-0.5 shrink-0 text-[var(--instrument)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--instrument)]">Kalkulator jumlah kemasan</p>
                <p className="mt-0.5 text-[11px] text-[var(--instrument)]">
                  Kapasitas nominal {selectedPackaging.capacityGrams.toFixed(0)} g. Masukkan target bahan kopi yang ingin dipakai.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={targetRbKg}
                      onChange={(event) => setTargetRbKg(event.target.value)}
                      placeholder="Contoh: 10"
                      className="h-9 bg-card/80 pr-10 tabular-nums"
                      aria-label="Target bahan kopi dalam kilogram"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--instrument)]">kg</span>
                  </div>
                  {packagingSuggestion && (
                    <button
                      type="button"
                      onClick={applyPackagingSuggestion}
                      className="h-9 shrink-0 rounded-lg bg-[var(--instrument)] px-3 text-xs font-bold text-white transition hover:bg-[var(--instrument)]"
                    >
                      Terapkan {packagingSuggestion.units} unit
                    </button>
                  )}
                </div>
                {packagingSuggestion && (
                  <p className="mt-2 text-[11px] text-[var(--instrument)]">
                    Saran: {packagingSuggestion.units} unit × {packagingSuggestion.gramsPerUnit.toFixed(1)} g
                    {packagingSuggestion.remainderGrams > 0
                      ? ` · sisa ${packagingSuggestion.remainderGrams.toFixed(1)} g`
                      : " · tanpa sisa"}.
                    {packagingSuggestion.units > selectedPackaging.stockUnit
                      ? ` Stok kemasan hanya ${selectedPackaging.stockUnit} unit.`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </FieldGroup>

      {/* ── Komponen Non-Kopi (opsional) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">
            Komponen Non-Kopi (opsional)
          </Label>
          <button
            type="button"
            onClick={() => appendSupply({ supplyItemId: "", supplyItemName: "", quantityPerUnit: 0 })}
            className="flex items-center gap-1 rounded-lg border border-white/60 bg-card/30 px-3 py-1 text-xs font-medium text-ink hover:bg-card/50 transition-colors shadow-sm"
          >
            <Plus size={14} /> Tambah
          </button>
        </div>

        <div className="space-y-2">
          {supplyFields.map((field, index) => {
            const comp = supplyComponents?.[index];
            const selectedItem = supplyOptions.find((o) => o.id === comp?.supplyItemId);
            const neededQty = (Number(comp?.quantityPerUnit) || 0) * (Number(unitsProduced) || 1);
            const isOverStock = selectedItem ? neededQty > selectedItem.stockQuantity : false;

            return (
              <div
                key={field.id}
                className="relative flex flex-wrap sm:flex-nowrap items-start gap-4 rounded-xl border border-white/60 bg-card/40 backdrop-blur-md p-4 shadow-sm hover:shadow transition-all group"
              >
                {supplyFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => removeSupply(index)}
                    className="absolute -right-2 -top-3 z-10 flex min-h-9 min-w-9 items-center justify-center rounded-full border border-white/60 bg-card p-2 text-[var(--status-danger)] opacity-100 shadow-sm transition-opacity hover:bg-[var(--status-danger)]/10 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    title="Hapus Komponen"
                    aria-label={`Hapus komponen non-kopi ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-ink-secondary mb-1 block tracking-wider">Item Non-Kopi</Label>
                  <Controller
                    control={control}
                    name={`supplyComponents.${index}.supplyItemId`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value}
                        onValueChange={(val: string | null) => {
                          const v = val ?? "";
                          f.onChange(v);
                          const item = supplyOptions.find((o) => o.id === v);
                          setValue(`supplyComponents.${index}.supplyItemName`, item?.name ?? "");
                        }}
                      >
                        <SelectTrigger className={cn("h-9 text-xs font-medium", glassInput)}>
                          <SelectValue placeholder="Pilih item non-kopi...">
                            {f.value ? supplyOptions.find((o) => o.id === f.value)?.name : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {supplyOptions.length === 0 ? (
                            <SelectItem value="_empty" disabled>Tidak ada item tersedia</SelectItem>
                          ) : (
                            supplyOptions.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.name}
                                {" "}
                                <span className="text-ink-secondary font-normal">
                                  ({o.code} · {o.stockQuantity} {o.baseUnit})
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {selectedItem && (
                    <p className={`text-[10px] font-medium pt-1 ${isOverStock ? "text-[var(--status-danger)]" : "text-ink-secondary"}`}>
                      Stok: {selectedItem.stockQuantity} {selectedItem.baseUnit} · {formatRupiah(selectedItem.costPerUnit)}/{selectedItem.baseUnit}
                      {isOverStock && " — ⚠ melebihi stok"}
                    </p>
                  )}
                </div>

                <div className="w-36 shrink-0 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-ink-secondary mb-1 block tracking-wider">Qty per Unit</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="e.g. 1"
                      className={cn("h-9 tabular-nums font-semibold pr-8 text-ink", glassInput,
                        errors.supplyComponents?.[index]?.quantityPerUnit ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10/50 focus:border-[var(--status-danger)]/30 focus:bg-card" : "")
                      }
                      {...register(`supplyComponents.${index}.quantityPerUnit`, { valueAsNumber: true })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-secondary">
                      {selectedItem?.baseUnit ?? "unit"}
                    </span>
                  </div>
                  <FieldError message={errors.supplyComponents?.[index]?.quantityPerUnit?.message} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* ── Biaya Tenaga Kerja & Overhead ── */}
      {(!selectedFG?.recipe || showRecipeDetails) && <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">
            Biaya Tenaga Kerja (opsional)
          </Label>
          <Input
            type="number"
            step="1000"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("laborCost", { valueAsNumber: true })}
          />
          <p className="text-[10px] text-ink-secondary">Total upah/gaji untuk batch ini</p>
        </FieldGroup>
        <FieldGroup>
          <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">
            Alokasi Overhead (opsional)
          </Label>
          <Input
            type="number"
            step="1000"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("overheadAllocated", { valueAsNumber: true })}
          />
          <p className="text-[10px] text-ink-secondary">Listrik, gas, air, penyusutan, dll.</p>
        </FieldGroup>
      </div>}

      {/* ── Ringkasan ── */}
      <HppSummary
        rbComponents={rbComponents ?? []}
        rbOptions={rbOptions}
        packagingOptions={packagingOptions}
        supplyOptions={supplyOptions}
        supplyComponents={supplyComponents ?? []}
        packagingId={packagingId ?? ""}
        unitsProduced={Number(unitsProduced) || 0}
        laborCost={Number(laborCost) || 0}
        overheadAllocated={Number(overheadAllocated) || 0}
      />

      <Controller
        control={control}
        name="destinationLocationId"
        render={({ field }) => (
          <InventoryDestinationField
            value={destinationLocationId ?? ""}
            onChange={field.onChange}
            options={locationOptions}
            disabled={isSubmitting}
            outputLabel="produk jadi"
          />
        )}
      />

      {/* ── Catatan ── */}
      {(!selectedFG?.recipe || showRecipeDetails) && <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary">Catatan (opsional)</Label>
        <Textarea
          placeholder="Batch notes, variasi blend, dll."
          rows={3}
          className={cn("resize-none text-sm", glassInput)}
          {...register("notes")}
        />
      </FieldGroup>}

      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}
