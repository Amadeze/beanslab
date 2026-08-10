"use client";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PurchasePaymentSection } from "./PurchasePaymentSection";
import { formatRupiah } from "@/lib/format";
import { getTodayString } from "@/lib/date-utils";
import { defaultDueDate } from "@/lib/sale-intent";
import {
  createRoastedBeanPurchase,
} from "../actions";
import {
  type SupplierOption,
  type RBProductOption,
} from "../types";

// =============================================================================
// Zod schema
// =============================================================================

const ROAST_LEVELS = ["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"] as const;

const schema = z
  .object({
    supplierId: z.string().min(1, "Wajib pilih supplier"),
    receivedAt: z.string().min(1, "Tanggal wajib diisi"),
    productMode: z.enum(["existing", "new"]),
    productId: z.string().optional(),
    productName: z.string().optional(),
    productOrigin: z.string().optional(),
    productRoastLevel: z.enum(ROAST_LEVELS),
    // z.number() + valueAsNumber:true in register — react-hook-form converts input string to number
    weightKg: z.number().positive("Harus lebih dari 0"),
    totalCost: z.number().positive("Total pembelian harus lebih dari 0"),
    shippingCost: z.number().min(0, "Tidak boleh negatif"),
    paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]),
    initialPaidAmount: z.number().min(0).optional(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS"]),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    bestBeforeDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.productMode === "existing" && !data.productId) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Wajib pilih produk",
      });
    }
    if (data.productMode === "new") {
      if (!data.productName || data.productName.trim().length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["productName"],
          message: "Nama minimal 2 karakter",
        });
      }
    }
    const totalCost = data.totalCost;
    if (data.shippingCost >= totalCost) {
      ctx.addIssue({ code: "custom", path: ["shippingCost"], message: "Ongkir harus lebih kecil dari total" });
    }
    if (data.paymentStatus === "PARTIAL") {
      if (!data.initialPaidAmount || data.initialPaidAmount >= totalCost) {
        ctx.addIssue({
          code: "custom",
          path: ["initialPaidAmount"],
          message: "Uang muka harus lebih dari 0 dan lebih kecil dari total",
        });
      }
    }
    if (data.paymentStatus !== "PAID" && !data.dueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Tanggal jatuh tempo wajib diisi",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Field wrapper helpers
// =============================================================================

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500">{message}</p>;
}

// =============================================================================
// Props
// =============================================================================

interface RoastedBeanPurchaseFormProps {
  id: string;
  suppliers: SupplierOption[];
  rbProducts: RBProductOption[];
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
  onAddSupplier?: () => void;
  preferredSupplierId?: string | null;
}

// =============================================================================
// Component
// =============================================================================

export function RoastedBeanPurchaseForm({
  id,
  suppliers,
  rbProducts,
  onSuccess,
  onPendingChange,
  onAddSupplier,
  preferredSupplierId,
}: RoastedBeanPurchaseFormProps) {
  const today = getTodayString();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplierId: "",
      receivedAt: today,
      productMode: rbProducts.length > 0 ? "existing" : "new",
      productId: "",
      productName: "",
      productOrigin: "",
      productRoastLevel: "MEDIUM",
      weightKg: 0,
      totalCost: 0,
      shippingCost: 0,
      paymentStatus: "PAID",
      initialPaidAmount: 0,
      paymentMethod: "CASH",
      dueDate: "",
      notes: "",
      bestBeforeDate: "",
    },
  });

  useEffect(() => {
    if (preferredSupplierId && suppliers.some((supplier) => supplier.id === preferredSupplierId)) {
      setValue("supplierId", preferredSupplierId, { shouldDirty: true, shouldValidate: true });
    }
  }, [preferredSupplierId, setValue, suppliers]);

  // Live HPP computation
  const [weightKg, totalCost, receivedAt] = watch([
    "weightKg",
    "totalCost",
    "receivedAt",
  ]);
  const productMode = watch("productMode");
  const paymentStatus = watch("paymentStatus");

  const hppPerKg = Number(weightKg) > 0 ? (Number(totalCost) || 0) / Number(weightKg) : 0;

  useEffect(() => {
    if (paymentStatus !== "PAID") {
      setValue("dueDate", defaultDueDate(new Date(`${receivedAt || today}T00:00:00`), 14), { shouldValidate: true });
    } else {
      setValue("dueDate", "");
    }
  }, [paymentStatus, receivedAt, setValue, today]);

  // ── Submit ──
  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const result = await createRoastedBeanPurchase({
        operationKey,
        supplierId: values.supplierId,
        receivedAt: values.receivedAt,
        productId: values.productMode === "existing" ? values.productId : undefined,
        productName: values.productMode === "new" ? values.productName : undefined,
        productOrigin: values.productMode === "new" ? values.productOrigin : undefined,
        productRoastLevel: values.productRoastLevel,
        weightKg: values.weightKg,
        totalCost: values.totalCost,
        shippingCost: values.shippingCost,
        paidAmount: values.paymentStatus === "PAID"
          ? values.totalCost
          : values.paymentStatus === "PARTIAL"
            ? values.initialPaidAmount
            : 0,
        paymentMethod: values.paymentMethod,
        dueDate: values.dueDate,
        notes: values.notes,
        bestBeforeDate: values.bestBeforeDate || undefined,
      });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }

      toast.success(`Barang datang dicatat — ${result.purchaseCode}`);
      reset();
      setOperationKey(crypto.randomUUID());
      onSuccess();
    } catch (err) {
      console.error("[RoastedBeanPurchaseForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">
      
      {/* ── Wizard Progress ── */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1">
            <div className={cn(
              "h-1.5 rounded-full transition-colors",
              step >= s ? "bg-amber-600" : "bg-white/40"
            )} />
            <p className={cn(
              "text-[10px] uppercase font-bold mt-1.5 tracking-wider transition-colors",
              step >= s ? "text-amber-800" : "text-slate-400"
            )}>
              {s === 1 ? "Supplier" : s === 2 ? "Produk" : "Pembayaran"}
            </p>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* ── Supplier ── */}
          <FieldGroup>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Supplier <span className="text-red-500">*</span>
              </Label>
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
              {suppliers.length === 0 ? (
                <option value="_empty" disabled>Belum ada supplier</option>
              ) : (
                suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
            <FieldError message={errors.supplierId?.message} />
          </FieldGroup>

          {/* ── Tanggal ── */}
          <FieldGroup>
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Tanggal Terima <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              className={cn("h-9", glassInput)}
              {...register("receivedAt")}
            />
            <FieldError message={errors.receivedAt?.message} />
          </FieldGroup>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* ── Produk ── */}
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Roasted Bean <span className="text-red-500">*</span>
            </Label>
            <button
              type="button"
              onClick={() => setValue("productMode", productMode === "existing" ? "new" : "existing", { shouldDirty: true })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900"
            >
              <Plus size={12} /> {productMode === "existing" ? "Produk baru" : "Pilih produk lama"}
            </button>
          </div>

          {/* ── Pilih existing ── */}
          {productMode === "existing" && (
            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Pilih Roasted Bean</Label>
              <select
                className={cn(
                  "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
                  glassInput,
                  errors.productId ? "border-red-500 ring-2 ring-red-500/20" : ""
                )}
                {...register("productId")}
              >
                <option value="" disabled>Pilih produk...</option>
                {rbProducts.length === 0 ? (
                  <option value="_empty" disabled>Belum ada produk RB</option>
                ) : (
                  rbProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.roastLevel ? ` · ${p.roastLevel.replaceAll("_", " ")}` : ""} {p.origin ? ` — ${p.origin}` : ""}
                    </option>
                  ))
                )}
              </select>
              <FieldError message={errors.productId?.message} />
            </FieldGroup>
          )}

          {/* ── Produk baru ── */}
          {productMode === "new" && (
            <div className={cn(glassCard, "space-y-4")}>
              <FieldGroup>
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Nama Roasted Bean <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Gayo Beli Jadi Medium, Ethiopia Yirgacheffe Dark"
                  className={cn("h-9 font-medium", glassInput)}
                  {...register("productName")}
                />
                <FieldError message={errors.productName?.message} />
              </FieldGroup>
              <FieldGroup>
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Asal / Origin</Label>
                <Input
                  placeholder="e.g. Aceh, Ethiopia, Flores"
                  className={cn("h-9", glassInput)}
                  {...register("productOrigin")}
                />
              </FieldGroup>
              <FieldGroup>
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Tingkat Sangrai <span className="text-red-500">*</span>
                </Label>
                <select
                  className={cn(
                    "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
                    glassInput
                  )}
                  {...register("productRoastLevel")}
                >
                  {ROAST_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </FieldGroup>
            </div>
          )}

          {/* ── Berat & Harga ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Berat (kg) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.000"
                className={cn("h-9 tabular-nums font-semibold", glassInput)}
                {...register("weightKg", { valueAsNumber: true })}
              />
              <FieldError message={errors.weightKg?.message} />
            </FieldGroup>

            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Total Pembelian <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                className={cn("h-9 tabular-nums font-semibold", glassInput)}
                {...register("totalCost", { valueAsNumber: true })}
              />
              <FieldError message={errors.totalCost?.message} />
            </FieldGroup>

            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Ongkir <span className="font-medium normal-case tracking-normal text-slate-400">(opsional)</span>
              </Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                className={cn("h-9 tabular-nums font-semibold", glassInput)}
                {...register("shippingCost", { valueAsNumber: true })}
              />
              <p className="text-xs leading-4 text-slate-500">Bagian dari total pembelian</p>
              <FieldError message={errors.shippingCost?.message} />
            </FieldGroup>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-emerald-900">Serba otomatis setelah disimpan</p>
              <p className="whitespace-nowrap text-xs font-bold tabular-nums text-emerald-800">
                {hppPerKg > 0 ? `${formatRupiah(hppPerKg)}/kg` : "HPP otomatis"}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-emerald-700">
              ID barang datang = kode lot · stok & ledger & jurnal (1-1210) · ditandai Beli Jadi (PURCHASED_ROASTED)
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className={cn(glassCard, "space-y-4")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Best Before / Review Mutu
                </Label>
                <Input
                  type="date"
                  className={cn("h-9", glassInput)}
                  {...register("bestBeforeDate")}
                />
                <FieldError message={errors.bestBeforeDate?.message} />
              </FieldGroup>
            </div>

            <PurchasePaymentSection
              register={register}
              setValue={setValue}
              errors={errors}
              paymentStatus={paymentStatus}
            />
          </div>
        </div>
      )}

      {/* ── Wizard Navigation ── */}
      <div className="flex items-center justify-between pt-4 border-t border-white/60">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-xl border border-white/60 bg-white/30 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-white/50 transition-all"
          >
            Kembali
          </button>
        ) : <div />}
        
        {step < 3 ? (
          <button
            type="button"
            onClick={async () => {
              // Basic validation before next
              if (step === 1) {
                const s = watch("supplierId");
                const r = watch("receivedAt");
                if (!s || !r) {
                  toastSafe.error("Lengkapi supplier dan tanggal");
                  return;
                }
              }
              if (step === 2) {
                const w = watch("weightKg");
                const tc = watch("totalCost");
                if (!w || !tc || w <= 0 || tc <= 0) {
                  toastSafe.error("Lengkapi berat dan total pembelian");
                  return;
                }
              }
              setStep(step + 1);
            }}
            className="rounded-xl bg-amber-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700 transition-all"
          >
            Lanjut
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="rounded-xl bg-amber-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Menyimpan..." : "Simpan Pembelian"}
          </button>
        )}
      </div>

      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}