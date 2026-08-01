"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { createInvoice } from "../../penjualan/actions";
import type { ContractPriceOption, CustomerOption, FGStockOption } from "../../penjualan/actions";
import { CustomerForm } from "../../master-data/_components/CustomerForm";
import { createCustomer } from "../../master-data/actions";
import { resolveCustomerUnitPrice } from "@/lib/sale-intent";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StandardDrawer } from "@/components/StandardDrawer";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type PaymentMethod = "CASH" | "QRIS" | "TRANSFER";

export function CashierClient({
  customers,
  products,
  contractPrices,
}: {
  customers: CustomerOption[];
  products: FGStockOption[];
  contractPrices: ContractPriceOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [customerId, setCustomerId] = useState(
    () => customerOptions.find((customer) => customer.tier === "RETAIL")?.id ?? customerOptions[0]?.id ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ id: string; code: string } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [isCustomerSubmitting, setIsCustomerSubmitting] = useState(false);

  const selectedCustomer = customerOptions.find((customer) => customer.id === customerId);
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      `${product.name} ${product.code}`.toLowerCase().includes(normalized),
    );
  }, [products, query]);

  const cartRows = useMemo(
    () => products
      .filter((product) => (cart[product.id] ?? 0) > 0)
      .map((product) => {
        const quantity = cart[product.id] ?? 0;
        const resolvedPrice = resolveCustomerUnitPrice(
          product,
          selectedCustomer?.tier ?? "RETAIL",
          quantity,
          contractPrices.filter((price) =>
            price.customerId === selectedCustomer?.id && price.productId === product.id,
          ),
        );
        return {
          product,
          quantity,
          unitPrice: resolvedPrice.unitPrice,
          priceSource: resolvedPrice.priceSource,
          subtotal: quantity * resolvedPrice.unitPrice,
        };
      }),
    [cart, contractPrices, products, selectedCustomer?.id, selectedCustomer?.tier],
  );
  const total = cartRows.reduce((sum, row) => sum + row.subtotal, 0);
  const totalUnits = cartRows.reduce((sum, row) => sum + row.quantity, 0);

  function changeQuantity(product: FGStockOption, delta: number) {
    setCompletedSale(null);
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(product.stockUnit, (current[product.id] ?? 0) + delta));
      if (nextQuantity === 0) {
        const { [product.id]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [product.id]: nextQuantity };
    });
  }

  async function checkout() {
    if (!customerId) {
      toast.error("Pilih pelanggan sebelum memproses pembayaran.");
      return;
    }
    if (cartRows.length === 0) {
      toast.error("Keranjang masih kosong.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createInvoice({
        operationKey,
        customerId,
        items: cartRows.map((row) => ({
          productId: row.product.id,
          quantity: row.quantity,
          discount: 0,
        })),
        invoiceDiscount: 0,
        tax: 0,
        taxType: "NONE",
        status: "PAID",
        paymentMethod,
        notes: "Penjualan offline melalui Kasir roastd.id",
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setCompletedSale({ id: result.invoiceId, code: result.invoiceCode });
      setCart({});
      setMobileCartOpen(false);
      setOperationKey(crypto.randomUUID());
      toast.success(`Transaksi ${result.invoiceCode} berhasil dibayar.`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#E9EEED]">
      <PageHeader
        title="Buka Kasir"
        eyebrow="Penjualan offline"
        description={`${totalUnits} item · ${formatRupiah(total)}`}
        stage="sales"
        actions={
          <div className="flex items-center gap-2 px-2 text-xs font-semibold text-white/70">
            <ShoppingCart size={15} />
            {totalUnits} item · {formatRupiah(total)}
          </div>
        }
        mobileActions={
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[9px] bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <ShoppingCart size={14} />
            Keranjang {totalUnits}
          </button>
        }
      />
      <WorkspaceNav kind="sales" />

      {completedSale ? (
        <div className="border-b border-emerald-200 bg-emerald-50">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <CheckCircle2 size={17} />
              {completedSale.code} sudah dibayar dan stok telah diperbarui.
            </div>
            <Link
              href={`/nota/${completedSale.id}?print=true`}
              target="_blank"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <Printer size={14} />
              Cetak nota
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="custom-scrollbar min-h-0 overflow-y-auto p-4 pb-24 md:p-6 lg:pb-6" aria-label="Daftar produk">
          <div className="mx-auto max-w-[1300px]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <span className="sr-only">Cari produk</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari nama atau kode produk…"
                  className="h-11 w-full rounded-lg border border-stone-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
                />
              </label>
              <div className="flex flex-1 gap-2 min-w-[240px]">
                <label className="flex-1 relative">
                  <span className="sr-only">Pelanggan</span>
                  <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger
                      role="combobox"
                      aria-expanded={customerPopoverOpen}
                      className={cn(
                        "flex h-11 w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10",
                        !customerId && "text-slate-500"
                      )}
                    >
                      {customerId ? (
                        <span className="truncate">
                          {customerOptions.find((c) => c.id === customerId)?.name}
                        </span>
                      ) : (
                        "Cari dan pilih pelanggan..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white shadow-xl rounded-xl border border-stone-200">
                      <Command>
                        <CommandInput placeholder="Ketik nama atau telepon..." />
                        <CommandList>
                          <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {customerOptions.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.phone || ""}`}
                                onSelect={() => {
                                  setCustomerId(c.id);
                                  setCustomerPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    customerId === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {c.name}
                                {c.phone && <span className="text-stone-400 ml-1">· {c.phone}</span>}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const existing = customerOptions.find(c => c.name.toLowerCase().includes("walk-in"));
                    if (existing) {
                      setCustomerId(existing.id);
                      return;
                    }
                    const toastId = toast.loading("Membuat pelanggan Walk-in...");
                    try {
                      const result = await createCustomer({
                        name: "Walk-in (Umum)",
                        tier: "RETAIL",
                        phone: "",
                        email: "",
                        address: ""
                      });
                      if (!result.success) {
                        toast.error(result.error || "Gagal membuat pelanggan", { id: toastId });
                      } else if (result.data) {
                        setCustomerOptions((prev) => [result.data as CustomerOption, ...prev]);
                        setCustomerId(result.data.id);
                        toast.success("Pelanggan Walk-in berhasil dibuat", { id: toastId });
                      }
                    } catch (error) {
                      toast.error("Terjadi kesalahan sistem", { id: toastId });
                    }
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Walk-in
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerDrawerOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-stone-900 text-white hover:bg-stone-800"
                  title="Tambah Pelanggan Baru"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {customers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
                <p className="text-sm font-semibold text-stone-900">Kasir membutuhkan minimal satu pelanggan</p>
                <p className="mt-1 text-xs text-stone-500">Tambahkan “Pelanggan Umum” untuk transaksi walk-in.</p>
                <Link href="/penjualan/pelanggan" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-stone-900 px-4 text-xs font-semibold text-white">
                  Tambah pelanggan
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((product) => {
                  const quantity = cart[product.id] ?? 0;
                  const priceResolution = resolveCustomerUnitPrice(
                    product,
                    selectedCustomer?.tier ?? "RETAIL",
                    Math.max(1, quantity),
                    contractPrices.filter((price) =>
                      price.customerId === selectedCustomer?.id && price.productId === product.id,
                    ),
                  );
                  const price = priceResolution.unitPrice;
                  const unavailable = product.stockUnit <= 0;
                  return (
                    <article key={product.id} className="relative flex min-h-[154px] flex-col rounded-xl border border-stone-200 bg-white p-3.5">
                      {quantity > 0 ? (
                        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-sm ring-2 ring-white">
                          {quantity}
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold uppercase tracking-wide text-stone-400">{product.code}</p>
                        <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-stone-900">{product.name}</h2>
                        <p className={cn("mt-1 text-[11px] font-medium", unavailable ? "text-red-600" : "text-stone-500")}>
                          {unavailable ? "Stok habis" : `${product.stockUnit} pcs tersedia`}
                        </p>
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        <span className="text-xs font-bold tabular-nums text-stone-900">
                          {formatRupiah(price)}
                          {priceResolution.priceSource === "CONTRACT" ? (
                            <span className="ml-1 text-[9px] font-semibold uppercase text-emerald-700">Kontrak</span>
                          ) : null}
                        </span>
                        {quantity > 0 ? (
                          <div className="flex items-center rounded-lg border border-stone-200">
                            <button type="button" onClick={() => changeQuantity(product, -1)} className="flex h-9 w-9 items-center justify-center text-stone-600 hover:bg-stone-100" aria-label={`Kurangi ${product.name}`}>
                              <Minus size={14} />
                            </button>
                            <span className="w-7 text-center text-xs font-bold tabular-nums">{quantity}</span>
                            <button type="button" onClick={() => changeQuantity(product, 1)} disabled={quantity >= product.stockUnit} className="flex h-9 w-9 items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-30" aria-label={`Tambah ${product.name}`}>
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => changeQuantity(product, 1)} disabled={unavailable} className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400" aria-label={`Tambah ${product.name}`}>
                            <Plus size={15} />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="custom-scrollbar hidden min-h-0 border-t border-stone-200 bg-white lg:block lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Keranjang kasir">
          <div className="flex min-h-14 items-center justify-between border-b border-stone-200 px-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Keranjang</h2>
              <p className="text-[11px] text-stone-500">{selectedCustomer?.name ?? "Belum memilih pelanggan"}</p>
            </div>
            {cartRows.length > 0 ? (
              <button type="button" onClick={() => setCart({})} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                <Trash2 size={13} /> Kosongkan
              </button>
            ) : null}
          </div>

          <div className="min-h-[190px] divide-y divide-stone-100">
            {cartRows.length === 0 ? (
              <div className="flex min-h-[190px] flex-col items-center justify-center px-6 text-center text-stone-400">
                <ShoppingCart size={28} />
                <p className="mt-2 text-xs font-medium">Pilih produk untuk mulai transaksi.</p>
              </div>
            ) : cartRows.map((row) => (
              <div key={row.product.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-stone-900">{row.product.name}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{row.quantity} × {formatRupiah(row.unitPrice)}</p>
                </div>
                <p className="text-xs font-bold tabular-nums text-stone-900">{formatRupiah(row.subtotal)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-stone-200 p-4">
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Metode pembayaran</legend>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "CASH", label: "Tunai", icon: Banknote },
                  { id: "QRIS", label: "QRIS", icon: QrCode },
                  { id: "TRANSFER", label: "Transfer", icon: CreditCard },
                ].map((method) => {
                  const Icon = method.icon;
                  const active = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                      className={cn(
                        "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-semibold",
                        active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-600 hover:bg-stone-50",
                      )}
                    >
                      <Icon size={15} />
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <dl className="mt-4 border-t border-stone-200 pt-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-semibold text-stone-700">Total</dt>
                <dd className="text-xl font-bold tabular-nums tracking-tight text-stone-950">{formatRupiah(total)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={checkout}
              disabled={submitting || cartRows.length === 0 || !customerId}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-bold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
            >
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <Banknote size={17} />}
              {submitting ? "Memproses…" : `Bayar ${formatRupiah(total)}`}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile Persistent Total Bar */}
      <div className="fixed bottom-[calc(78px+env(safe-area-inset-bottom,0px))] left-4 right-4 z-30 flex min-h-14 items-center justify-between overflow-hidden rounded-xl bg-stone-900 shadow-2xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-stone-800 transition-colors"
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            <ShoppingCart size={15} />
            {totalUnits > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {totalUnits}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-medium text-stone-400">Total belanja</span>
            <span className="truncate text-sm font-bold tracking-tight text-white">{formatRupiah(total)}</span>
          </div>
        </button>
        <button
          type="button"
          onClick={checkout}
          disabled={submitting || cartRows.length === 0 || !customerId}
          className="flex h-full min-h-14 items-center justify-center gap-1.5 bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 transition-colors"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? "Proses..." : "Bayar"}
        </button>
      </div>

      <StandardDrawer
        open={mobileCartOpen}
        onOpenChange={setMobileCartOpen}
        title="Keranjang Kasir"
        description={selectedCustomer?.name ?? "Pilih pelanggan sebelum membayar"}
        size="sm"
        submitButton={
          <button
            type="button"
            onClick={checkout}
            disabled={submitting || cartRows.length === 0 || !customerId}
            className="inline-flex min-h-10 items-center justify-center gap-2 bg-stone-900 px-4 text-xs font-bold text-white disabled:bg-stone-200 disabled:text-stone-500"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Banknote size={15} />}
            {submitting ? "Memproses…" : `Bayar ${formatRupiah(total)}`}
          </button>
        }
      >
        <div className="space-y-5">
          {cartRows.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-stone-400">
              <ShoppingCart size={26} />
              <p className="mt-2 text-xs font-medium">Keranjang masih kosong.</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
              {cartRows.map((row) => (
                <div key={row.product.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-stone-900">{row.product.name}</p>
                    <div className="mt-2 flex w-fit items-center rounded-lg border border-stone-200">
                      <button type="button" onClick={() => changeQuantity(row.product, -1)} className="flex h-9 w-9 items-center justify-center" aria-label={`Kurangi ${row.product.name}`}>
                        <Minus size={13} />
                      </button>
                      <span className="w-7 text-center text-xs font-bold">{row.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(row.product, 1)} className="flex h-9 w-9 items-center justify-center" aria-label={`Tambah ${row.product.name}`}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-bold tabular-nums text-stone-900">{formatRupiah(row.subtotal)}</p>
                </div>
              ))}
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Metode pembayaran</legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "CASH", label: "Tunai", icon: Banknote },
                { id: "QRIS", label: "QRIS", icon: QrCode },
                { id: "TRANSFER", label: "Transfer", icon: CreditCard },
              ].map((method) => {
                const Icon = method.icon;
                const active = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-semibold",
                      active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-600",
                    )}
                  >
                    <Icon size={15} />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-between border-t border-stone-200 pt-4">
            <span className="text-sm font-semibold text-stone-700">Total</span>
            <span className="text-xl font-bold tabular-nums text-stone-950">{formatRupiah(total)}</span>
          </div>
        </div>
      </StandardDrawer>

      <StandardDrawer
        open={customerDrawerOpen}
        onOpenChange={setCustomerDrawerOpen}
        title="Pelanggan Baru"
        description="Tambahkan data pelanggan baru untuk kasir."
        submitButton={
          <button
            type="submit"
            form="new-customer-form"
            disabled={isCustomerSubmitting}
            className="inline-flex min-h-10 items-center justify-center gap-2 bg-stone-900 px-4 text-xs font-bold text-white disabled:bg-stone-200 disabled:text-stone-500"
          >
            {isCustomerSubmitting ? <Loader2 size={15} className="animate-spin" /> : null}
            {isCustomerSubmitting ? "Menyimpan..." : "Simpan Pelanggan"}
          </button>
        }
      >
        <CustomerForm
          id="new-customer-form"
          onPendingChange={setIsCustomerSubmitting}
          onSuccess={(customer) => {
            if (customer) {
              setCustomerOptions((current) => [
                customer as CustomerOption,
                ...current.filter((item) => item.id !== customer.id),
              ]);
              setCustomerId(customer.id);
            }
            setCustomerDrawerOpen(false);
          }}
        />
      </StandardDrawer>
    </div>
  );
}
