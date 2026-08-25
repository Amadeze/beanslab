"use client";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PurchasePaymentSection } from "./PurchasePaymentSection";
import { formatRupiah } from "@/lib/format";
import { getTodayString } from "@/lib/date-utils";
import { defaultDueDate } from "@/lib/sale-intent";
import {
  createGreenBeanPurchase,
  createRoastedBeanPurchase,
  preparePurchasedRoastedBean,
} from "../actions";
import {
  type SupplierOption,
  type GBProductOption,
  type RBProductOption,
  type CoffeeSourceOption,
} from "../types";

// =============================================================================
// Zod schema
// =============================================================================

const ROAST_LEVELS = ["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"] as const;

const schema = z
  .object({
    coffeeType: z.enum(["GREEN_BEAN", "ROASTED_BEAN"]),
    supplierId: z.string().min(1, "Wajib pilih supplier"),
    receivedAt: z.string().min(1, "Tanggal wajib diisi"),
    productMode: z.enum(["existing", "new"]),
    productId: z.string().optional(),
    productName: z.string().optional(),
    productOrigin: z.string().optional(),
    productRoastLevel: z.enum(ROAST_LEVELS),
    sourceMode: z.enum(["existing", "new"]),
    coffeeSourceId: z.string().optional(),
    sourceName: z.string().optional(),
    sourceRegion: z.string().optional(),
    sourceCountry: z.string().optional(),
    sourceSpecies: z.string().optional(),
    sourceVarietal: z.string().optional(),
    sourceProcessMethod: z.string().optional(),
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
    // Intake mutu lot (Green Bean, opsional).
    // Sengaja tidak divalidasi ketat di sini: input kosong dengan valueAsNumber
    // menghasilkan NaN, jadi dikirim sebagai unknown lalu difilter saat submit
    // (Number.isFinite) dan divalidasi ulang di server action.
    supplierLotNumber: z.string().optional(),
    moisturePct: z.unknown().optional(),
    humidityPct: z.unknown().optional(),
    harvestDate: z.string().optional(),
    defectCount: z.unknown().optional(),
    qcStatus: z.enum(["PENDING", "RELEASED", "HOLD"]).optional(),
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
    // Roasted Bean beli jadi harus punya identitas kopi (sumber + tingkat sangrai)
    if (data.coffeeType === "ROASTED_BEAN" && data.productMode === "new") {
      if (data.sourceMode === "existing" && !data.coffeeSourceId) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceName"],
          message: "Wajib pilih sumber kopi atau isi sumber kopi baru",
        });
      }
      if (data.sourceMode === "new" && (!data.sourceName || data.sourceName.trim().length < 2)) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceName"],
          message: "Nama sumber kopi minimal 2 karakter",
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

const glassInput = "bg-card/40 border-white/60 backdrop-blur-md transition-all focus:bg-card/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-card/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Field wrapper helpers
// =============================================================================

/** Input numerik opsional: kosong/NaN → undefined, angka valid → number. */
function toOptionalNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-[var(--status-danger)]">{message}</p>;
}

// =============================================================================
// Props
// =============================================================================

interface CoffeePurchaseFormProps {
  id: string;
  suppliers: SupplierOption[];
  gbProducts: GBProductOption[];
  rbProducts: RBProductOption[];
  coffeeSources: CoffeeSourceOption[];
  initialMode?: "GREEN_BEAN" | "ROASTED_BEAN";
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
  onAddSupplier?: () => void;
  preferredSupplierId?: string | null;
}

// =============================================================================
// Component
// =============================================================================

export function CoffeePurchaseForm({
  id,
  suppliers,
  gbProducts,
  rbProducts,
  coffeeSources,
  initialMode = "GREEN_BEAN",
  onSuccess,
  onPendingChange,
  onAddSupplier,
  preferredSupplierId,
}: CoffeePurchaseFormProps) {
  const router = useRouter();
  const today = getTodayString();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [showIdentityDetails, setShowIdentityDetails] = useState(false);
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
      coffeeType: initialMode,
      supplierId: "",
      receivedAt: today,
      productMode: initialMode === "GREEN_BEAN" ? (gbProducts.length > 0 ? "existing" : "new") : (rbProducts.length > 0 ? "existing" : "new"),
      productId: "",
      productName: "",
      productOrigin: "",
      productRoastLevel: "MEDIUM",
      sourceMode: coffeeSources.length > 0 ? "existing" : "new",
      coffeeSourceId: "",
      sourceName: "",
      sourceRegion: "",
      sourceCountry: "",
      sourceSpecies: "",
      sourceVarietal: "",
      sourceProcessMethod: "",
      weightKg: 0,
      totalCost: 0,
      shippingCost: 0,
      paymentStatus: "PAID",
      initialPaidAmount: 0,
      paymentMethod: "CASH",
      dueDate: "",
      notes: "",
      bestBeforeDate: "",
      supplierLotNumber: "",
      moisturePct: undefined,
      humidityPct: undefined,
      harvestDate: "",
      defectCount: undefined,
      qcStatus: "RELEASED",
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
  const coffeeType = watch("coffeeType");
  const productMode = watch("productMode");
  const sourceMode = watch("sourceMode");
  const paymentStatus = watch("paymentStatus");

  const hppPerKg = Number(weightKg) > 0 ? (Number(totalCost) || 0) / Number(weightKg) : 0;
  const isRoasted = coffeeType === "ROASTED_BEAN";

  useEffect(() => {
    if (paymentStatus !== "PAID") {
      setValue("dueDate", defaultDueDate(new Date(`${receivedAt || today}T00:00:00`), 14), { shouldValidate: true });
    } else {
      setValue("dueDate", "");
    }
  }, [paymentStatus, receivedAt, setValue, today]);

  const switchCoffeeType = (next: "GREEN_BEAN" | "ROASTED_BEAN") => {
    if (next === coffeeType) return;
    setValue("coffeeType", next, { shouldDirty: true });
    setValue(
      "productMode",
      next === "GREEN_BEAN" ? (gbProducts.length > 0 ? "existing" : "new") : (rbProducts.length > 0 ? "existing" : "new"),
      { shouldDirty: true },
    );
    setValue("productId", "");
    setValue("productName", "");
    setValue("productOrigin", "");
  };

  // ── Submit ──
  const onSubmit = async (values: FormValues) => {
    if (isSubmitting || isPreparing) return;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const isNewProduct = values.productMode === "new";
      const result = isRoasted
        ? await createRoastedBeanPurchase({
            operationKey,
            supplierId: values.supplierId,
            receivedAt: values.receivedAt,
            productId: !isNewProduct ? values.productId : undefined,
            productName: isNewProduct ? values.productName : undefined,
            productOrigin: isNewProduct ? values.productOrigin : undefined,
            productRoastLevel: values.productRoastLevel,
            coffeeSourceId: isNewProduct && values.sourceMode === "existing" && values.coffeeSourceId ? values.coffeeSourceId : undefined,
            coffeeSource: isNewProduct && values.sourceMode === "new" ? {
              name: values.sourceName ?? "",
              region: values.sourceRegion || null,
              country: values.sourceCountry || null,
              species: values.sourceSpecies || null,
              varietal: values.sourceVarietal || null,
              processMethod: values.sourceProcessMethod || null,
            } : undefined,
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
          })
        : await createGreenBeanPurchase({
            operationKey,
            supplierId: values.supplierId,
            receivedAt: values.receivedAt,
            productId: !isNewProduct ? values.productId : undefined,
            productName: isNewProduct ? values.productName : undefined,
            productOrigin: isNewProduct ? values.productOrigin : undefined,
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
            supplierLotNumber: values.supplierLotNumber || undefined,
            moisturePct: toOptionalNumber(values.moisturePct),
            humidityPct: toOptionalNumber(values.humidityPct),
            harvestDate: values.harvestDate || undefined,
            defectCount: toOptionalNumber(values.defectCount),
            qcStatus: values.qcStatus,
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
      console.error("[CoffeePurchaseForm]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  // ── Siapkan Roasted Bean beli jadi untuk PO (tanpa pembelian) ──
  const handlePrepare = async () => {
    if (isSubmitting || isPreparing) return;
    const name = watch("productName");
    const sourceOk =
      sourceMode === "existing"
        ? !!watch("coffeeSourceId")
        : (watch("sourceName")?.trim().length ?? 0) >= 2;
    if (!name || name.trim().length < 2) {
      toastSafe.error("Tulis nama Roasted Bean minimal 2 karakter");
      return;
    }
    if (!sourceOk) {
      toastSafe.error("Lengkapi sumber kopi (pilih yang ada atau isi nama baru)");
      return;
    }
    setIsPreparing(true);
    onPendingChange(true);
    try {
      const result = await preparePurchasedRoastedBean({
        productName: name,
        productOrigin: watch("productOrigin") || undefined,
        productRoastLevel: watch("productRoastLevel"),
        coffeeSourceId: sourceMode === "existing" && watch("coffeeSourceId") ? watch("coffeeSourceId") : undefined,
        coffeeSource: sourceMode === "new" ? {
          name: watch("sourceName") ?? "",
          region: watch("sourceRegion") || null,
          country: watch("sourceCountry") || null,
          species: watch("sourceSpecies") || null,
          varietal: watch("sourceVarietal") || null,
          processMethod: watch("sourceProcessMethod") || null,
        } : undefined,
      });
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success(result.created ? `Produk disiapkan — ${result.productName}` : "Produk sudah pernah disiapkan — dipakai ulang");
      setValue("productMode", "existing", { shouldDirty: true });
      setValue("productId", result.productId, { shouldDirty: true });
      router.refresh();
    } catch (err) {
      console.error("[CoffeePurchaseForm:prepare]", err);
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setIsPreparing(false);
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
              step >= s ? "bg-amber-600" : "bg-card/40"
            )} />
            <p className={cn(
              "text-[10px] uppercase font-bold mt-1.5 tracking-wider transition-colors",
              step >= s ? "text-[var(--status-warning)]" : "text-ink-tertiary"
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
              <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                Supplier <span className="text-[var(--status-danger)]">*</span>
              </Label>
              {onAddSupplier && (
                <button type="button" onClick={onAddSupplier} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-warning)] hover:text-[var(--status-warning)]">
                  <Plus size={12} /> Supplier baru
                </button>
              )}
            </div>
            <select
              className={cn(
                "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
                glassInput,
                errors.supplierId ? "border-[var(--status-danger)]/30 ring-2 ring-red-500/20" : ""
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
            <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
              Tanggal Terima <span className="text-[var(--status-danger)]">*</span>
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
          {/* ── Jenis Kopi ── */}
          <div className="grid grid-cols-2 gap-2">
            {(["GREEN_BEAN", "ROASTED_BEAN"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => switchCoffeeType(type)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-bold transition-all",
                  coffeeType === type
                    ? "border-[var(--status-warning)]/30 bg-amber-600 text-white shadow-sm"
                    : "border-white/60 bg-card/30 text-ink hover:bg-card/50"
                )}
              >
                {type === "GREEN_BEAN" ? "Green Bean" : "Roasted Bean (Beli Jadi)"}
              </button>
            ))}
          </div>

          {/* ── Produk ── */}
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
              {isRoasted ? "Roasted Bean" : "Green Bean"} <span className="text-[var(--status-danger)]">*</span>
            </Label>
            <button
              type="button"
              onClick={() => setValue("productMode", productMode === "existing" ? "new" : "existing", { shouldDirty: true })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-warning)] hover:text-[var(--status-warning)]"
            >
              <Plus size={12} /> {productMode === "existing" ? "Produk baru" : "Pilih produk lama"}
            </button>
          </div>

          {/* ── Pilih existing ── */}
          {productMode === "existing" && (
            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                Pilih {isRoasted ? "Roasted Bean" : "Green Bean"}
              </Label>
              <select
                className={cn(
                  "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
                  glassInput,
                  errors.productId ? "border-[var(--status-danger)]/30 ring-2 ring-red-500/20" : ""
                )}
                {...register("productId")}
              >
                <option value="" disabled>Pilih produk...</option>
                {isRoasted
                  ? (rbProducts.length === 0 ? (
                      <option value="_empty" disabled>Belum ada RB beli jadi — siapkan dulu di "Produk baru"</option>
                    ) : (
                      rbProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.roastLevel ? ` · ${p.roastLevel.replaceAll("_", " ")}` : ""} {p.origin ? ` — ${p.origin}` : ""}
                        </option>
                      ))
                    ))
                  : (gbProducts.length === 0 ? (
                      <option value="_empty" disabled>Belum ada produk GB</option>
                    ) : (
                      gbProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.origin ? ` — ${p.origin}` : ""}
                        </option>
                      ))
                    ))}
              </select>
              <FieldError message={errors.productId?.message} />
            </FieldGroup>
          )}

          {/* ── Produk baru ── */}
          {productMode === "new" && (
            <div className={cn(glassCard, "space-y-4")}>
              <FieldGroup>
                <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                  Nama {isRoasted ? "Roasted Bean" : "Green Bean"} <span className="text-[var(--status-danger)]">*</span>
                </Label>
                <Input
                  placeholder={isRoasted ? "e.g. Gayo Beli Jadi Medium, Ethiopia Yirgacheffe Dark" : "e.g. Gayo Natural, Ethiopia Yirgacheffe"}
                  className={cn("h-9 font-medium", glassInput)}
                  {...register("productName")}
                />
                <FieldError message={errors.productName?.message} />
              </FieldGroup>
              <FieldGroup>
                <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Asal / Origin</Label>
                <Input
                  placeholder="e.g. Aceh, Ethiopia, Flores"
                  className={cn("h-9", glassInput)}
                  {...register("productOrigin")}
                />
              </FieldGroup>

              {isRoasted && (
                <>
                  {/* ── Sumber kopi ── */}
                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                      Sumber Kopi <span className="text-[var(--status-danger)]">*</span>
                    </Label>
                    <select
                      className={cn(
                        "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
                        glassInput
                      )}
                      value={sourceMode}
                      onChange={(e) => setValue("sourceMode", e.target.value as "existing" | "new", { shouldDirty: true, shouldValidate: true })}
                    >
                      <option value="existing">Pilih sumber yang sudah ada</option>
                      <option value="new">Sumber baru</option>
                    </select>
                  </FieldGroup>

                  {sourceMode === "existing" && (
                    <FieldGroup>
                      <select
                        className={cn(
                          "w-full h-9 rounded-lg border px-3 text-sm transition-all appearance-none outline-none",
                          glassInput,
                          errors.sourceName ? "border-[var(--status-danger)]/30 ring-2 ring-red-500/20" : ""
                        )}
                        {...register("coffeeSourceId")}
                      >
                        <option value="" disabled>Pilih sumber kopi...</option>
                        {coffeeSources.length === 0 ? (
                          <option value="_empty" disabled>Belum ada sumber kopi — pilih "Sumber baru"</option>
                        ) : (
                          coffeeSources.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}{s.region ? ` — ${s.region}` : ""}{s.country ? ` (${s.country})` : ""}
                            </option>
                          ))
                        )}
                      </select>
                      <FieldError message={errors.sourceName?.message} />
                    </FieldGroup>
                  )}

                  {sourceMode === "new" && (
                    <div className="space-y-4">
                      <FieldGroup>
                        <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                          Nama Sumber Kopi <span className="text-[var(--status-danger)]">*</span>
                        </Label>
                        <Input
                          placeholder="e.g. Gayo Atu Lintang, Kopi Sumber Alam"
                          className={cn("h-9 font-medium", glassInput)}
                          {...register("sourceName")}
                        />
                        <FieldError message={errors.sourceName?.message} />
                      </FieldGroup>

                      {/* ── Detail identitas opsional ── */}
                      <button
                        type="button"
                        onClick={() => setShowIdentityDetails((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-warning)] hover:text-[var(--status-warning)]"
                      >
                        <ChevronDown size={13} className={cn("transition-transform", showIdentityDetails && "rotate-180")} />
                        {showIdentityDetails ? "Sembunyikan detail" : "Detail identitas kopi (opsional)"}
                      </button>

                      {showIdentityDetails && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-in fade-in duration-200">
                          <FieldGroup>
                            <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Wilayah / Region</Label>
                            <Input className={cn("h-9", glassInput)} placeholder="e.g. Kabupaten Gayo Lues" {...register("sourceRegion")} />
                          </FieldGroup>
                          <FieldGroup>
                            <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Negara</Label>
                            <Input className={cn("h-9", glassInput)} placeholder="e.g. Indonesia" {...register("sourceCountry")} />
                          </FieldGroup>
                          <FieldGroup>
                            <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Species</Label>
                            <Input className={cn("h-9", glassInput)} placeholder="e.g. Arabica, Robusta" {...register("sourceSpecies")} />
                          </FieldGroup>
                          <FieldGroup>
                            <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Varietal</Label>
                            <Input className={cn("h-9", glassInput)} placeholder="e.g. Tim Tim, Bourbon" {...register("sourceVarietal")} />
                          </FieldGroup>
                          <FieldGroup>
                            <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Proses</Label>
                            <Input className={cn("h-9", glassInput)} placeholder="e.g. Natural, Washed" {...register("sourceProcessMethod")} />
                          </FieldGroup>
                        </div>
                      )}
                    </div>
                  )}

                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                      Tingkat Sangrai <span className="text-[var(--status-danger)]">*</span>
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
                </>
              )}
            </div>
          )}

          {isRoasted && productMode === "new" && (
            <button
              type="button"
              onClick={handlePrepare}
              disabled={isPreparing || isSubmitting}
              className="w-full rounded-xl border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10/80 px-4 py-2.5 text-xs font-bold text-[var(--status-warning)] hover:bg-[var(--status-warning)]/15 transition-all disabled:opacity-50"
            >
              {isPreparing ? "Menyiapkan..." : "Siapkan produk untuk PO (tanpa pembelian)"}
            </button>
          )}

          {/* ── Berat & Harga ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldGroup>
              <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                Berat (kg) <span className="text-[var(--status-danger)]">*</span>
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
              <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                Total Pembelian <span className="text-[var(--status-danger)]">*</span>
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
              <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                Ongkir <span className="font-medium normal-case tracking-normal text-ink-tertiary">(opsional)</span>
              </Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                className={cn("h-9 tabular-nums font-semibold", glassInput)}
                {...register("shippingCost", { valueAsNumber: true })}
              />
              <p className="text-xs leading-4 text-ink-tertiary">Bagian dari total pembelian</p>
              <FieldError message={errors.shippingCost?.message} />
            </FieldGroup>
          </div>

          <div className="rounded-xl border border-[var(--status-success)]/30 bg-[var(--status-success)]/10/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[var(--status-success)]">Serba otomatis setelah disimpan</p>
              <p className="whitespace-nowrap text-xs font-bold tabular-nums text-[var(--status-success)]">
                {hppPerKg > 0 ? `${formatRupiah(hppPerKg)}/kg` : "HPP otomatis"}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--status-success)]">
              {isRoasted
                ? "Barang dicatat per lot, stok bertambah, dan nilai pembelian masuk ke keuangan sebagai roasted bean beli jadi."
                : "Barang dicatat per lot, stok bertambah, HPP diperbarui, dan urutan pemakaian mengikuti FIFO/FEFO."}
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className={cn(glassCard, "space-y-4")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
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

            {!isRoasted && (
              <details className="rounded-xl border border-border bg-card/40 open:bg-card/70 transition-colors" data-testid="lot-quality-section">
                <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink">
                    Detail mutu lot <span className="font-medium normal-case tracking-normal text-ink-tertiary">(opsional)</span>
                  </span>
                  <ChevronDown size={14} className="text-ink-tertiary" />
                </summary>
                <div className="grid grid-cols-1 gap-4 border-t border-border px-3 py-4 sm:grid-cols-2">
                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Lot supplier</Label>
                    <Input placeholder="Kosongkan bila tidak ada" className={cn("h-9", glassInput)} {...register("supplierLotNumber")} />
                  </FieldGroup>
                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Tanggal panen</Label>
                    <Input type="date" className={cn("h-9", glassInput)} {...register("harvestDate")} />
                  </FieldGroup>
                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                      Kadar air % <span className="font-medium normal-case tracking-normal text-ink-tertiary">(ideal 9–13)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="12"
                      className={cn("h-9 tabular-nums", glassInput)}
                      {...register("moisturePct", { valueAsNumber: true })}
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Kelembapan ruang %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="60"
                      className={cn("h-9 tabular-nums", glassInput)}
                      {...register("humidityPct", { valueAsNumber: true })}
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">
                      Jumlah defect <span className="font-medium normal-case tracking-normal text-ink-tertiary">(per 300 g, standar SCA)</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      className={cn("h-9 tabular-nums", glassInput)}
                      {...register("defectCount", { valueAsNumber: true })}
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label className="text-xs uppercase font-bold tracking-wider text-ink-tertiary">Status QC awal</Label>
                    <select
                      className={cn("h-9 rounded-lg border border-border bg-card px-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/30", glassInput)}
                      {...register("qcStatus")}
                    >
                      <option value="RELEASED">Lolos (langsung bisa di-roast)</option>
                      <option value="PENDING">Menunggu pemeriksaan</option>
                      <option value="HOLD">Karantina (tidak dialokasikan FEFO)</option>
                    </select>
                  </FieldGroup>
                </div>
              </details>
            )}

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
            className="rounded-xl border border-white/60 bg-card/30 px-5 py-2 text-sm font-semibold text-ink hover:bg-card/50 transition-all"
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
            disabled={isSubmitting || isPreparing}
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
