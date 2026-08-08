"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Plus, Trash2 } from "lucide-react";
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
import {
  createExperimentalProduction,
  type RBStockOption,
  type SupplyOption,
  type FGProductOption,
  type ExperimentalComponentInput,
} from "../actions";

// =============================================================================
// Zod schema
// =============================================================================

const componentSchema = z.object({
  componentType: z.enum(["GREEN_BEAN", "ROASTED_BEAN", "SUPPLY", "PACKAGING"]),
  productId: z.string().optional(),
  supplyItemId: z.string().optional(),
  quantity: z.number().positive("> 0"),
  lotId: z.string().optional(),
  lotNumber: z.string().optional(),
  notes: z.string().optional(),
});

const schema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  components: z.array(componentSchema).min(1, "Minimal satu komponen"),
  outputKg: z.number().positive("Berat hasil harus lebih dari 0"),
  grindingCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
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
// Props
// =============================================================================

interface ExperimentalFormProps {
  id: string;
  rbOptions: RBStockOption[];
  supplyOptions: SupplyOption[];
  fgOptions: FGProductOption[];
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ExperimentalForm({
  id,
  rbOptions,
  supplyOptions,
  fgOptions,
  onSuccess,
  onPendingChange,
}: ExperimentalFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());

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
      name: "",
      components: [
        { componentType: "ROASTED_BEAN", productId: "", quantity: 0, notes: "" },
      ],
      outputKg: 0,
      grindingCost: 0,
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "components",
  });

  const [components, outputKg, grindingCost] = watch([
    "components",
    "outputKg",
    "grindingCost",
  ]);

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const result = await createExperimentalProduction({
        operationKey,
        name: values.name,
        components: values.components.map((c) => ({
          componentType: c.componentType,
          productId: c.productId,
          supplyItemId: c.supplyItemId,
          quantity: c.quantity,
          lotId: c.lotId,
          lotNumber: c.lotNumber,
          notes: c.notes,
        })),
        outputKg: values.outputKg,
        grindingCost: values.grindingCost,
        notes: values.notes,
      });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }

      toast.success(`Batch eksperimental dicatat — ${result.batchCode}`);
      reset();
      setOperationKey(crypto.randomUUID());
      onSuccess();
    } catch (err) {
      console.error("[ExperimentalForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Nama Eksperimen <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="e.g. Blend Trial #04, Competition Espresso Test"
          className={cn("h-9 font-medium", glassInput)}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </FieldGroup>

      <Separator className="bg-white/50" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Komponen <span className="text-red-500">*</span>
          </Label>
          <button
            type="button"
            onClick={() => append({ componentType: "ROASTED_BEAN", productId: "", quantity: 0, notes: "" })}
            className="flex items-center gap-1 rounded-lg border border-white/60 bg-white/30 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white/50 transition-colors shadow-sm"
          >
            <Plus size={14} /> Tambah
          </button>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => {
            const comp = components?.[index];
            const compType = comp?.componentType ?? "ROASTED_BEAN";
            const isBean = compType === "GREEN_BEAN" || compType === "ROASTED_BEAN";
            const selectedItem = isBean
              ? rbOptions.find((r) => r.id === comp?.productId)
              : supplyOptions.find((s) => s.id === comp?.supplyItemId);
            const neededQty = (Number(comp?.quantity) || 0);
            const isOverStock = selectedItem
              ? (isBean
                ? neededQty > (selectedItem as RBStockOption).stockKg
                : neededQty > (selectedItem as SupplyOption).stockQuantity)
              : false;

            return (
              <div
                key={field.id}
                className="relative flex flex-wrap sm:flex-nowrap items-start gap-4 rounded-xl border border-white/60 bg-white/40 backdrop-blur-md p-4 shadow-sm hover:shadow transition-all group"
              >
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

                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Tipe Bahan</Label>
                  <Controller
                    control={control}
                    name={`components.${index}.componentType`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value}
                        onValueChange={(val: string | null) => {
                          f.onChange(val ?? "");
                          setValue(`components.${index}.productId`, "");
                          setValue(`components.${index}.supplyItemId`, "");
                        }}
                      >
                        <SelectTrigger className={cn("h-9 text-xs font-medium", glassInput)}>
                          <SelectValue placeholder="Pilih tipe..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GREEN_BEAN">Green Bean</SelectItem>
                          <SelectItem value="ROASTED_BEAN">Roasted Bean</SelectItem>
                          <SelectItem value="SUPPLY">Supply / Ingredient</SelectItem>
                          <SelectItem value="PACKAGING">Packaging</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">
                    {isBean ? "Produk" : "Item Non-Kopi"}
                  </Label>
                  <Controller
                    control={control}
                    name={isBean ? `components.${index}.productId` : `components.${index}.supplyItemId`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value}
                        onValueChange={(val: string | null) => f.onChange(val ?? "")}
                      >
                        <SelectTrigger className={cn("h-9 text-xs font-medium", glassInput)}>
                          <SelectValue placeholder={isBean ? "Pilih produk..." : "Pilih item..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {(isBean ? rbOptions : supplyOptions).length === 0 ? (
                            <SelectItem value="_empty" disabled>Tidak ada tersedia</SelectItem>
                          ) : (
                            (isBean ? rbOptions : supplyOptions).map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                                {" "}
                                <span className="text-slate-400 font-normal">
                                  ({isBean ? formatKg((item as RBStockOption).stockKg) : `${(item as SupplyOption).stockQuantity} ${(item as SupplyOption).baseUnit}`})
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {selectedItem && (
                    <p className={`text-[10px] font-medium pt-1 ${isOverStock ? "text-red-500" : "text-slate-500"}`}>
                      Stok: {isBean ? formatKg((selectedItem as RBStockOption).stockKg) : `${(selectedItem as SupplyOption).stockQuantity} ${(selectedItem as SupplyOption).baseUnit}`}
                      {isOverStock && " — ⚠ melebihi stok"}
                    </p>
                  )}
                </div>

                <div className="w-36 shrink-0 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Qty (kg/unit)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      className={cn("h-9 tabular-nums font-semibold pr-8 text-slate-900", glassInput)}
                      {...register(`components.${index}.quantity`, { valueAsNumber: true })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                      {isBean ? "kg" : (supplyOptions.find((s) => s.id === comp?.supplyItemId)?.baseUnit ?? "unit")}
                    </span>
                  </div>
                  <FieldError message={errors.components?.[index]?.quantity?.message} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator className="bg-white/50" />

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Berat Hasil (kg) <span className="text-red-500">*</span>
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

        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Biaya Operasional (opsional)
          </Label>
          <Input
            type="number"
            step="1000"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("grindingCost", { valueAsNumber: true })}
          />
          <p className="text-[10px] text-slate-400">Listrik, gas, tenaga kerja</p>
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Catatan (opsional)</Label>
        <Textarea
          placeholder="Catatan batch, variasi blend, target rasa, dll."
          rows={3}
          className={cn("resize-none text-sm", glassInput)}
          {...register("notes")}
        />
      </FieldGroup>

      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}
