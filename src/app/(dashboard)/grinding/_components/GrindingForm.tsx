"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatKg, formatRupiah } from "@/lib/format";
import { InventoryDestinationField } from "@/components/inventory/InventoryDestinationField";
import type { InventoryLocationOption } from "@/lib/storage-location";
import {
  createGrindingBatch,
  type RBStockOption,
  type GroundCoffeeOption,
  type GrinderOption,
} from "../actions";

// =============================================================================
// Zod schema
// =============================================================================

const GRIND_SIZES = [
  "WHOLE_BEAN",
  "COARSE",
  "MEDIUM_COARSE",
  "MEDIUM",
  "MEDIUM_FINE",
  "FINE",
  "ESPRESSO",
  "CUSTOM",
] as const;

const GRIND_SIZE_LABELS: Record<string, string> = {
  WHOLE_BEAN: "Whole Bean",
  COARSE: "Coarse",
  MEDIUM_COARSE: "Medium Coarse",
  MEDIUM: "Medium",
  MEDIUM_FINE: "Medium Fine",
  FINE: "Fine",
  ESPRESSO: "Espresso",
  CUSTOM: "Custom",
};

const schema = z.object({
  sourceProductId: z.string().min(1, "Wajib pilih Roasted Bean"),
  outputProductId: z.string().min(1, "Wajib pilih produk output"),
  grindSize: z.enum(GRIND_SIZES),
  customGrindLabel: z.string().optional(),
  grinderId: z.string().optional(),
  inputKg: z.number().positive("Harus lebih dari 0"),
  outputKg: z.number().positive("Harus lebih dari 0"),
  grindingCost: z.number().nonnegative().optional(),
  destinationLocationId: z.string().optional(),
  batchReference: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.outputKg >= data.inputKg) {
    ctx.addIssue({
      code: "custom",
      path: ["outputKg"],
      message: "Berat hasil harus lebih kecil dari berat masuk (ada susut).",
    });
  }
  if (data.grindSize === "CUSTOM" && (!data.customGrindLabel || data.customGrindLabel.trim().length < 2)) {
    ctx.addIssue({
      code: "custom",
      path: ["customGrindLabel"],
      message: "Label custom minimal 2 karakter.",
    });
  }
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
// Props
// =============================================================================

interface GrindingFormProps {
  id: string;
  rbOptions: RBStockOption[];
  groundCoffeeOptions: GroundCoffeeOption[];
  grinderOptions: GrinderOption[];
  locationOptions: InventoryLocationOption[];
  /** RB yang sudah dipilih saat dibuka dari rekap roasting. */
  initialSourceProductId?: string;
  /** Batch roasting sumber (dari aksi di rekap roasting). Opsional. */
  parentRoastBatchId?: string;
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function GrindingForm({
  id,
  rbOptions,
  groundCoffeeOptions,
  grinderOptions,
  locationOptions,
  initialSourceProductId = "",
  parentRoastBatchId,
  onSuccess,
  onPendingChange,
}: GrindingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceProductId: initialSourceProductId,
      outputProductId: "",
      grindSize: "MEDIUM",
      customGrindLabel: "",
      grinderId: "",
      inputKg: 0,
      outputKg: 0,
      grindingCost: 0,
      destinationLocationId: locationOptions[0]?.id ?? "",
      batchReference: "",
      notes: "",
    },
  });

  const [sourceProductId, inputKg, outputKg, grindSize] = watch([
    "sourceProductId",
    "inputKg",
    "outputKg",
    "grindSize",
  ]);

  const selectedRB = rbOptions.find((r) => r.id === sourceProductId);
  const lossKg = inputKg > 0 && outputKg > 0 ? inputKg - outputKg : 0;
  const lossPercent = inputKg > 0 ? (lossKg / inputKg) * 100 : 0;
  const totalRbCost = selectedRB && inputKg > 0 ? selectedRB.avgCostPerKg * inputKg : 0;
  const grindingCost = Number(watch("grindingCost") ?? 0);
  const destinationLocationId = watch("destinationLocationId") ?? "";
  const totalCost = totalRbCost + grindingCost;
  const hppPerKg = outputKg > 0 ? totalCost / outputKg : 0;

  const onSubmit = async (values: FormValues) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const result = await createGrindingBatch({
        operationKey,
        sourceProductId: values.sourceProductId,
        outputProductId: values.outputProductId,
        grindSize: values.grindSize,
        customGrindLabel: values.customGrindLabel,
        grinderId: values.grinderId || undefined,
        inputKg: values.inputKg,
        outputKg: values.outputKg,
        grindingCost: values.grindingCost,
        destinationLocationId: values.destinationLocationId || undefined,
        batchReference: values.batchReference,
        notes: values.notes,
        parentRoastBatchId: parentRoastBatchId || undefined,
      });

      if (!result.success) {
        toastSafe.error(result.error, { id: "grinding-batch-submit-error" });
        return;
      }

      toast.success(`Batch grinding dicatat — ${result.batchCode}`);
      reset();
      setOperationKey(crypto.randomUUID());
      onSuccess();
    } catch (err) {
      console.error("[GrindingForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
          Roasted Bean Sumber <span className="text-[var(--status-danger)]">*</span>
        </Label>
        <Controller
          control={control}
          name="sourceProductId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val: string | null) => field.onChange(val ?? "")}
            >
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih Roasted Bean...">
                  {field.value ? rbOptions.find((r) => r.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {rbOptions.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Tidak ada RB dengan stok tersedia
                  </SelectItem>
                ) : (
                  rbOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.roastLevel ? ` — ${r.roastLevel.replace("_", " ")}` : ""}
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
          <p className="text-xs font-medium text-ink-secondary pt-1">
            Stok: <span className="font-bold text-ink">{formatKg(selectedRB.stockKg)}</span>
            {" "}· HPP: <span className="font-bold text-ink">{formatRupiah(selectedRB.avgCostPerKg)}/kg</span>
          </p>
        )}
        <FieldError message={errors.sourceProductId?.message} />
      </FieldGroup>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
          SKU Kopi Giling (kg) <span className="text-[var(--status-danger)]">*</span>
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
                <SelectValue placeholder="Pilih produk output...">
                  {field.value ? groundCoffeeOptions.find((f) => f.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groundCoffeeOptions.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Belum ada SKU kopi giling
                  </SelectItem>
                ) : (
                  groundCoffeeOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.outputProductId?.message} />
      </FieldGroup>

      <Separator className="bg-card/50" />

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
            Berat Masuk (kg) <span className="text-[var(--status-danger)]">*</span>
          </Label>
          <Input
            type="number"
            step="0.001"
            min="0"
            placeholder="0.000"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("inputKg", { valueAsNumber: true })}
          />
          {selectedRB && Number(inputKg) > selectedRB.stockKg && (
            <p className="text-xs font-medium text-[var(--status-danger)]">
              Melebihi stok tersedia ({formatKg(selectedRB.stockKg)})
            </p>
          )}
          <FieldError message={errors.inputKg?.message} />
        </FieldGroup>

        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
            Berat Hasil (kg) <span className="text-[var(--status-danger)]">*</span>
          </Label>
          <Input
            type="number"
            step="0.001"
            min="0"
            placeholder="0.000"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("outputKg", { valueAsNumber: true })}
          />
          <FieldError message={errors.outputKg?.message} />
        </FieldGroup>
      </div>

      {lossKg > 0 && (
        <div className={cn(glassCard, "flex items-center justify-between px-5 py-3")}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Susut</p>
            <p className="text-lg font-bold tabular-nums">{formatKg(lossKg)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Persen Susut</p>
            <p className="text-lg font-bold tabular-nums">{lossPercent.toFixed(2)}%</p>
          </div>
        </div>
      )}

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
          Ukuran Giling <span className="text-[var(--status-danger)]">*</span>
        </Label>
        <Controller
          control={control}
          name="grindSize"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(val: string | null) => field.onChange(val ?? "")}>
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih ukuran giling...">
                  {field.value ? GRIND_SIZE_LABELS[field.value] ?? field.value : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GRIND_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {GRIND_SIZE_LABELS[size] ?? size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {grindSize === "CUSTOM" && (
          <div className="mt-2">
            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
                Label Custom <span className="text-[var(--status-danger)]">*</span>
              </Label>
              <Input
                placeholder="e.g. Turkish, Moka Pot Special"
                className={cn("h-9", glassInput)}
                {...register("customGrindLabel")}
              />
              <FieldError message={errors.customGrindLabel?.message} />
            </FieldGroup>
          </div>
        )}
        <FieldError message={errors.grindSize?.message} />
      </FieldGroup>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
          Mesin Giling (Opsional)
        </Label>
        <Controller
          control={control}
          name="grinderId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val: string | null) => field.onChange(val ?? "")}
            >
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih mesin...">
                  {field.value && field.value !== "none" ? grinderOptions.find((m) => m.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa mesin</SelectItem>
                {grinderOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} {m.capacityKg ? `(${m.capacityKg}kg)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.grinderId?.message} />
      </FieldGroup>

      <Separator className="bg-card/50" />

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
            Biaya Grinding (opsional)
          </Label>
          <Input
            type="number"
            step="1000"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("grindingCost", { valueAsNumber: true })}
          />
          <p className="text-[10px] text-ink-secondary">Tenaga/operasional grinding</p>
        </FieldGroup>

        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">
            Referensi Batch (opsional)
          </Label>
          <Input
            placeholder="e.g. RST-2024-001"
            className={cn("h-9", glassInput)}
            {...register("batchReference")}
          />
        </FieldGroup>
      </div>

      <div className={cn(glassCard, "p-4 space-y-2")}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
          Ringkasan HPP
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-medium">
          <span className="text-ink">Biaya RB</span>
          <span className="font-semibold text-ink text-right">{formatRupiah(totalRbCost)}</span>
          <span className="text-ink">Biaya Grinding</span>
          <span className="font-semibold text-ink text-right">{formatRupiah(grindingCost)}</span>
          <span className="text-ink mt-1 pt-2 border-t border-border/50">Total Biaya</span>
          <span className="font-semibold text-ink text-right mt-1 pt-2 border-t border-border/50">{formatRupiah(totalCost)}</span>
          <span className="text-ink">HPP/kg Output</span>
          <span className="font-semibold text-ink text-right">{formatRupiah(hppPerKg)}</span>
        </div>
      </div>

      <FieldGroup>
        <Controller
          control={control}
          name="destinationLocationId"
          render={({ field }) => (
            <InventoryDestinationField
              value={destinationLocationId}
              onChange={field.onChange}
              options={locationOptions}
              disabled={isSubmitting}
              outputLabel="hasil grinding"
            />
          )}
        />
      </FieldGroup>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-ink-secondary">Catatan (opsional)</Label>
        <Textarea
          placeholder="Catatan batch, kondisi mesin, dll."
          rows={2}
          className={cn("resize-none text-sm", glassInput)}
          {...register("notes")}
        />
      </FieldGroup>

      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}
