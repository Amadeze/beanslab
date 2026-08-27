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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customerInputSchema } from "@/lib/master-data-input";
import { cn } from "@/lib/utils";
import { createCustomer, updateCustomer } from "../actions";
import type { CreatedCustomer, CustomerRow } from "../actions";

type FormValues = z.infer<typeof customerInputSchema>;

interface CustomerFormProps {
  id: string;
  onSuccess: (customer?: CreatedCustomer) => void;
  onPendingChange?: (isPending: boolean) => void;
  initialData?: CustomerRow;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs font-medium text-red-600" role="alert">{message}</p> : null;
}

export function CustomerForm({ id, onSuccess, onPendingChange, initialData }: CustomerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = Boolean(initialData);
  const [showDetails, setShowDetails] = useState(
    Boolean(initialData?.email || initialData?.address || (initialData?.tier && initialData.tier !== "RETAIL")),
  );

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(customerInputSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          phone: initialData.phone ?? "",
          email: initialData.email ?? "",
          address: initialData.address ?? "",
          tier: initialData.tier,
          isActive: initialData.isActive,
        }
      : { name: "", phone: "", email: "", address: "", tier: "RETAIL", isActive: true },
  });

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onPendingChange?.(true);
    try {
      const result = isEditMode
        ? await updateCustomer({ id: initialData!.id, ...values })
        : await createCustomer(values);
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success(isEditMode ? `${result.code} berhasil diperbarui` : `${values.name.trim()} berhasil ditambahkan`);
      onSuccess(result.data);
    } catch (err) {
      console.error("[CustomerForm]", err);
      toast.error("Pelanggan belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
        Hanya nama yang diperlukan. Detail lain bisa ditambahkan kapan saja.
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`} className="text-xs font-semibold text-slate-700">Nama pelanggan</Label>
        <Input
          id={`${id}-name`}
          autoFocus
          autoComplete="organization"
          placeholder="Contoh: Kopi Senja"
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
        Email, alamat, dan harga grosir
        <ChevronDown size={15} className={cn("transition-transform", showDetails && "rotate-180")} />
      </button>

      {showDetails && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white/40 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-email`} className="text-xs font-medium text-slate-700">Email</Label>
            <Input id={`${id}-email`} type="email" inputMode="email" autoComplete="email" placeholder="halo@kopisenja.id" className="h-9" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-address`} className="text-xs font-medium text-slate-700">Alamat pengiriman</Label>
            <Textarea id={`${id}-address`} autoComplete="street-address" rows={2} placeholder="Alamat lengkap" {...register("address")} />
            <FieldError message={errors.address?.message} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700">Harga otomatis</Label>
            <Controller
              control={control}
              name="tier"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="WHOLESALE_SILVER">Grosir Silver</SelectItem>
                    <SelectItem value="WHOLESALE_GOLD">Grosir Gold</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-[11px] text-slate-500">Harga produk akan terisi sesuai pilihan saat membuat nota.</p>
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
