"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/lib/format";
import { recordSupplierPayment, type PurchaseRow } from "../actions";
import { getCurrentDate, getTodayString } from "@/lib/date-utils";

const schema = z.object({
  amount: z.number().positive("Nominal harus lebih dari 0"),
  method: z.enum(["CASH", "TRANSFER", "QRIS"]),
  paidAt: z.string().min(1, "Tanggal wajib diisi"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SupplierPaymentDialog({
  purchase,
  open,
  onOpenChange,
  onSuccess,
}: {
  purchase: PurchaseRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const opKeyRef = useRef<string>("");
  const today = getTodayString();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0,
      method: "TRANSFER",
      paidAt: today,
      reference: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (purchase && open) {
      opKeyRef.current = crypto.randomUUID();
      reset({
        amount: purchase.balance,
        method: "TRANSFER",
        paidAt: today,
        reference: "",
        notes: "",
      });
    }
  }, [open, purchase, reset, today]);

  if (!purchase) return null;

  const amount = Number(watch("amount") || 0);
  const submit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const result = await recordSupplierPayment({
        operationKey: opKeyRef.current,
        purchaseId: purchase.id,
        ...values,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      });
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success(`Pembayaran supplier tercatat`);
      onSuccess();
    } catch (err) {
      console.error("[SupplierPaymentDialog]", err);
      toast.error("Terjadi kesalahan saat mencatat pembayaran supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bayar Supplier</DialogTitle>
          <DialogDescription>
            {purchase.code} · {purchase.supplierName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 border-y border-white/50 bg-white/20 px-5 py-3 text-center">
          <div>
            <p className="text-[10px] uppercase text-slate-400">Total</p>
            <p className="font-mono text-sm font-bold">{formatRupiah(purchase.totalCost)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400">Terbayar</p>
            <p className="font-mono text-sm font-bold text-emerald-700">{formatRupiah(purchase.paidAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400">Sisa</p>
            <p className="font-mono text-sm font-bold text-amber-700">{formatRupiah(purchase.balance)}</p>
          </div>
        </div>

        <form id="supplier-payment-form" onSubmit={handleSubmit(submit)} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Nominal</Label>
              <button
                type="button"
                className="text-xs text-amber-800 hover:underline"
                onClick={() => setValue("amount", purchase.balance, { shouldValidate: true })}
              >
                Lunaskan
              </button>
            </div>
            <Input type="number" min="1" step="1" {...register("amount", { valueAsNumber: true })} />
            {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
            {amount > 0 && amount < purchase.balance && (
              <p className="text-xs text-amber-700">Sisa setelah pembayaran: {formatRupiah(purchase.balance - amount)}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal Bayar</Label>
              <Input type="date" max={today} {...register("paidAt")} />
            </div>
            <div className="space-y-1.5">
              <Label>Metode</Label>
              <select className="h-9 w-full rounded-md border border-white/60 bg-white/40 px-3 text-sm" {...register("method")}>
                <option value="TRANSFER">Transfer</option>
                <option value="CASH">Tunai</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Referensi</Label>
            <Input placeholder="Nomor transfer atau bukti bayar" {...register("reference")} />
          </div>
          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Input placeholder="Opsional" {...register("notes")} />
          </div>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={submitting} />}>Batal</DialogClose>
          <Button type="submit" form="supplier-payment-form" disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Catat Pembayaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
