"use client";

import { useState } from "react";
import { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";

interface PurchasePaymentSectionProps {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors;
  paymentStatus: string;
}

export function PurchasePaymentSection({
  register,
  setValue,
  errors,
  paymentStatus,
}: PurchasePaymentSectionProps) {
  const [showNotes, setShowNotes] = useState(false);
  const paymentOptions = [
    { value: "PAID", label: "Sudah dibayar" },
    { value: "PARTIAL", label: "Bayar sebagian" },
    { value: "UNPAID", label: "Bayar nanti" },
  ] as const;

  return (
    <>
      <Separator className="bg-white/50" />

      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Pembayaran
          </Label>
          <input type="hidden" {...register("paymentStatus")} />
          <div className="grid grid-cols-3 gap-2">
            {paymentOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue("paymentStatus", option.value, { shouldDirty: true, shouldValidate: true })}
                className={cn(
                  "min-h-10 rounded-xl border px-2 text-xs font-semibold transition-colors",
                  paymentStatus === option.value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-white/60 bg-white/40 text-slate-600 hover:bg-white/70"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {paymentStatus !== "UNPAID" && (
          <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Metode Pembayaran
          </Label>
          <select
            className={cn(
              "w-full h-9 rounded-lg border px-3 text-sm outline-none",
              glassInput
            )}
            {...register("paymentMethod")}
          >
            <option value="CASH">Tunai</option>
            <option value="TRANSFER">Transfer</option>
            <option value="QRIS">QRIS</option>
          </select>
          </div>
        )}
      </div>

      {paymentStatus === "PARTIAL" && (
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Jumlah yang dibayar sekarang
          </Label>
          <Input
            type="number"
            min="1"
            step="1"
            className={cn("h-9 tabular-nums", glassInput)}
            {...register("initialPaidAmount", { valueAsNumber: true })}
          />
          {errors.initialPaidAmount && (
            <p className="text-xs text-red-500">
              {typeof errors.initialPaidAmount.message === "string"
                ? errors.initialPaidAmount.message
                : ""}
            </p>
          )}
        </div>
      )}

      {paymentStatus !== "PAID" && (
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Jatuh tempo <span className="normal-case font-medium tracking-normal text-slate-400">(otomatis 14 hari)</span>
          </Label>
          <Input
            type="date"
            className={cn("h-9", glassInput)}
            {...register("dueDate")}
          />
          {errors.dueDate && (
            <p className="text-xs text-red-500">
              {typeof errors.dueDate.message === "string"
                ? errors.dueDate.message
                : ""}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowNotes((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        Tambah catatan (opsional)
        <ChevronDown size={14} className={cn("transition-transform", showNotes && "rotate-180")} />
      </button>

      {showNotes && (
        <Textarea
          placeholder="Kualitas, kondisi saat tiba, atau nomor nota"
          rows={2}
          className={cn("resize-none text-sm", glassInput)}
          {...register("notes")}
        />
      )}
    </>
  );
}
