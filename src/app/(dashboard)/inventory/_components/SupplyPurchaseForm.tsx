"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PurchasePaymentSection } from "./PurchasePaymentSection";
import { createSupplyPurchaseAction } from "../actions";
import { getTodayString } from "@/lib/date-utils";
import { defaultDueDate } from "@/lib/sale-intent";

const purchaseSchema = z.object({
  supplierId:    z.string().min(1, "Pilih supplier"),
  receivedAt:    z.string().min(1, "Tanggal wajib diisi"),
  supplyItemId:  z.string().min(1, "Pilih item"),
  quantity:      z.number({ error: "Harus angka" }).positive("Qty harus > 0"),
  totalCost:     z.number({ error: "Harus angka" }).positive("Total harus lebih dari 0"),
  shippingCost:  z.number({ error: "Harus angka" }).min(0),
  paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]),
  initialPaidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS"]),
  dueDate:       z.string().optional(),
  notes:         z.string().optional(),
  lotNumber:     z.string().optional(),
  bestBeforeDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.shippingCost >= data.totalCost) {
    ctx.addIssue({ code: "custom", path: ["shippingCost"], message: "Ongkir harus lebih kecil dari total" });
  }
  if (
    data.paymentStatus === "PARTIAL"
    && (!data.initialPaidAmount || data.initialPaidAmount >= data.totalCost)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["initialPaidAmount"],
      message: "Uang muka harus lebih dari 0 dan lebih kecil dari total",
    });
  }
  if (data.paymentStatus !== "PAID" && !data.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Tanggal jatuh tempo wajib diisi" });
  }
});

type FormValues = z.infer<typeof purchaseSchema>;

export interface SupplyOption { id: string; name: string; code: string; baseUnit: string; }

interface SupplierOption { id: string; code: string; name: string; }

interface SupplyPurchaseFormProps {
  suppliers:  SupplierOption[];
  supplies:   SupplyOption[];
  onSuccess:  () => void;
  onPendingChange?: (isPending: boolean) => void;
  onAddSupplier?: () => void;
  preferredSupplierId?: string | null;
}

const glassInput = "h-9 bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 text-sm";
const glassCard = "rounded-[1rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

export function SupplyPurchaseForm({
  suppliers, supplies, onSuccess, onPendingChange, onAddSupplier, preferredSupplierId,
}: SupplyPurchaseFormProps) {
  const today = getTodayString();
  const [submitting, setSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      receivedAt: today,
      shippingCost: 0,
      totalCost: 0,
      paymentStatus: "PAID",
      initialPaidAmount: 0,
      paymentMethod: "CASH",
      dueDate: "",
      bestBeforeDate: "",
    },
  });

  useEffect(() => {
    if (preferredSupplierId && suppliers.some((supplier) => supplier.id === preferredSupplierId)) {
      setValue("supplierId", preferredSupplierId, { shouldDirty: true, shouldValidate: true });
    }
  }, [preferredSupplierId, setValue, suppliers]);

  const paymentStatus = watch("paymentStatus");
  const receivedAt = watch("receivedAt");
  useEffect(() => {
    if (paymentStatus !== "PAID") {
      setValue("dueDate", defaultDueDate(new Date(`${receivedAt || today}T00:00:00`), 14), { shouldValidate: true });
    } else {
      setValue("dueDate", "");
    }
  }, [paymentStatus, receivedAt, setValue, today]);

  const qty = watch("quantity") ?? 0;
  const total = watch("totalCost") ?? 0;
  const hppPerUnit = qty > 0 ? total / qty : 0;
  const selectedUnit = supplies.find((s) => s.id === watch("supplyItemId"))?.baseUnit ?? "unit";

  const onSubmit = async (data: FormValues) => {
    if (submitting) return;
    setSubmitting(true);
    onPendingChange?.(true);
    try {
      const result = await createSupplyPurchaseAction({
        operationKey,
        supplierId: data.supplierId,
        receivedAt: data.receivedAt,
        supplyItemId: data.supplyItemId,
        supplyQuantity: data.quantity,
        totalCost: data.totalCost,
        shippingCost: data.shippingCost,
        paidAmount: data.paymentStatus === "PAID"
          ? data.totalCost
          : data.paymentStatus === "PARTIAL"
            ? data.initialPaidAmount
            : 0,
        paymentMethod: data.paymentMethod,
        dueDate: data.dueDate,
        notes: data.notes,
        lotNumber: data.lotNumber || undefined,
        bestBeforeDate: data.bestBeforeDate || undefined,
      });
      if (!result.success) { toastSafe.error(result.error); return; }
      toast.success(`Barang datang dicatat: ${result.purchaseCode}`);
      reset();
      setOperationKey(crypto.randomUUID());
      onSuccess();
    } catch (err) {
      console.error("[SupplyPurchaseForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id="supply-purchase-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-1">
      {/* Supplier */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-semibold text-slate-700">Supplier <span className="text-red-500">*</span></Label>
          {onAddSupplier && (
            <button type="button" onClick={onAddSupplier} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-800">
              <Plus size={12} /> Supplier baru
            </button>
          )}
        </div>
        <select
          className={cn(
            "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
            glassInput,
            errors.supplierId ? "border-red-500 ring-2 ring-red-500/20" : ""
          )}
          {...register("supplierId")}
        >
          <option value="" disabled>Pilih supplier...</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {errors.supplierId && <p className="text-xs text-red-500 font-medium">{errors.supplierId.message}</p>}
      </div>

      {/* Tanggal */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Tanggal Terima <span className="text-red-500">*</span></Label>
        <Input type="date" className={glassInput} {...register("receivedAt")} />
      </div>

      {/* Item */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Persediaan Non-Kopi <span className="text-red-500">*</span></Label>
        <select
          className={cn(
            "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
            glassInput,
            errors.supplyItemId ? "border-red-500 ring-2 ring-red-500/20" : ""
          )}
          {...register("supplyItemId")}
        >
          <option value="" disabled>Pilih item...</option>
          {supplies.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.baseUnit})</option>
          ))}
        </select>
        {errors.supplyItemId && <p className="text-xs text-red-500 font-medium">{errors.supplyItemId.message}</p>}
      </div>

      {/* Qty & Harga */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Qty ({selectedUnit}) <span className="text-red-500">*</span></Label>
          <Input type="number" step="any" min="0.01" className={cn(glassInput, "text-right tabular-nums")} {...register("quantity", { valueAsNumber: true })} />
          {errors.quantity && <p className="text-xs text-red-500 font-medium">{errors.quantity.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Total Pembelian (Rp) <span className="text-red-500">*</span></Label>
          <Input type="number" step="1" min="0" className={cn(glassInput, "text-right tabular-nums")} {...register("totalCost", { valueAsNumber: true })} />
          {errors.totalCost && <p className="text-xs text-red-500 font-medium">{errors.totalCost.message}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-emerald-900">Serba otomatis setelah disimpan</p>
          <p className="whitespace-nowrap text-xs font-bold tabular-nums text-emerald-800">
            {hppPerUnit > 0 ? `${Math.round(hppPerUnit).toLocaleString("id-ID")}/${selectedUnit}` : "HPP otomatis"}
          </p>
        </div>
        <p className="mt-0.5 text-[11px] leading-4 text-emerald-700">
          Stok & ledger · HPP rata-rata & jurnal · lot & kedaluwarsa (bila item melacak lot)
        </p>
      </div>

      {/* Detail opsional */}
      <button
        type="button"
        onClick={() => setShowOptionalDetails((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-white/60 bg-white/30 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-white/50"
        aria-expanded={showOptionalDetails}
      >
        Detail opsional
        <ChevronDown size={14} className={cn("transition-transform", showOptionalDetails && "rotate-180")} />
      </button>
      {showOptionalDetails && (
        <div className={cn(glassCard, "space-y-4")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">No. Lot Supplier</Label>
              <Input placeholder="Kosongkan bila tidak ada" className={glassInput} {...register("lotNumber")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Best Before</Label>
              <Input type="date" className={glassInput} {...register("bestBeforeDate")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Ongkir dalam total (Rp)</Label>
              <Input type="number" step="1" min="0" placeholder="0" className={cn(glassInput, "text-right tabular-nums")} {...register("shippingCost", { valueAsNumber: true })} />
              {errors.shippingCost && <p className="text-xs font-medium text-red-500">{errors.shippingCost.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Catatan</Label>
              <Input placeholder="Opsional" className={glassInput} {...register("notes")} />
            </div>
          </div>

          <PurchasePaymentSection
            register={register}
            setValue={setValue}
            errors={errors}
            paymentStatus={paymentStatus}
          />
        </div>
      )}

      <Button type="submit" disabled={submitting} className="hidden" />
    </form>
  );
}
