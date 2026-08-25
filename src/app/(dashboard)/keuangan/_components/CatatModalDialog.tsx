"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Loader2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { recordCapitalInjection, recordOwnerWithdrawal } from "../actions";
import { getCurrentDate, getTodayString } from "@/lib/date-utils";

const setoranSchema = z.object({
  amount: z.number({ error: "Nominal harus angka" }).positive("Nominal harus lebih dari 0"),
  description: z.string().optional(),
  transactionDate: z.string().min(1, "Tanggal wajib diisi"),
});

type SetoranForm = z.infer<typeof setoranSchema>;

interface CatatModalDialogProps {
  type: "INJECTION" | "WITHDRAWAL";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CatatModalDialog({ type, open, onOpenChange, onSuccess }: CatatModalDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SetoranForm>({
    resolver: zodResolver(setoranSchema),
    defaultValues: {
      amount: undefined,
      description: "",
      transactionDate: getTodayString(),
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        amount: undefined,
        description: "",
        transactionDate: getTodayString(),
      });
      setOperationKey(crypto.randomUUID());
    }
  }, [open, reset]);

  const isSetoran = type === "INJECTION";

  const onSubmit = async (data: SetoranForm) => {
    setSubmitting(true);
    try {
      const action = isSetoran ? recordCapitalInjection : recordOwnerWithdrawal;
      const result = await action({
        type,
        amount: data.amount,
        description: data.description || undefined,
        transactionDate: data.transactionDate,
        operationKey,
      });

      if (result.success) {
        toast.success(isSetoran ? "Tambahan modal berhasil dicatat" : "Prive berhasil dicatat");
        onSuccess();
        onOpenChange(false);
      } else {
        toastSafe.error(result.error || "Gagal mencatat transaksi");
      }
    } catch {
      toastSafe.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = isSetoran ? "Tambah Modal" : "Catat Prive (Penarikan Pemilik)";
  const description = isSetoran
    ? "Catat tambahan setoran modal dari pemilik ke kas roastery."
    : "Catat penarikan modal oleh pemilik (prive) untuk keperluan pribadi.";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSetoran ? <Plus size={18} className="text-[var(--status-success)]" /> : <Minus size={18} className="text-[var(--status-danger)]" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Nominal (Rp)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-secondary font-medium">Rp</span>
              <Input
                id="amount"
                type="number"
                min={1}
                step="any"
                inputMode="numeric"
                className="pl-10"
                placeholder="0"
                {...register("amount", { valueAsNumber: true })}
              />
            </div>
            {errors.amount && <p className="text-xs text-[var(--status-danger)]">{errors.amount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="transactionDate">Tanggal</Label>
            <Input
              id="transactionDate"
              type="date"
              max={getTodayString()}
              {...register("transactionDate")}
            />
            {errors.transactionDate && <p className="text-xs text-[var(--status-danger)]">{errors.transactionDate.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Keterangan (opsional)</Label>
            <Textarea
              id="description"
              placeholder={isSetoran ? "Contoh: Setoran modal tambahan untuk beli mesin roasting baru" : "Contoh: Penarikan untuk keperluan pribadi"}
              rows={2}
              {...register("description")}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={isSetoran ? "default" : "destructive"}
              disabled={submitting}
              className="gap-1.5"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {isSetoran ? "Simpan Setoran" : "Catat Prive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
