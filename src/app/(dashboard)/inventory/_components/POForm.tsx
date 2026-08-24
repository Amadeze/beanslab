"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPO, updatePO, sendPOAction } from "../po-actions";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Schema
// =============================================================================

const itemSchema = z.object({
  productId: z.string().optional(),
  packagingId: z.string().optional(),
  supplyItemId: z.string().optional(),
  quantity: z.number().min(0, "Quantity harus lebih dari 0"),
  unitPrice: z.number().min(0, "Harga tidak boleh negatif"),
  reorderPoint: z.number().optional(),
  currentStock: z.number().optional(),
});

const schema = z.object({
  supplierId: z.string().min(1, "Supplier wajib dipilih"),
  expectedDate: z.string().optional(),
  estimatedShippingCost: z.number().min(0, "Estimasi ongkir tidak boleh negatif"),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Minimal 1 item"),
});

type FormValues = z.infer<typeof schema>;

// =============================================================================
// Props
// =============================================================================

interface POFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: {
    id: string;
    supplierId: string;
    expectedDate: string | null;
    estimatedShippingCost: number;
    notes: string | null;
    items: Array<{
      id?: string;
      productId: string | null;
      packagingId: string | null;
      supplyItemId: string | null;
      quantity: number;
      unitPrice: number;
      reorderPoint: number | null;
      currentStock: number | null;
    }>;
  };
  suppliers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; type: string; stockKg: number }>;
  packagings: Array<{ id: string; name: string; stockUnit: number }>;
  supplyItems?: Array<{ id: string; name: string; category: string; baseUnit: string }>;
  isReadOnly?: boolean;
  onAddSupplier?: () => void;
  preferredSupplierId?: string | null;
  /** Saran reorder (AI deterministik): prefill baris saat MEMBUAT PO baru. */
  suggestedItems?: Array<{
    productId?: string | null;
    packagingId?: string | null;
    supplyItemId?: string | null;
    quantity: number;
    reorderPoint?: number | null;
    currentStock?: number | null;
  }>;
}

// =============================================================================
// Component
// =============================================================================

export function POForm({
  onSuccess,
  onCancel,
  initialData,
  suppliers,
  products,
  packagings,
  isReadOnly = false,
  onAddSupplier,
  preferredSupplierId,
  supplyItems = [],
  suggestedItems,
}: POFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!initialData;
  const hasSuggestions = !isEditMode && !!suggestedItems && suggestedItems.length > 0;

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          supplierId: initialData.supplierId,
          expectedDate: initialData.expectedDate?.split("T")[0] ?? "",
          estimatedShippingCost: initialData.estimatedShippingCost ?? 0,
          notes: initialData.notes ?? "",
          items: initialData.items.map((item) => ({
            productId: item.productId ?? "",
            packagingId: item.packagingId ?? "",
            supplyItemId: item.supplyItemId ?? "",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            reorderPoint: item.reorderPoint ?? undefined,
            currentStock: item.currentStock ?? undefined,
          })),
        }
      : hasSuggestions
        ? {
            supplierId: "",
            expectedDate: "",
            estimatedShippingCost: 0,
            notes: "Draft otomatis dari saran reorder — lengkapi supplier & harga.",
            items: (suggestedItems ?? []).map((item) => ({
              productId: item.productId ?? "",
              packagingId: item.packagingId ?? "",
              supplyItemId: item.supplyItemId ?? "",
              quantity: item.quantity,
              unitPrice: 0,
              reorderPoint: item.reorderPoint ?? undefined,
              currentStock: item.currentStock ?? undefined,
            })),
          }
        : {
            supplierId: "",
            expectedDate: "",
            estimatedShippingCost: 0,
            notes: "",
            items: [{ productId: "", packagingId: "", supplyItemId: "", quantity: 0, unitPrice: 0 }],
          },
  });

  useEffect(() => {
    if (!isEditMode && preferredSupplierId && suppliers.some((supplier) => supplier.id === preferredSupplierId)) {
      setValue("supplierId", preferredSupplierId, { shouldDirty: true, shouldValidate: true });
    }
  }, [isEditMode, preferredSupplierId, setValue, suppliers]);

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items") ?? [];
  const estimatedShippingCost = Number(watch("estimatedShippingCost")) || 0;

  // Lookup maps to resolve IDs to readable names
  const supplierNameMap = new Map(suppliers.map((s) => [s.id, s.name] as const));
  const productNameMap = new Map<string, string>([
    ...products.map((p) => [p.id, `${p.name} (${p.type === "GREEN_BEAN" ? "GB" : "RB"})`] as const),
    ...supplyItems.map((s) => [s.id, `${s.name} (${s.category === "PACKAGING" ? "PKG" : "SUP"})`] as const),
    ...packagings.map((p) => [p.id, `${p.name} (PKG LAMA)`] as const),
  ]);

  // Calculate total
  const itemEstimate = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0,
  );
  const totalEstimate = itemEstimate + estimatedShippingCost;

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // Filter out empty items
      const validItems = data.items.filter(
        (item) => (item.productId || item.packagingId || item.supplyItemId) && item.quantity > 0,
      );

      if (validItems.length === 0) {
        toast.error("Minimal 1 item produk/kemasan harus diisi.");
        return;
      }

      let result;
      if (isEditMode) {
        result = await updatePO({
          id: initialData!.id,
          supplierId: data.supplierId,
          expectedDate: data.expectedDate || undefined,
          estimatedShippingCost: data.estimatedShippingCost,
          notes: data.notes,
          items: validItems,
        });
      } else {
        result = await createPO({
          supplierId: data.supplierId,
          expectedDate: data.expectedDate || undefined,
          estimatedShippingCost: data.estimatedShippingCost,
          notes: data.notes,
          items: validItems,
        });
      }

      if (result.success) {
        toast.success(isEditMode ? "PO berhasil diupdate." : "PO berhasil dibuat.");
        onSuccess();
      } else {
        toastSafe.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!initialData?.id) return;
    setIsSubmitting(true);
    try {
      const result = await sendPOAction(initialData.id);
      if (result.success) {
        toast.success("PO berhasil dikirim ke supplier.");
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
      {/* Supplier */}
      <div className={cn(glassCard, "space-y-3")}>
        <h3 className="text-sm font-semibold text-slate-700">Informasi PO</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Supplier *</Label>
              {!isReadOnly && onAddSupplier && (
                <button type="button" onClick={onAddSupplier} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-800">
                  <Plus size={12} /> Supplier baru
                </button>
              )}
            </div>
            <Controller
              name="supplierId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
                  <SelectTrigger className={cn("h-9", glassInput)}>
                    <SelectValue placeholder="Pilih Supplier">
                      {field.value ? supplierNameMap.get(field.value) || "Pilih Supplier" : "Pilih Supplier"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.supplierId && (
              <p className="text-xs text-red-500">{errors.supplierId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Tanggal Perkiraan Datang
            </Label>
            <Input
              type="date"
              className={cn("h-9", glassInput)}
              {...register("expectedDate")}
              disabled={isReadOnly}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Catatan
          </Label>
          <Input
            placeholder="Catatan untuk supplier..."
            className={cn("h-9", glassInput)}
            {...register("notes")}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* Items */}
      <div className={cn(glassCard, "space-y-3")}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Item PO</h3>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => append({ productId: "", packagingId: "", supplyItemId: "", quantity: 0, unitPrice: 0 })}
              className="flex items-center gap-1 text-xs font-bold text-domain-production hover:text-domain-roasting"
            >
              <Plus size={14} /> Tambah Item
            </button>
          )}
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="relative flex flex-wrap sm:flex-nowrap items-start gap-2 rounded-xl border border-white/60 bg-white/40 p-3">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute -top-2 -right-2 bg-white text-red-500 border border-white/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 shadow-sm"
                >
                  <Trash2 size={12} />
                </button>
              )}

              {/* Produk/Kemasan */}
              <div className="flex-1 min-w-[150px] space-y-1">
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Produk/Kemasan
                </Label>
                <Controller
                  name={`items.${index}.productId`}
                  control={control}
                  render={({ field: f }) => (
                    <Select
                      value={String(f.value || items[index]?.supplyItemId || items[index]?.packagingId || "")}
                      onValueChange={(value) => {
                        const selectedValue = value ?? "";
                        const isProduct = products.some((p) => p.id === selectedValue);
                        const isSupply = supplyItems.some((s) => s.id === selectedValue);
                        const isLegacyPackaging = packagings.some((p) => p.id === selectedValue);
                        setValue(`items.${index}.productId`, isProduct ? selectedValue : "", { shouldDirty: true, shouldValidate: true });
                        setValue(`items.${index}.supplyItemId`, isSupply ? selectedValue : "", { shouldDirty: true, shouldValidate: true });
                        setValue(`items.${index}.packagingId`, isLegacyPackaging ? selectedValue : "", { shouldDirty: true, shouldValidate: true });
                      }}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className={cn("h-9 text-xs", glassInput)}>
                        <SelectValue placeholder="Pilih Produk">
                          {(f.value || items[index]?.supplyItemId || items[index]?.packagingId)
                            ? productNameMap.get(String(f.value || items[index]?.supplyItemId || items[index]?.packagingId || "")) || "Pilih Produk"
                            : "Pilih Produk"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.type === "GREEN_BEAN" ? "GB" : "RB Beli Jadi"})
                          </SelectItem>
                        ))}
                        {supplyItems.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.category === "PACKAGING" ? "PKG" : "SUP"} · {s.baseUnit})
                          </SelectItem>
                        ))}
                        {isEditMode && packagings.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} (PKG LAMA)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Quantity */}
              <div className="w-24 space-y-1">
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Qty
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className={cn("h-9 text-xs", glassInput)}
                  {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  disabled={isReadOnly}
                />
              </div>

              {/* Harga */}
              <div className="w-28 space-y-1">
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Harga/Unit
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  className={cn("h-9 text-xs", glassInput)}
                  {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                  disabled={isReadOnly}
                />
              </div>

              {/* Subtotal */}
              <div className="w-28 space-y-1">
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Subtotal
                </Label>
                <div className="h-9 flex items-center text-xs font-bold text-slate-700">
                  {formatRupiah((items[index]?.quantity || 0) * (items[index]?.unitPrice || 0))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1.5 border-t border-white/50 pt-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Estimasi Ongkir <span className="font-medium normal-case tracking-normal text-slate-400">(opsional)</span>
          </Label>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            className={cn("h-9 text-right tabular-nums", glassInput)}
            {...register("estimatedShippingCost", { valueAsNumber: true })}
            disabled={isReadOnly}
          />
          {errors.estimatedShippingCost && (
            <p className="text-xs text-red-500">{errors.estimatedShippingCost.message}</p>
          )}
        </div>

        {/* Total */}
        <div className="space-y-1 border-t border-white/50 pt-2 text-right">
          <p className="text-[11px] text-slate-500">
            Item {formatRupiah(itemEstimate)} + ongkir {formatRupiah(estimatedShippingCost)}
          </p>
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-slate-500">Total Estimasi:</span>
            <span className="text-lg font-black text-slate-900">{formatRupiah(totalEstimate)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="bg-white/40 border-white/60"
          >
            Batal
          </Button>
          {isEditMode && initialData?.id && (
            <Button
              type="button"
              onClick={handleSend}
              disabled={isSubmitting}
              className="bg-domain-inventory text-white hover:bg-domain-inventory/90"
            >
              Kirim ke Supplier
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? "Menyimpan..." : isEditMode ? "Update PO" : "Simpan Draft"}
          </Button>
        </div>
      )}
    </form>
  );
}
