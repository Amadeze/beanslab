"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supplierInputSchema } from "@/lib/master-data-input";
import { cn } from "@/lib/utils";
import { createSupplier, updateSupplier } from "../actions";
import type { CreatedSupplier, SupplierRow } from "../actions";

type FormValues = z.infer<typeof supplierInputSchema>;

interface SupplierFormProps {
  id: string;
  onSuccess: (supplier?: CreatedSupplier) => void;
  onPendingChange?: (isPending: boolean) => void;
  initialData?: SupplierRow;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs font-medium text-red-600" role="alert">{message}</p> : null;
}

export function SupplierForm({ id, onSuccess, onPendingChange, initialData }: SupplierFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = Boolean(initialData);
  const [showDetails, setShowDetails] = useState(Boolean(initialData?.region || initialData?.address));

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(supplierInputSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          phone: initialData.phone ?? "",
          region: initialData.region ?? "",
          address: initialData.address ?? "",
          isActive: initialData.isActive,
        }
      : { name: "", phone: "", region: "", address: "", isActive: true },
  });

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onPendingChange?.(true);
    try {
      const result = isEditMode
        ? await updateSupplier({ id: initialData!.id, ...values })
        : await createSupplier(values);
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success(isEditMode ? `${result.code} berhasil diperbarui` : `${values.name.trim()} berhasil ditambahkan`);
      onSuccess(result.data);
    } catch (err) {
      console.error("[SupplierForm]", err);
      toast.error("Supplier belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
        Hanya nama yang diperlukan. Wilayah dan alamat bisa dilengkapi nanti.
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`} className="text-xs font-semibold text-slate-700">Nama supplier</Label>
        <Input
          id={`${id}-name`}
          autoFocus
          autoComplete="organization"
          placeholder="Contoh: Gayo Mandiri"
          aria-invalid={Boolean(errors.name)}
          className="h-10"
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-phone`} className="text-xs font-semibold text-slate-700">WhatsApp <span className="font-normal text-slate-400">(opsional)</span></Label>
        <Input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0812 3456 7890"
          aria-invalid={Boolean(errors.phone)}
          className="h-10"
          {...register("phone")}
        />
        <FieldError message={errors.phone?.message} />
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((value) => !value)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/60 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 transition hover:bg-white"
        aria-expanded={showDetails}
      >
        Wilayah asal dan alamat
        <ChevronDown size={15} className={cn("transition-transform", showDetails && "rotate-180")} />
      </button>

      {showDetails && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white/40 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-region`} className="text-xs font-medium text-slate-700">Wilayah asal kopi</Label>
            <Input id={`${id}-region`} placeholder="Gayo, Toraja, Flores" className="h-9" {...register("region")} />
            <FieldError message={errors.region?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-address`} className="text-xs font-medium text-slate-700">Alamat</Label>
            <Textarea id={`${id}-address`} autoComplete="street-address" rows={2} placeholder="Alamat lengkap" {...register("address")} />
            <FieldError message={errors.address?.message} />
          </div>
        </div>
      )}

      {isEditMode && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Status</Label>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex gap-2">
                {[
                  { value: true, label: "Aktif", activeClass: "border-emerald-300 bg-emerald-50 text-emerald-700" },
                  { value: false, label: "Nonaktif", activeClass: "border-slate-300 bg-slate-100 text-slate-600" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => field.onChange(option.value)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition",
                      field.value === option.value ? option.activeClass : "border-slate-200 bg-white text-slate-400",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
      )}

      <button type="submit" className="hidden" disabled={isSubmitting} aria-hidden="true" />
    </form>
  );
}
