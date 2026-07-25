"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { receivePOAction } from "../po-actions";
import { cn } from "@/lib/utils";

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";

// =============================================================================
// Schema
// =============================================================================

const schema = z.object({
  receivedAt: z.string().min(1, "Tanggal penerimaan wajib diisi"),
  items: z.array(z.object({
    poItemId: z.string(),
    receivedQuantity: z.number().min(0, "Quantity tidak boleh negatif"),
    notes: z.string().optional(),
  })),
});

type FormValues = z.infer<typeof schema>;

// =============================================================================
// Props
// =============================================================================

interface ReceivePOFormProps {
  poId: string;
  items: Array<{
    id: string;
    productName: string | null;
    packagingName: string | null;
    quantity: number;
  }>;
  onSuccess: () => void;
  onCancel: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ReceivePOForm({ poId, items, onSuccess, onCancel }: ReceivePOFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      receivedAt: new Date().toISOString().split("T")[0],
      items: items.map((item) => ({
        poItemId: item.id,
        receivedQuantity: item.quantity, // Default to ordered quantity
        notes: "",
      })),
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // Filter out items with 0 received quantity
      const validItems = data.items.filter((item) => item.receivedQuantity > 0);

      if (validItems.length === 0) {
        toast.error("Minimal 1 item harus diterima.");
        return;
      }

      const result = await receivePOAction(poId, {
        receivedAt: data.receivedAt,
        items: validItems,
      });

      if (result.success) {
        toast.success(`Berhasil menerima barang. Kode Purchase: ${result.purchaseCodes?.join(", ")}`);
        onSuccess();
      } else {
        toastSafe.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Tanggal Penerimaan */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Tanggal Penerimaan *
        </Label>
        <Input
          type="date"
          className={cn("h-9", glassInput)}
          {...register("receivedAt")}
        />
        {errors.receivedAt && (
          <p className="text-[10px] text-red-500">{errors.receivedAt.message}</p>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Quantity Diterima
        </Label>
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/40 p-2">
            <div className="flex-1">
              <p className="text-xs font-medium">{item.productName || item.packagingName}</p>
              <p className="text-[10px] text-slate-400">Dipesan: {item.quantity}</p>
            </div>
            <input type="hidden" {...register(`items.${index}.poItemId`)} />
            <div className="w-24">
              <Input
                type="number"
                min="0"
                max={item.quantity}
                step="0.1"
                className={cn("h-8 text-xs", glassInput)}
                {...register(`items.${index}.receivedQuantity`, { valueAsNumber: true })}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <p className="text-[10px] text-slate-500 italic">
        Quantity diterima bisa kurang dari yang dipesan. Sisa akan menjadi status Partial.
      </p>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="bg-white/40 border-white/60">
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Proses Penerimaan"}
        </Button>
      </div>
    </form>
  );
}
