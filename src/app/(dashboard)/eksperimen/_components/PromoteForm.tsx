"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
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
import { formatRupiah } from "@/lib/format";
import { promoteExperimentalToCatalog } from "../promote-actions";
import type { ExperimentalProductionRow } from "../actions";

const schema = z.object({
  experimentalProductionId: z.string(),
  code: z.string().min(1, "SKU wajib diisi"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  category: z.string().optional(),
  price: z.coerce.number().nonnegative().optional(),
  priceSilver: z.coerce.number().nonnegative().optional(),
  priceGold: z.coerce.number().nonnegative().optional(),
  netWeightGrams: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500">{message}</p>;
}

interface PromoteFormProps {
  batch: ExperimentalProductionRow;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PromoteForm({ batch, onSuccess, onCancel }: PromoteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      experimentalProductionId: batch.id,
      code: batch.outputProductName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20),
      name: batch.outputProductName,
      category: "",
      price: 0,
      priceSilver: 0,
      priceGold: 0,
      netWeightGrams: 0,
      notes: batch.notes ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await promoteExperimentalToCatalog({
        experimentalProductionId: values.experimentalProductionId,
        code: values.code,
        name: values.name,
        category: values.category || undefined,
        price: values.price || undefined,
        priceSilver: values.priceSilver || undefined,
        priceGold: values.priceGold || undefined,
        netWeightGrams: values.netWeightGrams || undefined,
        notes: values.notes,
      });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }

      toast.success(`Produk dipromosikan ke katalog — ${result.productCode}`);
      reset();
      onSuccess();
    } catch (err) {
      console.error("[PromoteForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form id="promote-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">
      <div className={cn("rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm space-y-3")}>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Data Eksperimen</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Nama Batch</p>
            <p className="font-semibold text-slate-900">{batch.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Output</p>
            <p className="font-semibold text-slate-900">{batch.outputProductName}</p>
          </div>
          <div>
            <p className="text-slate-500">Berat Hasil</p>
            <p className="font-semibold text-slate-900">{batch.outputKg.toFixed(3)} kg</p>
          </div>
          <div>
            <p className="text-slate-500">HPP/kg</p>
            <p className="font-semibold text-slate-900">{formatRupiah(batch.hppPerUnit)}</p>
          </div>
        </div>
      </div>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          SKU / Kode <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="e.g. FG-BLEND-250"
          className={cn("h-9 font-mono font-semibold", glassInput)}
          {...register("code")}
        />
        <FieldError message={errors.code?.message} />
      </FieldGroup>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Nama Produk <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="Nama final produk katalog"
          className={cn("h-9 font-medium", glassInput)}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </FieldGroup>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Kategori</Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(val: string | null) => field.onChange(val ?? "")}>
              <SelectTrigger className={cn("w-full h-9", glassInput)}>
                <SelectValue placeholder="Pilih kategori..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SINGLE_ORIGIN">Single Origin</SelectItem>
                <SelectItem value="BLEND">Blend</SelectItem>
                <SelectItem value="SPECIALTY">Specialty</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                <SelectItem value="EXPERIMENTAL">Experimental</SelectItem>
                <SelectItem value="OTHER">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </FieldGroup>

      <Separator className="bg-white/50" />

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Retail</Label>
          <Input
            type="number"
            step="1000"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("price", { valueAsNumber: true })}
          />
        </FieldGroup>

        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Silver</Label>
          <Input
            type="number"
            step="1000"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("priceSilver", { valueAsNumber: true })}
          />
        </FieldGroup>

        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Gold</Label>
          <Input
            type="number"
            step="1000"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("priceGold", { valueAsNumber: true })}
          />
        </FieldGroup>

        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Net Weight (gram)</Label>
          <Input
            type="number"
            step="1"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums font-semibold", glassInput)}
            {...register("netWeightGrams", { valueAsNumber: true })}
          />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Catatan</Label>
        <Textarea
          placeholder="Catatan tambahan untuk produk katalog"
          rows={2}
          className={cn("resize-none text-sm", glassInput)}
          {...register("notes")}
        />
      </FieldGroup>

      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}
