"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StandardDrawer } from "@/components/StandardDrawer";
import { createExpense } from "../actions";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { getCurrentDate, getTodayString } from "@/lib/date-utils";

const CATEGORIES = [
  { value: "UTILITAS",    label: "Utilitas (Listrik, Air, Internet)" },
  { value: "OPERASIONAL", label: "Operasional (Sewa, Bahan Habis Pakai)" },
  { value: "GAJI",        label: "Gaji & Tunjangan" },
  { value: "LAINNYA",     label: "Lainnya" },
] as const;

const schema = z.object({
  date:        z.string().min(1, "Tanggal wajib diisi"),
  category:    z.enum(["UTILITAS", "OPERASIONAL", "GAJI", "LAINNYA"] as const),
  amount:      z.number({ error: "Nominal harus angka" }).positive("Nominal harus lebih dari 0"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CatatPengeluaranDrawer({ open, onOpenChange }: Props) {
  const today = getTodayString();
  const [submitting, setSubmitting]       = useState(false);
  const [selectedCat, setSelectedCat]     = useState<string>("");
  const opKeyRef                          = useRef<string>("");

  useEffect(() => {
    if (open) {
      opKeyRef.current = crypto.randomUUID();
    }
  }, [open]);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: today, amount: undefined },
  });

  const close = () => {
    reset();
    setSelectedCat("");
    onOpenChange(false);
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const result = await createExpense({
        operationKey: opKeyRef.current,
        date:        data.date,
        category:    data.category,
        amount:      data.amount,
        description: data.description,
      });
      if (!result.success) { toastSafe.error(result.error); return; }
      toast.success("Pengeluaran berhasil dicatat.");
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StandardDrawer
      open={open}
      onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}
      title="Catat Pengeluaran"
      description="Catat pengeluaran operasional (OPEX) untuk kalkulasi laba bersih."
      submitButton={
        <Button
          type="button"
          disabled={submitting}
          variant="destructive"
          className="min-w-[120px]"
          onClick={() => handleSubmit(onSubmit)()}
        >
          {submitting ? "Menyimpan..." : "Simpan Pengeluaran"}
        </Button>
      }
    >
      <form className="space-y-5">
        {/* Tanggal */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">
            Tanggal <span className="text-red-500">*</span>
          </Label>
          <Input type="date" className="h-10 text-sm" {...register("date")} />
          {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
        </div>

        {/* Kategori */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">
            Kategori <span className="text-red-500">*</span>
          </Label>
          <Select
            value={selectedCat}
            onValueChange={(v) => {
              setSelectedCat(v ?? "");
              setValue("category", v as FormValues["category"], { shouldValidate: true });
            }}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder="Pilih kategori pengeluaran">
                {selectedCat ? CATEGORIES.find((c) => c.value === selectedCat)?.label : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && <p className="text-xs text-red-500">Pilih kategori</p>}
        </div>

        {/* Nominal */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">
            Nominal (Rp) <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">Rp</span>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="0"
              className="h-10 pl-8 text-right tabular-nums font-semibold text-sm"
              {...register("amount", { valueAsNumber: true })}
            />
          </div>
          {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
        </div>

        {/* Keterangan */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">Keterangan</Label>
          <Textarea
            rows={3}
            placeholder="Deskripsi pengeluaran (opsional)..."
            className="text-sm resize-none"
            {...register("description")}
          />
        </div>
      </form>
    </StandardDrawer>
  );
}

