"use client";

import { useForm, Controller } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PurchasePaymentSection } from "./PurchasePaymentSection";
import { formatRupiah } from "@/lib/format";
import { getTodayString } from "@/lib/date-utils";
import { defaultDueDate } from "@/lib/sale-intent";
import {
  createGreenBeanPurchase,
  type SupplierOption,
  type GBProductOption,
} from "../actions";

// =============================================================================
// Zod schema
// =============================================================================

const schema = z
  .object({
    supplierId: z.string().min(1, "Wajib pilih supplier"),
    receivedAt: z.string().min(1, "Tanggal wajib diisi"),
    productMode: z.enum(["existing", "new"]),
    productId: z.string().optional(),
    productName: z.string().optional(),
    productOrigin: z.string().optional(),
    // z.number() + valueAsNumber:true in register — react-hook-form converts input string to number
    weightKg: z.number().positive("Harus lebih dari 0"),
    totalCost: z.number().positive("Total pembelian harus lebih dari 0"),
    shippingCost: z.number().min(0, "Tidak boleh negatif"),
    paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]),
    initialPaidAmount: z.number().min(0).optional(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS"]),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    lotNumber: z.string().optional(),
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

function ReadonlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <FieldGroup>
      <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label}</Label>
      <div className={cn("flex h-9 items-center px-3 cursor-not-allowed opacity-80", glassInput)}>
        <span className="text-sm font-semibold text-slate-800">{value}</span>
      </div>
      {hint && <p className="text-[10px] font-medium text-slate-400">{hint}</p>}
    </FieldGroup>
  );
}

// =============================================================================
// Props
// =============================================================================

interface PurchaseFormProps {
  id: string;
  suppliers: SupplierOption[];
  gbProducts: GBProductOption[];
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
  onAddSupplier?: () => void;
  preferredSupplierId?: string | null;
}

// =============================================================================
// Component
// =============================================================================

export function PurchaseForm({
  id,
  suppliers,
  gbProducts,
  onSuccess,
  onPendingChange,
  onAddSupplier,
  preferredSupplierId,
}: PurchaseFormProps) {
  const today = getTodayString();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [showCostDetails, setShowCostDetails] = useState(false);

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
      supplierId: "",
      receivedAt: today,
      productMode: gbProducts.length > 0 ? "existing" : "new",
      productId: "",
      productName: "",
      productOrigin: "",
      weightKg: 0,
      totalCost: 0,
      shippingCost: 0,
      paymentStatus: "PAID",
      initialPaidAmount: 0,
      paymentMethod: "CASH",
      dueDate: "",
      notes: "",
      lotNumber: "",
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
      const result = await createGreenBeanPurchase({
        operationKey,
        supplierId: values.supplierId,
        receivedAt: values.receivedAt,
        productId: values.productMode === "existing" ? values.productId : undefined,
        productName: values.productMode === "new" ? values.productName : undefined,
        productOrigin: values.productMode === "new" ? values.productOrigin : undefined,
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
        lotNumber: values.lotNumber || undefined,
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
      console.error("[PurchaseForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative">
      {/* ── Supplier ── */}
      <FieldGroup>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Supplier <span className="text-red-500">*</span>
          </Label>
          {onAddSupplier && (
            <button type="button" onClick={onAddSupplier} className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 hover:text-amber-800">
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
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Tanggal Terima <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            className={cn("h-9", glassInput)}
            {...register("receivedAt")}
          />
          <FieldError message={errors.receivedAt?.message} />
        </FieldGroup>
        <FieldGroup>
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Best Before
          </Label>
          <Input
            type="date"
            className={cn("h-9", glassInput)}
            {...register("bestBeforeDate")}
          />
          <FieldError message={errors.bestBeforeDate?.message} />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Lot Number / Batch
        </Label>
        <Input
          type="text"
          placeholder="e.g. LOT-12345"
          className={cn("h-9", glassInput)}
          {...register("lotNumber")}
        />
        <FieldError message={errors.lotNumber?.message} />
      </FieldGroup>

      <Separator className="bg-white/50" />

      {/* ── Mode produk ── */}
      <div>
        <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2 block">
          Green Bean <span className="text-red-500">*</span>
        </Label>
        <Controller
          control={control}
          name="productMode"
          render={({ field }) => (
            <div className="flex gap-2">
              {(["existing", "new"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => field.onChange(mode)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-bold transition-all shadow-sm",
                    field.value === mode
                      ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 ring-offset-1 hover:bg-primary/90"
                      : "border-white/60 bg-white/40 text-slate-500 hover:bg-white/60"
                  )}
                >
                  {mode === "existing" ? "Produk Existing" : "+ Produk Baru"}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* ── Pilih existing ── */}
      {productMode === "existing" && (
        <FieldGroup>
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Pilih Green Bean</Label>
          <select
            className={cn(
              "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
              glassInput,
              errors.productId ? "border-red-500 ring-2 ring-red-500/20" : ""
            )}
            {...register("productId")}
          >
            <option value="" disabled>Pilih produk...</option>
            {gbProducts.length === 0 ? (
              <option value="_empty" disabled>Belum ada produk GB</option>
            ) : (
              gbProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.origin ? ` — ${p.origin}` : ""}
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
            <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              Nama Green Bean <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="e.g. Gayo Natural, Ethiopia Yirgacheffe"
              className={cn("h-9 font-medium", glassInput)}
              {...register("productName")}
            />
            <FieldError message={errors.productName?.message} />
          </FieldGroup>
          <FieldGroup>
            <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Asal / Origin</Label>
            <Input
              placeholder="e.g. Aceh, Ethiopia, Flores"
              className={cn("h-9", glassInput)}
              {...register("productOrigin")}
            />
          </FieldGroup>
        </div>
      )}

      <Separator className="bg-white/50" />

      {/* ── Berat & Harga ── */}
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
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
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
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
      </div>

      {/* ── Ongkir ── */}
      <button
        type="button"
        onClick={() => setShowCostDetails((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        Rincian biaya (opsional)
        <ChevronDown size={14} className={cn("transition-transform", showCostDetails && "rotate-180")} />
      </button>
      {showCostDetails && (
        <FieldGroup>
          <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Ongkos kirim yang termasuk dalam total</Label>
          <Input
            type="number"
            step="1"
            min="0"
            placeholder="0"
            className={cn("h-9 tabular-nums", glassInput)}
            {...register("shippingCost", { valueAsNumber: true })}
          />
          <FieldError message={errors.shippingCost?.message} />
        </FieldGroup>
      )}

      {/* ── HPP auto-computed ── */}
      <div className="grid grid-cols-2 gap-4">
        <ReadonlyField
          label="Total tercatat"
          value={totalCost > 0 ? formatRupiah(totalCost) : "—"}
        />
        <ReadonlyField
          label="HPP /kg (otomatis)"
          value={hppPerKg > 0 ? formatRupiah(hppPerKg) : "—"}
          hint="Total pembelian ÷ berat"
        />
      </div>

      <PurchasePaymentSection
        register={register}
        setValue={setValue}
        errors={errors}
        paymentStatus={paymentStatus}
      />

      {/* Hidden submit — dipanggil via tombol di drawer footer */}
      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}
