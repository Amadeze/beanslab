"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Banknote, Building2, CalendarClock, RotateCcw, Trash2 } from "lucide-react";
import { receivePOAction } from "../po-actions";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";

const glassInput = "bg-card/40 border-white/60 backdrop-blur-md transition-all focus:bg-card/60 focus:border-white/80";

function addDaysDateString(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// =============================================================================
// Schema
// =============================================================================

const schema = z.object({
  receivedAt: z.string().min(1, "Tanggal penerimaan wajib diisi"),
  shippingCost: z.number().min(0, "Ongkir tidak boleh negatif"),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CREDIT"]),
  dueDate: z.string().optional(),
  items: z.array(z.object({
    poItemId: z.string(),
    receivedQuantity: z.number().min(0, "Quantity tidak boleh negatif"),
    notes: z.string().optional(),
  })),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === "CREDIT" && !data.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Tanggal jatuh tempo wajib diisi" });
  }
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
    receivedQuantity: number;
    remainingQuantity: number;
    unitPrice: number;
  }>;
  estimatedShippingCost?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ReceivePOForm({ poId, items, estimatedShippingCost = 0, onSuccess, onCancel }: ReceivePOFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [excludedItemIds, setExcludedItemIds] = useState<Set<string>>(() => new Set());
  const today = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      receivedAt: today,
      shippingCost: estimatedShippingCost,
      paymentMethod: "CREDIT",
      dueDate: addDaysDateString(today, 14),
      items: items.map((item) => ({
        poItemId: item.id,
        receivedQuantity: item.remainingQuantity,
        notes: "",
      })),
    },
  });
  const receiptItems = watch("items") ?? [];
  const shippingCost = Number(watch("shippingCost")) || 0;
  const paymentMethod = watch("paymentMethod");
  const receivedAt = watch("receivedAt");
  const itemTotal = receiptItems.reduce(
    (sum, item, index) => sum + (Number(item.receivedQuantity) || 0) * items[index].unitPrice,
    0,
  );

  const excludeItem = (itemId: string, index: number) => {
    setValue(`items.${index}.receivedQuantity`, 0, { shouldDirty: true, shouldValidate: true });
    setExcludedItemIds((current) => new Set(current).add(itemId));
  };

  const restoreItem = (itemId: string, index: number) => {
    setValue(`items.${index}.receivedQuantity`, items[index].remainingQuantity, { shouldDirty: true, shouldValidate: true });
    setExcludedItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  };

  useEffect(() => {
    if (paymentMethod === "CREDIT" && receivedAt) {
      setValue("dueDate", addDaysDateString(receivedAt, 14), { shouldValidate: true });
    }
  }, [paymentMethod, receivedAt, setValue]);

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
        shippingCost: data.shippingCost,
        paymentMethod: data.paymentMethod,
        dueDate: data.paymentMethod === "CREDIT" ? data.dueDate : undefined,
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
            Tanggal Penerimaan *
          </Label>
          <Input
            type="date"
            className={cn("h-9", glassInput)}
            {...register("receivedAt")}
          />
          {errors.receivedAt && (
            <p className="text-xs text-[var(--status-danger)]">{errors.receivedAt.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
            Ongkir Aktual <span className="font-medium normal-case tracking-normal text-ink-tertiary">(opsional)</span>
          </Label>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            className={cn("h-9 tabular-nums", glassInput)}
            {...register("shippingCost", { valueAsNumber: true })}
          />
          <p className="text-xs text-ink-tertiary">Terisi dari estimasi PO, boleh dikoreksi.</p>
          {errors.shippingCost && (
            <p className="text-xs text-[var(--status-danger)]">{errors.shippingCost.message}</p>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
          Quantity Diterima
        </Label>
        {items.map((item, index) => (
          excludedItemIds.has(item.id) ? null : <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/60 bg-card/40 p-2">
            <div className="flex-1">
              <p className="text-xs font-medium">{item.productName || item.packagingName}</p>
              <p className="text-xs text-ink-tertiary">
                Dipesan {item.quantity} · sudah {item.receivedQuantity} · sisa {item.remainingQuantity}
              </p>
            </div>
            <input type="hidden" {...register(`items.${index}.poItemId`)} />
            <div className="w-24">
              <Input
                type="number"
                min="0"
                max={item.remainingQuantity}
                step={item.productName ? "0.001" : "1"}
                className={cn("h-8 text-xs", glassInput)}
                {...register(`items.${index}.receivedQuantity`, { valueAsNumber: true })}
                disabled={item.remainingQuantity <= 0}
              />
            </div>
            <button
              type="button"
              onClick={() => excludeItem(item.id, index)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]"
              aria-label={`Tidak terima ${item.productName || item.packagingName}`}
              title="Tidak diterima sekarang"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {excludedItemIds.size > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface-sunken/70 px-3 py-2.5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-tertiary">
            Tidak diterima sekarang
          </p>
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => excludedItemIds.has(item.id) ? (
              <button
                key={item.id}
                type="button"
                onClick={() => restoreItem(item.id, index)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:border-[var(--status-success)]/30 hover:text-[var(--status-success)]"
              >
                <RotateCcw size={12} /> {item.productName || item.packagingName}
              </button>
            ) : null)}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-ink-tertiary">
          Pembayaran
        </Label>
        <input type="hidden" {...register("paymentMethod")} />
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "CASH", label: "Tunai", icon: Banknote },
            { value: "TRANSFER", label: "Transfer", icon: Building2 },
            { value: "CREDIT", label: "Piutang", icon: CalendarClock },
          ] as const).map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue("paymentMethod", option.value, { shouldDirty: true, shouldValidate: true })}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-bold transition-colors",
                  paymentMethod === option.value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-white/60 bg-card/40 text-ink hover:bg-card/70",
                )}
              >
                <Icon size={15} /> {option.label}
              </button>
            );
          })}
        </div>
        {paymentMethod === "CREDIT" && (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-ink-tertiary">
              Jatuh Tempo
            </Label>
            <Input type="date" className={cn("h-9", glassInput)} {...register("dueDate")} />
            {errors.dueDate && <p className="text-xs text-[var(--status-danger)]">{errors.dueDate.message}</p>}
          </div>
        )}
        <p className="text-xs text-ink-tertiary">
          {paymentMethod === "CREDIT"
            ? "Dicatat sebagai utang supplier sampai dibayar."
            : `Dicatat lunas melalui ${paymentMethod === "CASH" ? "kas" : "transfer bank"}.`}
        </p>
      </div>

      {/* Info */}
      <p className="text-xs text-ink-tertiary italic">
        Quantity diterima bisa kurang dari yang dipesan. Sisa akan menjadi status Partial.
      </p>

      <div className="rounded-xl border border-[var(--status-success)]/30 bg-[var(--status-success)]/10/80 px-3 py-2.5 text-right">
        <p className="text-xs text-[var(--status-success)]">
          Barang {formatRupiah(itemTotal)} + ongkir {formatRupiah(shippingCost)}
        </p>
        <p className="text-sm font-black text-[var(--status-success)]">
          Total diterima {formatRupiah(itemTotal + shippingCost)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="bg-card/40 border-white/60">
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Proses Penerimaan"}
        </Button>
      </div>
    </form>
  );
}
