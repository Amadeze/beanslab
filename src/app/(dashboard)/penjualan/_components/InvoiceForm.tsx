"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Plus, Trash2, CreditCard, Banknote, QrCode, Clock, Check, ChevronsUpDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import { formatRupiah } from "@/lib/format";
import { calculateTax } from "@/lib/tax";
import {
  createInvoice,
  type ContractPriceOption,
  type CustomerOption,
  type FGStockOption,
} from "../actions";
import { getCurrentDate, getTodayString } from "@/lib/date-utils";
import { defaultDueDate, resolveCustomerUnitPrice } from "@/lib/sale-intent";

// =============================================================================
// Schema
// =============================================================================
const itemSchema = z.object({
  productId: z.string().min(1, "Pilih produk"),
  quantity: z.number().int().min(1, "Minimal 1"),
  discount: z.number().min(0),
});

const schema = z.object({
  customerId: z.string().min(1, "Wajib pilih customer"),
  items: z.array(itemSchema).min(1, "Minimal 1 item"),
  invoiceDiscount: z.number().min(0),
  tax: z.number().min(0),
  taxType: z.enum(["PPN", "PPH_21", "PPH_23", "PPH_4_2", "NONE"]).optional(),
  customTaxRate: z.number().optional(),
  pphType: z.string().optional(),
  status: z.enum(["PAID", "ISSUED"]),
  salesChannel: z.enum(["WALK_IN", "WHATSAPP", "MARKETPLACE", "B2B_DIRECT", "OTHER"]).optional(),
  paymentMethod: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// =============================================================================
// Styling
// =============================================================================
const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

// =============================================================================
// Helper Components
// =============================================================================
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "TRANSFER", label: "Transfer", icon: CreditCard },
  { value: "QRIS", label: "QRIS", icon: QrCode },
  { value: "CREDIT", label: "Piutang", icon: Clock },
];

function PaymentMethodGroup({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PAYMENT_METHODS.map((m) => {
        const Icon = m.icon;
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "border-white/80 bg-white/90 text-slate-900 shadow-sm"
                : "border-white/40 bg-white/30 text-slate-700 hover:bg-white/50"
            )}
          >
            <Icon size={14} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function TotalsSummary({ subtotal, invoiceDiscount, tax, grandTotal, taxType }: any) {
  const taxLabel = !taxType || taxType === "NONE" ? "Pajak" : taxType === "PPN" ? "PPN" : taxType === "PPH_21" ? "PPh 21" : taxType === "PPH_23" ? "PPh 23" : taxType === "PPH_4_2" ? "PPh 4(2)" : "Pajak";
  return (
    <div className={cn(glassCard, "p-5")}>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-slate-600 font-medium">
          <span>Subtotal</span>
          <span className="font-mono">{formatRupiah(subtotal)}</span>
        </div>
        {invoiceDiscount > 0 && (
          <div className="flex justify-between text-red-500 font-medium">
            <span>Diskon Nota</span>
            <span className="font-mono">- {formatRupiah(invoiceDiscount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between text-slate-600 font-medium">
            <span>{taxLabel}</span>
            <span className="font-mono">{formatRupiah(tax)}</span>
          </div>
        )}
      </div>
      
      <div className="mt-5 pt-4 border-t border-white/40">
        <div className="flex justify-between items-end text-slate-800">
          <span className="text-sm font-bold tracking-wide uppercase">Grand Total</span>
          <span className="font-mono text-2xl font-black drop-shadow-sm">{formatRupiah(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Form Component
// =============================================================================
interface InvoiceFormProps {
  id: string;
  customers: CustomerOption[];
  fgOptions: FGStockOption[];
  contractPrices: ContractPriceOption[];
  onSuccess: (invoiceId: string) => void;
  onPendingChange: (pending: boolean) => void;
  onAddCustomer?: () => void;
  preferredCustomerId?: string | null;
}

export function InvoiceForm({
  id,
  customers,
  fgOptions,
  contractPrices,
  onSuccess,
  onPendingChange,
  onAddCustomer,
  preferredCustomerId,
}: InvoiceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const today = getTodayString();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: "",
      items: [{ productId: "", quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      status: "PAID",
      salesChannel: "WALK_IN",
      paymentMethod: "CASH",
      dueDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (preferredCustomerId && customers.some((customer) => customer.id === preferredCustomerId)) {
      setValue("customerId", preferredCustomerId, { shouldDirty: true, shouldValidate: true });
    }
  }, [customers, preferredCustomerId, setValue]);

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const [watchedItems, invoiceDiscount, tax, taxType, customTaxRate, status, paymentMethod, selectedCustomerId] = watch([
    "items",
    "invoiceDiscount",
    "tax",
    "taxType",
    "customTaxRate",
    "status",
    "paymentMethod",
    "customerId",
  ]);

  const resolvePreviewPrice = (product: FGStockOption, quantity: number) => {
    const customer = customers.find((option) => option.id === selectedCustomerId);
    return resolveCustomerUnitPrice(
      product,
      customer?.tier ?? "RETAIL",
      quantity,
      contractPrices.filter((price) =>
        price.customerId === selectedCustomerId && price.productId === product.id,
      ),
    );
  };

  const subtotal = (watchedItems ?? []).reduce((acc, item) => {
    const product = fgOptions.find((option) => option.id === item.productId);
    const disc = Number(item.discount) || 0;
    const qty = Number(item.quantity) || 0;
    const price = product ? resolvePreviewPrice(product, qty).unitPrice : 0;
    return acc + (price - disc) * qty;
  }, 0);

  const effectiveTax = taxType
    ? calculateTax(subtotal, Number(invoiceDiscount) || 0, taxType, customTaxRate, null).taxAmount
    : (Number(tax) || 0);
  const grandTotal = subtotal - (Number(invoiceDiscount) || 0) + effectiveTax;

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    // Cross-field validation
    if (values.status === "PAID" && !values.paymentMethod) {
      toast.error("Pilih metode pembayaran untuk nota Lunas.");
      return;
    }
    if (values.status === "ISSUED" && !values.dueDate) {
      toast.error("Tanggal jatuh tempo wajib diisi untuk nota Tempo.");
      return;
    }

    setIsSubmitting(true);
    onPendingChange(true);

    try {
      const result = await createInvoice({
        operationKey,
        customerId: values.customerId,
        items: values.items,
        invoiceDiscount: values.invoiceDiscount,
        tax: values.tax,
        taxType: values.taxType,
        customTaxRate: values.customTaxRate,
        pphType: values.pphType,
        status: values.status,
        salesChannel: values.salesChannel as any,
        paymentMethod: values.paymentMethod as any,
        dueDate: values.dueDate || undefined,
        notes: values.notes,
      });

      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }

      toast.success(`Nota ${result.invoiceCode || ""} berhasil diterbitkan!`);
      reset();
      setShowAdvanced(false);
      setOperationKey(crypto.randomUUID());
      onSuccess(result.invoiceId);
    } catch (err) {
      console.error("[InvoiceForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Customer */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center mb-1">
          <Label className="text-xs font-semibold text-slate-700">
            Customer <span className="text-red-500">*</span>
          </Label>
          {onAddCustomer && (
            <button
              type="button"
              onClick={onAddCustomer}
              className="flex items-center gap-1 text-[10px] text-cyan-600 hover:text-cyan-700 font-medium bg-cyan-50/80 px-2 py-0.5 rounded-md transition-colors border border-cyan-100"
            >
              <Plus size={12} /> Pelanggan Baru
            </button>
          )}
        </div>
        <Controller
          control={control}
          name="customerId"
          render={({ field }) => {
            const selectedCustomer = customers.find((c) => c.id === field.value);
            return (
              <Popover>
                <PopoverTrigger
                  role="combobox"
                  className={cn(
                    "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    glassInput,
                    !field.value && "text-slate-500"
                  )}
                >
                  {selectedCustomer ? (
                    <span>
                      {selectedCustomer.name}
                      {selectedCustomer.phone && <span className="text-slate-400 ml-1">· {selectedCustomer.phone}</span>}
                    </span>
                  ) : (
                    "Cari dan pilih customer..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white/95 backdrop-blur-xl border-white/60">
                  <Command>
                    <CommandInput placeholder="Ketik nama atau nomor telepon..." />
                    <CommandList>
                      <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((c) => (
                          <CommandItem
                            value={`${c.name} ${c.phone || ""}`}
                            key={c.id}
                            onSelect={() => {
                              field.onChange(c.id);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                c.id === field.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {c.name}
                            {c.phone && <span className="text-slate-400 ml-1">· {c.phone}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            );
          }}
        />
        <FieldError message={errors.customerId?.message} />
      </div>

      <Separator className="bg-white/50" />

      {/* Items */}
      <div className="space-y-3">
        <div className="flex justify-between items-center mb-1">
          <Label className="text-xs font-semibold text-slate-700">
            Item Penjualan <span className="text-red-500">*</span>
          </Label>
          <button
            type="button"
            onClick={() => append({ productId: "", quantity: 1, discount: 0 })}
            className="flex items-center gap-1 rounded-lg border border-white/60 bg-white/30 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white/50 transition-colors shadow-sm"
          >
            <Plus size={14} /> Tambah Item
          </button>
        </div>

        {typeof errors.items?.message === "string" && (
          <FieldError message={errors.items.message} />
        )}

        <div className="space-y-4">
          {fields.map((field, index) => {
            const item = watchedItems?.[index];
            const product = fgOptions.find((option) => option.id === item?.productId);
            const disc = Number(item?.discount) || 0;
            const qty = Number(item?.quantity) || 0;
            const priceResolution = product ? resolvePreviewPrice(product, qty) : null;
            const price = priceResolution?.unitPrice ?? 0;
            const rowSubtotal = (price - disc) * qty;

            const selectedProduct = fgOptions.find((p) => p.id === item?.productId);
            const isOverStock = selectedProduct ? qty > selectedProduct.stockUnit : false;

            return (
              <div key={field.id} className="relative rounded-xl border border-white/60 bg-white/40 backdrop-blur-md p-4 shadow-sm hover:shadow transition-all group">
                
                {/* Delete button (absolute top right) */}
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="absolute -top-3 -right-2 bg-white text-red-500 border border-white/60 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 shadow-sm"
                    title="Hapus Item"
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                {/* Row 1: Product Selection */}
                <div className="mb-4">
                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Produk</Label>
                  <Controller
                    control={control}
                    name={`items.${index}.productId`}
                    render={({ field: f }) => (
                      <Popover>
                        <PopoverTrigger
                          role="combobox"
                          className={cn(
                            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-white/50 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:bg-white/80",
                            !f.value && "text-slate-500"
                          )}
                        >
                          {f.value ? (
                            <span className="truncate text-left font-medium text-slate-800">
                              {fgOptions.find((p) => p.id === f.value)?.name}
                            </span>
                          ) : (
                            "Pilih produk..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white/95 backdrop-blur-xl border-white/60">
                          <Command>
                            <CommandInput placeholder="Cari produk..." />
                            <CommandList>
                              <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                              <CommandGroup>
                                {fgOptions.map((fg) => (
                                  <CommandItem
                                    key={fg.id}
                                    value={`${fg.name} ${fg.stockUnit}`}
                                    disabled={
                                      fg.stockUnit <= 0
                                      || watchedItems.some((other, otherIndex) => otherIndex !== index && other.productId === fg.id)
                                    }
                                    onSelect={() => {
                                      f.onChange(fg.id);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0",
                                        fg.id === f.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="truncate">{fg.name}</span>
                                    <span className="ml-1 text-slate-400 shrink-0">({fg.stockUnit})</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>

                {/* Row 2: Details */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-20">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      max={selectedProduct?.stockUnit}
                      className={cn(glassInput, "text-center h-9 font-medium")}
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">
                      {priceResolution?.priceSource === "CONTRACT" ? "Harga kontrak" : "Harga otomatis"}
                    </Label>
                    <div className="flex h-9 items-center justify-end rounded-md border border-white/40 bg-white/50 px-3 font-mono text-sm font-semibold text-slate-700">
                      {formatRupiah(price)}
                    </div>
                  </div>
                  {showAdvanced && <div className="flex-1 min-w-[100px]">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Disc (Rp)</Label>
                    <Input
                      type="number"
                      className={cn(glassInput, "text-right h-9 font-medium text-red-600")}
                      {...register(`items.${index}.discount`, { valueAsNumber: true })}
                    />
                  </div>}
                  <div className="flex-[1.2] min-w-[120px]">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider text-right">Subtotal</Label>
                    <div className="h-9 flex items-center justify-end font-mono text-sm font-bold text-slate-800 bg-white/50 rounded-md px-3 border border-white/40 shadow-inner">
                      {formatRupiah(rowSubtotal)}
                    </div>
                  </div>
                </div>
                {isOverStock && (
                  <p className="mt-2 text-xs font-semibold text-red-600" role="alert">
                    Stok tidak cukup. Tersedia {selectedProduct?.stockUnit ?? 0} unit.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((value) => !value)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/50 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-white"
        aria-expanded={showAdvanced}
      >
        <span className="inline-flex items-center gap-2"><SlidersHorizontal size={14} /> Diskon, pajak, dan catatan</span>
        <span className="font-normal text-slate-400">{showAdvanced ? "Sembunyikan" : "Opsional"}</span>
      </button>

      <div className="mt-8 pt-6 border-t border-white/40 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Settings & Notes */}
        <div className="space-y-5">
          {/* Sales Channel */}
          <div>
            <Label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">
              Sales Channel <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="salesChannel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn("w-full h-11", glassInput)}>
                    <SelectValue placeholder="Pilih channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALK_IN">Walk-in (Offline)</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="MARKETPLACE">Marketplace</SelectItem>
                    <SelectItem value="B2B_DIRECT">B2B Direct</SelectItem>
                    <SelectItem value="OTHER">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">
              Status Pembayaran <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <div className="flex gap-3">
                  {(["PAID", "ISSUED"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        field.onChange(s);
                        if (s === "PAID") {
                          setValue("dueDate", "");
                          setValue("paymentMethod", "CASH", { shouldValidate: true });
                        }
                        if (s === "ISSUED") {
                          setValue("paymentMethod", undefined);
                          setValue("dueDate", defaultDueDate(getCurrentDate(), 14), { shouldValidate: true });
                        }
                      }}
                      className={cn(
                        "flex-1 py-3 rounded-xl border font-bold transition-all shadow-sm",
                        field.value === s
                          ? s === "PAID"
                            ? "border-emerald-400 bg-emerald-50/90 text-emerald-700 ring-2 ring-emerald-500/20 ring-offset-1"
                            : "border-amber-400 bg-amber-50/90 text-amber-700 ring-2 ring-amber-500/20 ring-offset-1"
                          : "border-white/60 bg-white/40 hover:bg-white/60 text-slate-500"
                      )}
                    >
                      {s === "PAID" ? "✓ LUNAS" : "⏱ TEMPO"}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Payment Method */}
          {status === "PAID" && (
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">
                Metode Pembayaran <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <PaymentMethodGroup
                    value={field.value ?? "CASH"}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          )}

          {/* Due Date */}
          {status === "ISSUED" && (
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">
                Jatuh Tempo <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                min={today}
                className={glassInput}
                {...register("dueDate")}
              />
            </div>
          )}

          {/* Notes */}
          {showAdvanced && <div>
            <Label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">Catatan</Label>
            <Textarea
              placeholder="Catatan pengiriman, kesepakatan khusus, dll..."
              className={cn(glassInput, "resize-none")}
              rows={2}
              {...register("notes")}
            />
          </div>}
        </div>

        {/* Right Column: Totals Summary */}
        <div className="space-y-4">
          {showAdvanced && <div className={cn(glassCard, "p-4 space-y-4")}>
            <div className="flex items-center justify-between gap-4">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Diskon Nota (Rp)</Label>
              <Input
                type="number"
                className={cn(glassInput, "w-32 text-right font-medium text-red-600")}
                {...register("invoiceDiscount", { valueAsNumber: true })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Jenis Pajak</Label>
              <Select
                value={taxType}
                onValueChange={(v) => setValue("taxType", v as "PPN" | "PPH_21" | "PPH_23" | "PPH_4_2" | "NONE" | undefined)}
              >
                <SelectTrigger className={cn(glassInput, "w-44 text-xs")}>
                  <SelectValue placeholder="Manual (Rp)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PPN" className="text-xs">PPN 11%</SelectItem>
                  <SelectItem value="PPH_21" className="text-xs">PPh 21</SelectItem>
                  <SelectItem value="PPH_23" className="text-xs">PPh 23</SelectItem>
                  <SelectItem value="PPH_4_2" className="text-xs">PPh 4(2)</SelectItem>
                  <SelectItem value="NONE" className="text-xs">Tidak Ada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {taxType === "PPH_21" && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-slate-700">Jenis PPh</Label>
                <Input
                  type="text"
                  placeholder="PPh 21, 23, 4(2)..."
                  className={cn(glassInput, "w-44 text-right text-xs font-medium")}
                  {...register("pphType")}
                />
              </div>
            )}
            {taxType && taxType !== "NONE" && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-slate-700">Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className={cn(glassInput, "w-32 text-right font-medium")}
                  {...register("customTaxRate", { valueAsNumber: true })}
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Pajak Manual (Rp)</Label>
              <Input
                type="number"
                className={cn(glassInput, "w-32 text-right font-medium")}
                {...register("tax", { valueAsNumber: true })}
              />
            </div>
          </div>}
          
          <TotalsSummary
            subtotal={subtotal}
            invoiceDiscount={invoiceDiscount || 0}
            tax={effectiveTax}
            taxType={taxType}
            grandTotal={grandTotal}
          />
        </div>
      </div>

      <button type="submit" className="hidden" disabled={isSubmitting} />
    </form>
  );
}
