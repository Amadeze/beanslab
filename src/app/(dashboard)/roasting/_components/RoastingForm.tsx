"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

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
import { formatKg } from "@/lib/format";
import { analyzeRoastOutcome } from "@/lib/roast-intent";
import { roastedBeanName, greenBeanIdentity, type RoastLevelValue } from "@/lib/roast-product";
import { RoastingDestinationField } from "./RoastingDestinationField";
import {
  createParentRoastingBatch,
  type GBStockOption,
  type ParentRoastingBatchRow,
  type RBProductOption,
  type MachineOption,
  type ReusableRoastProfileRow,
  type RoastingLocationOption,
} from "../actions";

// =============================================================================
// Zod schema
// =============================================================================

const ROAST_LEVELS = ["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"] as const;
const ROAST_LEVEL_LABELS: Record<string, string> = {
  LIGHT:       "Light",
  MEDIUM:      "Medium",
  MEDIUM_DARK: "Medium Dark",
  DARK:        "Dark",
};

function buildRoastLevelOptions() {
  return ROAST_LEVELS.map((level) => ({ value: level, label: ROAST_LEVEL_LABELS[level] }));
}

const schema = z
  .object({
    mode: z.enum(["ARTISAN", "MANUAL"]),
    inputProductId: z.string().min(1, "Wajib pilih Green Bean"),
    targetWeightKg: z.number().positive("Harus lebih dari 0"),
    outputMode: z.enum(["auto", "existing", "new"]),
    outputProductId: z.string().optional(),
    outputProductName: z.string().optional(),
    outputProductOrigin: z.string().optional(),
    outputRoastLevel: z.string().optional(),
    actualOutputKg: z.number().optional(),
    notes: z.string().optional(),
    machineId: z.string().optional(),
    referenceProfileId: z.string().optional(),
    destinationLocationId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.outputRoastLevel) {
      ctx.addIssue({ code: "custom", path: ["outputRoastLevel"], message: "Pilih level roasting" });
    }
    if (data.outputMode === "existing" && !data.outputProductId) {
      ctx.addIssue({ code: "custom", path: ["outputProductId"], message: "Wajib pilih produk" });
    }
    if (data.outputMode === "new") {
      if (!data.outputProductName || data.outputProductName.trim().length < 2) {
        ctx.addIssue({ code: "custom", path: ["outputProductName"], message: "Nama minimal 2 karakter" });
      }
    }
    if (data.mode === "MANUAL") {
      if (!data.actualOutputKg || data.actualOutputKg <= 0) {
        ctx.addIssue({ code: "custom", path: ["actualOutputKg"], message: "Wajib diisi untuk mode manual" });
      } else if (data.actualOutputKg >= data.targetWeightKg) {
        ctx.addIssue({
          code: "custom",
          path: ["actualOutputKg"],
          message: "Berat keluar harus lebih kecil dari berat masuk",
        });
      }
    }
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

// ─────────────────────────────────────────────
// Shrinkage display
// ─────────────────────────────────────────────

function ShrinkageDisplay({
  input,
  output,
  recentLosses,
}: {
  input: number;
  output: number;
  recentLosses: number[];
}) {
  const valid = input > 0 && output > 0 && output < input;
  if (!valid) {
    return (
      <div className={cn(glassCard, "flex h-16 items-center justify-center border-dashed border-white/80")}>
        <p className="text-xs text-slate-500 font-medium tracking-wide">Isi berat masuk & keluar untuk melihat kalkulasi</p>
      </div>
    );
  }

  const outcome = analyzeRoastOutcome(input, output, recentLosses);
  const { lossKg, lossPercent } = outcome;
  const badgeColor =
    outcome.status === "REVIEW"
      ? "bg-red-50/90 border-red-200 text-red-700 shadow-sm"
      : "bg-emerald-50/90 border-emerald-200 text-emerald-700 shadow-sm";

  return (
    <div className={`flex items-center justify-between rounded-[1.25rem] border backdrop-blur-md px-5 py-4 ${badgeColor}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Shrinkage</p>
        <p className="text-3xl font-black tabular-nums tracking-tight">{lossPercent.toFixed(2)}%</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Susut</p>
        <p className="text-lg font-bold tabular-nums">{formatKg(lossKg)}</p>
        <p className="mt-1 text-xs font-medium opacity-80">
          Acuan {outcome.expectedMinPercent.toFixed(1)}–{outcome.expectedMaxPercent.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Props
// =============================================================================

interface RoastingFormProps {
  id: string;
  gbOptions: GBStockOption[];
  rbOptions: RBProductOption[];
  machineOptions: MachineOption[];
  batches: ParentRoastingBatchRow[];
  reusableProfiles: ReusableRoastProfileRow[];
  locationOptions: RoastingLocationOption[];
  initialInputProductId?: string;
  initialRoastLevel?: string;
  initialTargetWeightKg?: number;
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function RoastingForm({
  id,
  gbOptions,
  rbOptions,
  machineOptions,
  batches,
  reusableProfiles,
  locationOptions,
  initialInputProductId = "",
  initialRoastLevel = "",
  initialTargetWeightKg = 0,
  onSuccess,
  onPendingChange,
}: RoastingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const router = useRouter();
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      mode: "MANUAL",
      inputProductId: initialInputProductId,
      targetWeightKg: initialTargetWeightKg,
      outputMode: "auto",
      outputProductId: "",
      outputProductName: "",
      outputProductOrigin: "",
      outputRoastLevel: initialRoastLevel,
      actualOutputKg: 0,
      notes: "",
      machineId: "",
      referenceProfileId: "",
      destinationLocationId: locationOptions[0]?.id ?? "",
    },
  });

  const [mode, inputProductId, targetWeightKg, actualOutputKg, outputMode, outputProductId, outputRoastLevel, machineId, outputProductOrigin] = watch([
    "mode",
    "inputProductId",
    "targetWeightKg",
    "actualOutputKg",
    "outputMode",
    "outputProductId",
    "outputRoastLevel",
    "machineId",
    "outputProductOrigin",
  ]);

  const selectedGB = gbOptions.find((g) => g.id === inputProductId);
  const selectedMachine = machineOptions.find((m) => m.id === machineId);

  const likelyRbOptions = useMemo(() => rbOptions.filter((rb) => {
    if (!selectedGB || !selectedGB.origin) return true;
    if (rb.origin) return rb.origin === selectedGB.origin;
    
    const gbName = selectedGB.name.toLowerCase();
    const rbName = rb.name.toLowerCase();
    const gbWords = gbName.split(" ").filter(w => w.length > 3 && !['green', 'bean'].includes(w));
    
    return gbWords.some(w => rbName.includes(w));
  }), [rbOptions, selectedGB]);

  const rankedRbOptions = useMemo(() => [
    ...likelyRbOptions,
    ...rbOptions.filter((rb) => !likelyRbOptions.some((likely) => likely.id === rb.id)),
  ], [likelyRbOptions, rbOptions]);

  useEffect(() => {
    if (!inputProductId) return;
    setValue("outputMode", "auto");
    setValue("outputProductId", "");
    if (selectedGB?.origin && !outputProductOrigin) {
      setValue("outputProductOrigin", selectedGB.origin);
    }
  }, [inputProductId, outputProductOrigin, selectedGB, setValue]);

  const automaticRb = rbOptions.find((rb) =>
    rb.sourceGreenBeanId === inputProductId && rb.roastLevel === outputRoastLevel
  );
  const resolvedOutputProductId = outputMode === "auto" ? automaticRb?.id : outputProductId;

  const recentComparableLosses = useMemo(() => batches
    .filter((batch) =>
      batch.status === "COMPLETED"
      && batch.inputProductId === inputProductId
      && batch.outputProductId === resolvedOutputProductId
      && batch.totalShrinkagePercent !== null
    )
    .slice(0, 10)
    .map((batch) => Number(batch.totalShrinkagePercent)), [batches, inputProductId, resolvedOutputProductId]);

  const onSubmit = async (values: FormValues) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const result = await createParentRoastingBatch({
        operationKey,
        mode: values.mode,
        inputProductId: values.inputProductId,
        targetWeightKg: values.targetWeightKg,
        outputMode: values.outputMode,
        outputProductId: values.outputMode === "existing" ? values.outputProductId : undefined,
        outputProductName: values.outputMode === "new" ? values.outputProductName : undefined,
        outputProductOrigin: values.outputMode === "new" ? values.outputProductOrigin : undefined,
        outputRoastLevel: values.outputRoastLevel || undefined,
        actualOutputKg: values.actualOutputKg,
        notes: values.notes,
        machineId: values.machineId && values.machineId !== "none" ? values.machineId : undefined,
        referenceProfileId: values.referenceProfileId || undefined,
        destinationLocationId: values.destinationLocationId || undefined,
      });

      if (!result.success) {
        toastSafe.error(result.error, { id: "roasting-batch-submit-error" });
        return;
      }

      if (result.outcome?.status === "REVIEW") {
        toast.warning(
          `Batch ${result.batchCode} tersimpan. Susut ${result.outcome.lossPercent.toFixed(1)}% di luar acuan ${result.outcome.expectedMinPercent.toFixed(1)}–${result.outcome.expectedMaxPercent.toFixed(1)}%; periksa timbangan atau profil.`,
          {
            action: {
              label: "Ke Produksi",
              onClick: () => router.push("/produksi"),
            },
          }
        );
      } else {
        toast.success(
          values.mode === "ARTISAN"
            ? `Sesi roasting dimulai — ${result.batchCode}`
            : `Batch roasting masuk stok — ${result.batchCode}`,
          {
            action: {
              label: "Lanjut Produksi",
              onClick: () => router.push("/produksi"),
            },
          }
        );
      }
      reset();
      setOperationKey(crypto.randomUUID());
      onSuccess();
    } catch (err) {
      console.error("[RoastingForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">

      {/* ── Mode Toggle ── */}
      {/* ── Pilih Green Bean ── */}
      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Green Bean <span className="text-red-500">*</span>
        </Label>
        <Controller
          control={control}
          name="inputProductId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val: string | null) => field.onChange(val ?? "")}
            >
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih Green Bean...">
                  {field.value ? gbOptions.find((g) => g.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {gbOptions.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Tidak ada GB dengan stok tersedia
                  </SelectItem>
                ) : (
                  gbOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}{g.origin ? ` — ${g.origin}` : ""}
                      {" "}
                      <span className="text-slate-400 font-normal">({formatKg(g.stockKg)})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        {selectedGB && (
          <p className="text-xs font-medium text-slate-500 pt-1">
            Stok tersedia: <span className="font-bold text-slate-800">{formatKg(selectedGB.stockKg)}</span>
          </p>
        )}
        <FieldError message={errors.inputProductId?.message} />
      </FieldGroup>

      {/* ── Mesin Roasting ── */}
      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Mesin Roasting (Opsional)
        </Label>
        <Controller
          control={control}
          name="machineId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val: string | null) => field.onChange(val ?? "")}
            >
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih mesin...">
                  {field.value && field.value !== "none" ? machineOptions.find((m) => m.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa mesin</SelectItem>
                {machineOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} <span className="text-slate-400 font-normal">({m.capacityKg}kg)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.machineId?.message} />
      </FieldGroup>

      {/* ── Profil Target ── */}
      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Profil Target (Opsional)
        </Label>
        <Controller
          control={control}
          name="referenceProfileId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(val: string | null) => field.onChange(val ?? "")}>
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih profil target...">
                  {field.value ? reusableProfiles.find((p) => p.id === field.value)?.name : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa profil</SelectItem>
                {reusableProfiles.filter((p) => p.isActive).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.roastLevel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.referenceProfileId?.message} />
      </FieldGroup>

      {/* ── Berat Masuk ── */}
      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Berat Green Bean masuk (kg) <span className="text-red-500">*</span>
        </Label>
        <Input
          type="number"
          step="0.001"
          min="0"
          placeholder="0.000"
          className={cn("h-9 tabular-nums font-semibold", glassInput)}
          {...register("targetWeightKg", { valueAsNumber: true })}
        />
        {selectedGB && Number(targetWeightKg) > selectedGB.stockKg && (
          <p className="text-xs font-medium text-red-500">
            Melebihi stok tersedia ({formatKg(selectedGB.stockKg)})
          </p>
        )}
        {selectedMachine?.capacityKg && Number(targetWeightKg) > Number(selectedMachine.capacityKg) && (
          <p className="text-xs font-medium text-amber-600">
            Target {formatKg(Number(targetWeightKg))} melebihi kapasitas mesin {formatKg(Number(selectedMachine.capacityKg))}. Pastikan batch ini memang akan dilakukan dalam beberapa charge atau sesuaikan jumlah.
          </p>
        )}
        <FieldError message={errors.targetWeightKg?.message} />
      </FieldGroup>

      <Separator className="bg-white/50" />

      {/* Operator chooses the roast fact; product identity is inherited from GB. */}
      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Roast Level <span className="text-red-500">*</span>
        </Label>
        <Controller
          control={control}
          name="outputRoastLevel"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(val: string | null) => field.onChange(val ?? "")}>
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih level roasting...">
                  {field.value ? (ROAST_LEVEL_LABELS[field.value] ?? field.value) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {buildRoastLevelOptions().map((level) => (
                  <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.outputRoastLevel?.message} />
        {selectedGB && outputRoastLevel && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700">
            <span className="font-semibold">
              {outputRoastLevel in ROAST_LEVEL_LABELS
                ? roastedBeanName(selectedGB.name, outputRoastLevel as RoastLevelValue)
                : `${greenBeanIdentity(selectedGB.name)} · ${outputRoastLevel}`}
            </span>
            <span className="ml-1 text-emerald-600">
              {automaticRb ? "dipakai otomatis" : "akan dibuat otomatis"}
            </span>
          </div>
        )}
      </FieldGroup>

      {/* ── Select existing RB ── */}
      {outputMode === "existing" && (
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Pilih Roasted Bean</Label>
          <Controller
            control={control}
            name="outputProductId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(val: string | null) => field.onChange(val ?? "")}
              >
                <SelectTrigger className={cn("w-full h-9", glassInput)}>
                  <SelectValue placeholder="Pilih produk RB...">
                    {field.value ? rankedRbOptions.find((r) => r.id === field.value)?.name : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {rankedRbOptions.length === 0 ? (
                    <SelectItem value="_empty" disabled>Belum ada produk Roasted Bean</SelectItem>
                  ) : (
                    rankedRbOptions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}{r.roastLevel ? ` — ${ROAST_LEVEL_LABELS[r.roastLevel] ?? r.roastLevel}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.outputProductId?.message} />
        </FieldGroup>
      )}

      {/* ── New RB product ── */}
      {outputMode === "new" && (
        <div className={cn(glassCard, "space-y-4")}>
          <FieldGroup>
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Nama Roasted Bean <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="e.g. Gayo Natural Medium"
              className={cn("h-9 font-medium", glassInput)}
              {...register("outputProductName")}
            />
            <FieldError message={errors.outputProductName?.message} />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-4">
            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Origin</Label>
              <Input
                placeholder="e.g. Aceh Gayo"
                className={cn("h-9", glassInput)}
                {...register("outputProductOrigin")}
              />
            </FieldGroup>

            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Roast Level</Label>
              <Controller
                control={control}
                name="outputRoastLevel"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val: string | null) => field.onChange(val ?? "")}
                  >
                    <SelectTrigger className={cn("w-full h-9", glassInput)}>
                      <SelectValue placeholder="Pilih level...">
                        {field.value ? (ROAST_LEVEL_LABELS[field.value] ?? field.value) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {buildRoastLevelOptions().map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldGroup>
          </div>
        </div>
      )}

      {/* ── MANUAL MODE ONLY: Berat Keluar ── */}
      {mode === "MANUAL" && (
        <>
          <Separator className="bg-white/50" />
          <FieldGroup>
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Berat Roasted Bean keluar (kg) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.000"
              className={cn("h-9 tabular-nums font-semibold", glassInput)}
              {...register("actualOutputKg", { valueAsNumber: true })}
            />
            <FieldError message={errors.actualOutputKg?.message} />
          </FieldGroup>

          {/* ── Lokasi Hasil (opsional, default server dipilih otomatis) ── */}
          <Controller
            control={control}
            name="destinationLocationId"
            render={({ field }) => (
              <RoastingDestinationField
                value={field.value ?? ""}
                onChange={field.onChange}
                options={locationOptions}
              />
            )}
          />

          {/* ── Shrinkage kalkulasi realtime ── */}
          <ShrinkageDisplay
            input={Number(targetWeightKg) || 0}
            output={Number(actualOutputKg) || 0}
            recentLosses={recentComparableLosses}
          />
        </>
      )}

      {/* ── Catatan ── */}
      <button
        type="button"
        onClick={() => setShowAdvanced((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        Opsi lanjutan · Artisan & catatan
        <ChevronDown size={14} className={cn("transition-transform", showAdvanced && "rotate-180")} />
      </button>

      {showAdvanced && (
        <div className={cn(glassCard, "space-y-4")}>
          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Alur pencatatan
            </Label>
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange("MANUAL")}
                    className={cn(
                      "min-h-10 rounded-xl border px-3 text-xs font-semibold",
                      field.value === "MANUAL"
                        ? "border-domain-roasting bg-domain-roasting text-white"
                        : "border-white/60 bg-white/40 text-slate-600",
                    )}
                  >
                    Hasil sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("ARTISAN")}
                    className={cn(
                      "min-h-10 rounded-xl border px-3 text-xs font-semibold",
                      field.value === "ARTISAN"
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-white/60 bg-white/40 text-slate-600",
                    )}
                  >
                    Tunggu Artisan
                  </button>
                </div>
              )}
            />
            <p className="mt-2 text-xs leading-4 text-slate-500">
              {mode === "ARTISAN"
                ? "Green Bean dicadangkan sekarang; hasil akhir masuk otomatis dari Artisan."
                : "Green Bean keluar dan Roasted Bean masuk dalam satu penyimpanan."}
            </p>
          </div>

          <FieldGroup>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Catatan (opsional)</Label>
            <Textarea
              placeholder="Profil, kondisi mesin, atau hasil cupping"
              rows={2}
              className={cn("resize-none text-sm", glassInput)}
              {...register("notes")}
            />
          </FieldGroup>
        </div>
      )}

      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}
