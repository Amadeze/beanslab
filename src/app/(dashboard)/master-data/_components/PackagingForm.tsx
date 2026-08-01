"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPackaging, updatePackaging } from "../actions";
import type { PackagingRow } from "../actions";
import { cn } from "@/lib/utils";

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";

const schema = z.object({
  name:        z.string().min(1, "Nama kemasan wajib diisi"),
  weightGrams: z.number().min(1, "Berat kemasan harus lebih dari 0 gram"),
  costPerUnit: z.number().min(1, "Harga pokok per unit harus lebih dari 0"),
  isActive:    z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface PackagingFormProps {
  id: string;
  onSuccess: () => void;
  onPendingChange?: (isPending: boolean) => void;
  initialData?: PackagingRow;
}

export function PackagingForm({ id, onSuccess, onPendingChange, initialData }: PackagingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!initialData;

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? { 
          name: initialData.name, 
          weightGrams: initialData.weightGrams, 
          costPerUnit: initialData.costPerUnit, 
          isActive: initialData.isActive 
        }
      : { 
          name: "", 
          weightGrams: 0, 
          costPerUnit: 0, 
          isActive: true 
        },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    onPendingChange?.(true);
    try {
      const result = isEditMode
        ? await updatePackaging({ id: initialData!.id, ...values })
        : await createPackaging(values);
        
      if (!result.success) { 
        toastSafe.error(result.error); 
        return; 
      }
      toast.success(isEditMode ? `${result.code} berhasil diperbarui` : `Kemasan ${result.code} berhasil ditambahkan`);
      onSuccess();
    } catch (err) {
      console.error("[PackagingForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
        Kode dibuat otomatis. Semua field wajib diisi.
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Nama Kemasan <span className="text-red-500">*</span>
        </Label>
        <Input placeholder="Contoh: Zipper Bag 250g, Kraft Box 1kg" className={cn("h-9", glassInput)} {...register("name")} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white/40 p-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Berat Kemasan (gram) *</Label>
          <Input type="number" min="1" step="0.1" placeholder="Contoh: 12" className={cn("h-9", glassInput)} {...register("weightGrams", { valueAsNumber: true })} />
          {errors.weightGrams && <p className="text-xs text-red-500">{errors.weightGrams.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Harga Pokok per Unit (Rp) *</Label>
          <Input type="number" min="1" placeholder="Contoh: 2000" className={cn("h-9 font-semibold", glassInput)} {...register("costPerUnit", { valueAsNumber: true })} />
          {errors.costPerUnit && <p className="text-xs text-red-500">{errors.costPerUnit.message}</p>}
        </div>
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
