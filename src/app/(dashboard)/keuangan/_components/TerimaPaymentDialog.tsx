"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Loader2, CreditCard, Banknote, QrCode, Clock } from "lucide-react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatRupiah } from "@/lib/format";
import { recordPayment, type PiutangRow } from "../actions";
import { getCurrentDate, getTodayString } from "@/lib/date-utils";

// =============================================================================
// Schema
// =============================================================================

const schema = z.object({
  amount:    z.number().positive("Nominal harus > 0"),
  method:    z.enum(["CASH", "TRANSFER", "QRIS", "CREDIT"]),
  paidAt:    z.string().min(1, "Pilih tanggal"),
  bankName:  z.string().optional(),
  reference: z.string().optional(),
  notes:     z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// =============================================================================
// Payment method pills
// =============================================================================

const METHODS = [
  { value: "CASH",     label: "Tunai",    icon: Banknote  },
  { value: "TRANSFER", label: "Transfer", icon: CreditCard },
  { value: "QRIS",     label: "QRIS",     icon: QrCode    },
  { value: "CREDIT",   label: "Cicilan",  icon: Clock     },
] as const;

// =============================================================================
// Props
// =============================================================================

interface TerimaPaymentDialogProps {
  invoice: PiutangRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function TerimaPaymentDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: TerimaPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = getTodayString();

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
      amount:    0,
      method:    "TRANSFER",
      paidAt:    today,
      bankName:  "",
      reference: "",
      notes:     "",
    },
  });

  // Reset form with correct balance every time a new invoice is opened
  useEffect(() => {
    if (invoice && open) {
      reset({
        amount:    invoice.balance,
        method:    "TRANSFER",
        paidAt:    today,
        bankName:  "",
        reference: "",
        notes:     "",
      });
    }
  // Intentional: only reset form when invoice changes or dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, open]);

  const method  = watch("method");
  const amount  = watch("amount");
  const balance = invoice?.balance ?? 0;

  const onSubmit = async (values: FormValues) => {
    if (!invoice) return;
    setIsSubmitting(true);
    try {
      const result = await recordPayment({
        invoiceId:  invoice.id,
        amount:     values.amount,
        method:     values.method,
        paidAt:     values.paidAt,
        bankName:   values.bankName || undefined,
        reference:  values.reference || undefined,
        notes:      values.notes || undefined,
      });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }

      const statusLabel = result.newStatus === "PAID" ? "Nota LUNAS ✔" : "Pembayaran sebagian tercatat";
      toast.success(`${result.paymentCode} · ${statusLabel}`);
      reset();
      onSuccess();
    } catch (err) {
      console.error("[TerimaPaymentDialog]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!invoice) return null;

  const isFullPayment = Number(amount) >= balance - 0.01;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v); }}>
      <DialogContent showCloseButton={!isSubmitting}>

        <DialogHeader>
          <DialogTitle>Terima Pembayaran</DialogTitle>
          <DialogDescription>
            Nota <span className="font-mono font-semibold">{invoice.code}</span>
            {" · "}{invoice.customerName}
          </DialogDescription>
        </DialogHeader>

        {/* Invoice balance summary */}
        <div className="grid grid-cols-3 divide-x divide-white/20 border-b border-white/20 bg-white/20 backdrop-blur-sm">
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Total Nota
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-800">
              {formatRupiah(invoice.grandTotal)}
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Terbayar
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold text-emerald-700">
              {formatRupiah(invoice.paidAmount)}
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Sisa Tagihan
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold text-amber-700">
              {formatRupiah(balance)}
            </p>
          </div>
        </div>

        <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-5 py-4">

          {/* Nominal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-zinc-700">
                Nominal Diterima <span className="text-red-500">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setValue("amount", balance, { shouldValidate: true })}
                className="text-[11px] font-medium text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
              >
                Lunaskan semua ({formatRupiah(balance)})
              </button>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
                Rp
              </span>
              <Input
                type="number"
                step="1"
                min="1"
                placeholder={String(balance)}
                className="h-10 pl-8 text-right tabular-nums font-semibold text-sm bg-white/40 border-white/60 focus:bg-white/60 backdrop-blur-md"
                {...register("amount", { valueAsNumber: true })}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount.message}</p>
            )}
            {/* Preview: will this pay off the invoice? */}
            {Number(amount) > 0 && (
              <p className={`text-[11px] font-medium ${isFullPayment ? "text-emerald-600" : "text-amber-800"}`}>
                {isFullPayment
                  ? "✔ Nota akan berstatus LUNAS setelah pembayaran ini"
                  : `Sisa tagihan setelah ini: ${formatRupiah(balance - Number(amount))}`}
              </p>
            )}
          </div>

          {/* Tanggal */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">
              Tanggal Diterima <span className="text-red-500">*</span>
            </Label>
            <Input type="date" max={today} className="h-9 bg-white/40 border-white/60 focus:bg-white/60 backdrop-blur-md" {...register("paidAt")} />
            {errors.paidAt && <p className="text-xs text-red-500">{errors.paidAt.message}</p>}
          </div>

          {/* Metode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">
              Metode Pembayaran <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = field.value === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => field.onChange(m.value)}
                        className={[
                          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
                        ].join(" ")}
                      >
                        <Icon size={11} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          {/* Bank Penerima + Referensi (only for TRANSFER) */}
          {method === "TRANSFER" && (
            <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700">Bank Penerima</Label>
                <Input
                  placeholder="BCA, Mandiri, BNI, dll."
                  className="h-8 bg-white text-sm"
                  {...register("bankName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700">No. Referensi / Nama Pengirim</Label>
                <Input
                  placeholder="Nomor TRX atau nama pengirim"
                  className="h-8 bg-white text-sm"
                  {...register("reference")}
                />
              </div>
            </div>
          )}

          {/* Referensi for QRIS */}
          {method === "QRIS" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-700">No. Referensi QRIS (opsional)</Label>
              <Input
                placeholder="Kode transaksi QRIS"
                className="h-8 text-sm"
                {...register("reference")}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Catatan (opsional)</Label>
            <Input
              placeholder="Catatan tambahan..."
              className="h-8 text-sm"
              {...register("notes")}
            />
          </div>
        </form>

        <Separator />

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="outline"
                className="border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                disabled={isSubmitting}
              />
            }
          >
            Batal
          </DialogClose>
          <Button
            type="submit"
            form="payment-form"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5 rounded-[9px] bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : "Catat Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
