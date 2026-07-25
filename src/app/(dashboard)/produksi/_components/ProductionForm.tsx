"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
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
} from "../actions";

// =============================================================================
// Zod schema
// =============================================================================

const rbComponentSchema = z.object({
  productId:   z.string().min(1, "Pilih RB"),
  productName: z.string(),
  actualGrams: z.number().positive("> 0").optional(), // kept for compatibility if needed
  gramsPerUnit: z.number().positive("> 0"),
});

const schema = z.object({
  outputProductId: z.string().min(1, "Wajib pilih produk"),
  recipeId:        z.string().optional(),
  packagingId:     z.string().min(1, "Wajib pilih kemasan"),
  unitsProduced:   z.number().int().positive("Minimal 1 unit"),
  rbComponents:    z.array(rbComponentSchema).min(1, "Minimal 1 komponen RB"),
  notes:           z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Field helpers
// =============================================================================

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500">{message}</p>;
}

// =============================================================================
// HPP preview (bottom summary)
// =============================================================================

function HppSummary({
  rbComponents,
  rbOptions,
  packagingOptions,
  packagingId,
  unitsProduced,
}: {
  rbComponents: Array<{ productId: string; actualGrams?: number; gramsPerUnit: number }>;
  rbOptions: RBStockOption[];
  packagingOptions: PackagingOption[];
  packagingId: string;
  unitsProduced: number;
}) {
  if (unitsProduced < 1) return null;

  const rbPerUnit = rbComponents.reduce((s, c) => s + (Number(c.gramsPerUnit) || 0), 0);
  const totalRbGrams = rbPerUnit * unitsProduced;
  const pkg = packagingOptions.find((p) => p.id === packagingId);

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

  const estimatedHpp = rbCostPerUnit + (pkg?.costPerUnit || 0);
  const isUnrealistic = rbPerUnit > 0 && rbPerUnit < 500; // < 500g RB per 1kg FG is suspicious

  return (
    <div className={cn(glassCard, "p-4 space-y-3 mt-4")}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Ringkasan Produksi
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-medium">
        <span className="text-slate-600">Unit diproduksi</span>
        <span className="font-semibold text-slate-900 text-right">{formatUnit(unitsProduced)}</span>
        <span className="text-slate-600">Total RB digunakan</span>
        <span className="font-semibold text-slate-900 text-right">{formatKg(totalRbGrams / 1000)}</span>
        <span className="text-slate-600">Rata-rata RB/unit</span>
        <span className={cn("font-semibold text-right", isUnrealistic ? "text-red-600" : "text-slate-900")}>
          {unitsProduced > 0
            ? `${(totalRbGrams / unitsProduced).toFixed(1)} g`
            : "—"}
        </span>
        {pkg && (
          <>
            <span className="text-slate-600">Kemasan digunakan</span>
            <span className="font-semibold text-slate-900 text-right text-xs mt-0.5">
              1 unit {pkg.name} / unit FG
            </span>
          </>
        )}
        <span className="text-slate-600 mt-1 pt-2 border-t border-slate-200/50">Estimasi HPP/unit</span>
        <span className="font-semibold text-slate-900 text-right mt-1 pt-2 border-t border-slate-200/50">
          {hasMissingCost ? (
            <span className="text-amber-600 text-xs flex flex-col items-end">
              <span>{formatRupiah(estimatedHpp)}</span>
              <span className="text-[10px] font-normal mt-0.5">⚠ data harga RB tidak lengkap</span>
            </span>
          ) : (
            formatRupiah(estimatedHpp)
          )}
        </span>
      </div>
      {isUnrealistic && (
        <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
          <strong>Peringatan:</strong> Rasio RB/unit terlalu rendah ({(rbPerUnit / 1000).toFixed(2)} kg RB per unit). 
          Untuk kopi 1kg, biasanya butuh 1.1-1.3 kg RB (susut 10-20%). Periksa kembali jumlah RB yang dimasukkan.
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
  onSuccess,
  onPendingChange,
}: ProductionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [showRecipeDetails, setShowRecipeDetails] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      outputProductId: "",
      recipeId:        "",
      packagingId:     "",
      unitsProduced:   1,
      rbComponents:    [{ productId: "", productName: "", gramsPerUnit: 0 }],
      notes:           "",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "rbComponents",
  });

  const [outputProductId, unitsProduced, packagingId, rbComponents] = watch([
    "outputProductId",
    "unitsProduced",
    "packagingId",
    "rbComponents",
  ]);

  // ── Auto-fill dari resep saat user pilih FG ──
  useEffect(() => {
    if (!outputProductId) return;
    setShowRecipeDetails(false);

    const fg = fgOptions.find((f) => f.id === outputProductId);
    if (!fg?.recipe) return;

    const recipe = fg.recipe;

    // Set packaging default dari resep
    setValue("packagingId", recipe.packagingId);
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
        packagingId:     values.packagingId,
        unitsProduced:   values.unitsProduced,
        rbComponents:    values.rbComponents.map((c) => ({
          productId:   c.productId,
          productName: c.productName,
          actualGrams: Math.round(c.gramsPerUnit * values.unitsProduced),
        })),
        notes: values.notes,
      });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }

      toast.success(`Batch produksi dicatat — ${result.batchCode}`);
      reset();
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

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">
      {/* ── Pilih FG ── */}
      <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Produk Jadi <span className="text-red-500">*</span>
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
                        <span className="ml-1 text-slate-400">✓ resep</span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        {selectedFG?.recipe && (
          <p className="text-xs text-emerald-600">
            ✓ Resep "{selectedFG.recipe.items.map((i) => i.productName).join(" + ")}" dimuat otomatis. Gramasi bisa diedit bebas.
          </p>
        )}
        {selectedFG && !selectedFG.recipe && (
          <p className="text-xs text-amber-600">
            Produk ini belum memiliki resep. Tambahkan komponen RB secara manual.
          </p>
        )}
        <FieldError message={errors.outputProductId?.message} />
      </FieldGroup>

      {/* ── Jumlah Unit ── */}
      <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Jumlah Unit Diproduksi <span className="text-red-500">*</span>
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
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-left text-xs font-semibold text-emerald-700"
        >
          <span>
            Resep otomatis · {selectedFG.recipe.items.map((item) => item.productName).join(" + ")} · {selectedFG.recipe.packagingName}
          </span>
          <ChevronDown size={14} className={cn("shrink-0 transition-transform", showRecipeDetails && "rotate-180")} />
        </button>
      )}

      {(!selectedFG?.recipe || showRecipeDetails) && (
        <>
      <Separator className="bg-white/50" />

      {/* ── Komponen Roasted Bean ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Komponen Roasted Bean <span className="text-red-500">*</span>
          </Label>
          <button
            type="button"
            onClick={() => append({ productId: "", productName: "", gramsPerUnit: 0 })}
            className="flex items-center gap-1 rounded-lg border border-white/60 bg-white/30 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white/50 transition-colors shadow-sm"
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
                className="relative flex flex-wrap sm:flex-nowrap items-start gap-4 rounded-xl border border-white/60 bg-white/40 backdrop-blur-md p-4 shadow-sm hover:shadow transition-all group"
              >
                {/* Delete button (absolute top right) */}
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="absolute -top-3 -right-2 bg-white text-red-500 border border-white/60 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 shadow-sm z-10"
                    title="Hapus Komponen"
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                {/* Pilih RB */}
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Roasted Bean</Label>
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
                                <span className="text-slate-400 font-normal">({formatKg(r.stockKg)})</span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {selectedRB && (
                    <p className={`text-[10px] font-medium pt-1 ${isOverStock ? "text-red-500" : "text-slate-500"}`}>
                      Stok: {formatKg(selectedRB.stockKg)}
                      {isOverStock && " — ⚠ melebihi stok"}
                    </p>
                  )}
                </div>

                {/* Gram input */}
                <div className="w-36 shrink-0 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Gramasi per Unit</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="e.g. 1000"
                      className={cn("h-9 tabular-nums font-semibold pr-8 text-slate-900", glassInput, 
                        errors.rbComponents?.[index]?.gramsPerUnit ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:bg-white" : "")
                      }
                      {...register(`rbComponents.${index}.gramsPerUnit`, { valueAsNumber: true })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">g</span>
                  </div>
                  <FieldError message={errors.rbComponents?.[index]?.gramsPerUnit?.message} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator className="bg-white/50" />

      {/* ── Kemasan ── */}
      <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Kemasan <span className="text-red-500">*</span>
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
                      <span className="text-slate-400 font-normal">
                        ({formatUnit(p.stockUnit)} · {formatRupiah(p.costPerUnit)}/pcs)
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.packagingId?.message} />
      </FieldGroup>
        </>
      )}

      {/* ── Ringkasan ── */}
      <HppSummary
        rbComponents={rbComponents ?? []}
        rbOptions={rbOptions}
        packagingOptions={packagingOptions}
        packagingId={packagingId ?? ""}
        unitsProduced={Number(unitsProduced) || 0}
      />

      {/* ── Catatan ── */}
      {(!selectedFG?.recipe || showRecipeDetails) && <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Catatan (opsional)</Label>
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
