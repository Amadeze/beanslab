"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Plus, Package } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PurchasePaymentSection } from "./PurchasePaymentSection";

// Pastikan kamu punya server action ini (buat jika belum ada)
import { createPackagingPurchase, createPackaging } from "../actions"; 
import { getTodayString } from "@/lib/date-utils";
import { defaultDueDate } from "@/lib/sale-intent";

// =============================================================================
// Schemas
// =============================================================================

const purchaseSchema = z.object({
  supplierId:    z.string().min(1, "Pilih supplier"),
  receivedAt:    z.string().min(1, "Tanggal wajib diisi"),
  packagingId:   z.string().min(1, "Pilih kemasan"),
  quantityUnits: z.number({ error: "Harus angka" }).int().positive("Qty harus > 0"),
  totalCost:  z.number({ error: "Harus angka" }).positive("Total harus lebih dari 0"),
  shippingCost:  z.number({ error: "Harus angka" }).min(0),
  paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]),
  initialPaidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS"]),
  dueDate: z.string().optional(),
  notes:         z.string().optional(),
  bestBeforeDate: z.string().optional(),
}).superRefine((data, ctx) => {
  const totalCost = data.totalCost;
  if (data.shippingCost >= totalCost) {
    ctx.addIssue({ code: "custom", path: ["shippingCost"], message: "Ongkir harus lebih kecil dari total" });
  }
  if (
    data.paymentStatus === "PARTIAL"
    && (!data.initialPaidAmount || data.initialPaidAmount >= totalCost)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["initialPaidAmount"],
      message: "Uang muka harus lebih dari 0 dan lebih kecil dari total",
    });
  }
  if (data.paymentStatus !== "PAID" && !data.dueDate) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Tanggal jatuh tempo wajib diisi",
    });
  }
});

const quickAddSchema = z.object({
  name:        z.string().trim().min(2, "Nama minimal 2 karakter"),
  weightGrams: z.number().min(0),
  costPerUnit: z.number().min(0),
});

type FormValues = z.infer<typeof purchaseSchema>;
type QuickAddValues = z.infer<typeof quickAddSchema>;

interface PackagingOption { id: string; name: string; code: string; costPerUnit: number; }
interface SupplierOption  { id: string; code: string; name: string; }

interface PackagingPurchaseFormProps {
  suppliers:  SupplierOption[];
  packagings: PackagingOption[];
  onSuccess:  () => void;
  onPendingChange?: (isPending: boolean) => void;
  onAddSupplier?: () => void;
  preferredSupplierId?: string | null;
}

// Glassmorphism Utilities
const glassInput = "h-9 bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 text-sm";
const glassCard = "rounded-[1rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Main Component
// =============================================================================

export function PackagingPurchaseForm({ suppliers, packagings, onSuccess, onPendingChange, onAddSupplier, preferredSupplierId }: PackagingPurchaseFormProps) {
  const today = getTodayString();
  const [submitting, setSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAddingPkg, setIsAddingPkg] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [packagingOptions, setPackagingOptions] = useState(packagings);

  useEffect(() => {
    setPackagingOptions(packagings);
  }, [packagings]);

  // Form Utama (Pembelian)
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

  // Form Mini (Quick Add Kemasan)
  const { register: regQuickAdd, handleSubmit: handleQuickAddSubmit, reset: resetQuickAdd, formState: { errors: qaErrors } } = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { weightGrams: 0, costPerUnit: 0 },
  });

  const qty   = watch("quantityUnits") ?? 0;
  const total = watch("totalCost") ?? 0;
  const hppPerUnit = qty > 0 ? total / qty : 0;

  // Submit Pembelian
  const onSubmit = async (data: FormValues) => {
    if (submitting) return;
    setSubmitting(true);
    onPendingChange?.(true);
    try {
      const result = await createPackagingPurchase({
        operationKey,
        supplierId: data.supplierId,
        receivedAt: data.receivedAt,
        packagingId: data.packagingId,
        quantityUnits: data.quantityUnits,
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
        bestBeforeDate: data.bestBeforeDate || undefined,
      });
      if (!result.success) { toastSafe.error(result.error); return; }
      toast.success(`Kemasan datang dicatat: ${result.purchaseCode}`);
      reset();
      setOperationKey(crypto.randomUUID());
      onSuccess();
    } catch (err) {
      console.error("[PackagingPurchaseForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setSubmitting(false);
      onPendingChange?.(false);
    }
  };

  // Submit Quick Add Kemasan
  const onQuickAdd = async (data: QuickAddValues) => {
    setIsAddingPkg(true);
    try {
      const result = await createPackaging(data); // Panggil fungsi dari actions.ts
      if (!result.success) { toastSafe.error(result.error); return; }
      
      toast.success("Kemasan baru berhasil ditambahkan!");
      setPackagingOptions((current) => [
        result.packaging,
        ...current.filter((item) => item.id !== result.packaging.id),
      ]);
      setIsQuickAddOpen(false);
      resetQuickAdd();
      
      // Otomatis pilih kemasan yang baru dibuat
      setValue("packagingId", result.packagingId, { shouldValidate: true });
      
    } catch (err) {
      console.error("[PackagingPurchaseForm]", err);
      toast.error("Gagal menambahkan kemasan.");
    } finally {
      setIsAddingPkg(false);
    }
  };

  return (
    <>
      <form id="pkg-purchase-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-1">
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

        {/* Kemasan + Tombol Quick Add */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Kemasan <span className="text-red-500">*</span></Label>
            <select
              className={cn(
                "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
                glassInput,
                errors.packagingId ? "border-red-500 ring-2 ring-red-500/20" : ""
              )}
              {...register("packagingId")}
            >
              <option value="" disabled>Pilih kemasan...</option>
              {packagingOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.packagingId && <p className="text-xs text-red-500 font-medium">{errors.packagingId.message}</p>}
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setIsQuickAddOpen(true)}
            className="h-9 w-10 shrink-0 bg-white/40 border-white/60 backdrop-blur-md hover:bg-white/60 text-slate-700 p-0 transition-all shadow-sm"
          >
            <Plus size={16} />
          </Button>
        </div>

        {/* Qty & Harga */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Qty (pcs) <span className="text-red-500">*</span></Label>
            <Input type="number" step="1" min="1" className={cn(glassInput, "text-right tabular-nums")} {...register("quantityUnits", { valueAsNumber: true })} />
            {errors.quantityUnits && <p className="text-xs text-red-500 font-medium">{errors.quantityUnits.message}</p>}
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
              {hppPerUnit > 0 ? `${Math.round(hppPerUnit).toLocaleString("id-ID")}/pcs` : "HPP otomatis"}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] leading-4 text-emerald-700">
            ID barang datang = kode lot · stok & ledger · HPP & jurnal · urutan FIFO/FEFO
          </p>
        </div>

        {/* Semua isian non-wajib */}
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
                <Label className="text-xs font-semibold text-slate-700">Best Before / Review Mutu</Label>
                <Input type="date" className={glassInput} {...register("bestBeforeDate")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Ongkir dalam total (Rp)</Label>
                <Input type="number" step="1" min="0" placeholder="0" className={cn(glassInput, "text-right tabular-nums")} {...register("shippingCost", { valueAsNumber: true })} />
                {errors.shippingCost && <p className="text-xs font-medium text-red-500">{errors.shippingCost.message}</p>}
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

      {/* ==========================================================================
          DIALOG QUICK ADD KEMASAN
          ========================================================================== */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="sm:max-w-100 border-white/60 bg-white/30 backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Package size={18} className="text-emerald-600" />
              Tambah Kemasan Baru
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleQuickAddSubmit(onQuickAdd)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nama Kemasan *</Label>
              <Input placeholder="Misal: Kraft Box 1KG" className={glassInput} {...regQuickAdd("name")} />
              {qaErrors.name && <p className="text-xs text-red-500">{qaErrors.name.message}</p>}
            </div>

            <p className="text-[11px] text-slate-500">Kode dibuat otomatis. Berat dan harga bisa diperbarui nanti.</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Berat Kosong (g)</Label>
                <Input type="number" min="0" step="0.1" className={cn(glassInput, "text-right tabular-nums")} {...regQuickAdd("weightGrams", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Harga Standar (Rp)</Label>
                <Input type="number" min="0" step="1" className={cn(glassInput, "text-right tabular-nums")} {...regQuickAdd("costPerUnit", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsQuickAddOpen(false)} className="text-slate-600 hover:bg-white/40">
                Batal
              </Button>
              <Button type="submit" disabled={isAddingPkg} className="rounded-[9px] font-bold shadow-md">
                {isAddingPkg ? "Menyimpan..." : "Simpan Kemasan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
