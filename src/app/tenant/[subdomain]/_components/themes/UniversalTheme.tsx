"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Package, Phone, X, CheckCircle } from "@phosphor-icons/react";
import { ThemeProps } from "./ThemeProps";
import { useState } from "react";
import type { StorefrontOffering } from "@/lib/storefront-grind";

// =============================================================================
// STOREFRONT SHELL
// =============================================================================
// PortalThemeRenderer is the only storefront renderer. This shell contributes
// cart and checkout UI as children so it shares the same theme-token scope.
// =============================================================================

import { PortalThemeRenderer } from "@/features/portal-theme/components/PortalThemeRenderer";
import { STOREFRONT_GRIND_LABEL } from "@/lib/storefront-grind";
import { CourierShippingSearch } from "../CourierShippingSearch";

export function UniversalTheme({
  tenant, cart, isCartOpen, setIsCartOpen, customerName, setCustomerName, customerPhone, setCustomerPhone,
  customerAddress, setCustomerAddress, shippingMethod, setShippingMethod, handleAddToCart, handleAddOfferingToCart, handleCheckout,
  isCheckingOut,
  paymentMethodId, setPaymentMethodId,
  courierShipping, setCourierShipping, courierShippingCartItems,
  courierRateChangedError, onClearRateChanged,
  taxRate = 0,
}: ThemeProps) {

  const products = tenant.products || [];
  const offerings: StorefrontOffering[] = tenant.offerings || [];
  const cartItems = cart.items[tenant.subdomain || ""] || [];

  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);

  const cartSubtotal = cart.getTotalPrice(tenant.subdomain || "");
  const isCourier = shippingMethod === "COURIER";
  const isPickup = shippingMethod === "PICKUP";

  let shippingCost = 0;
  if (!isPickup) {
    if (isCourier && courierShipping?.shippingCost) {
      shippingCost = courierShipping.shippingCost;
    } else if (!isCourier) {
      const freeShipping = tenant.storefrontFreeShippingMinimum != null
        && cartSubtotal >= Number(tenant.storefrontFreeShippingMinimum);
      shippingCost = freeShipping ? 0 : Math.max(0, Math.round(Number(tenant.storefrontFlatShippingRate || 0)));
    }
  }

  const tax = Math.max(0, Math.round(cartSubtotal * Math.max(0, taxRate) / 100));
  const grandTotal = cartSubtotal + tax + shippingCost;

  return (
    <PortalThemeRenderer
      config={tenant.portalThemeConfig}
      products={products}
      offerings={offerings}
      onAddToCart={handleAddToCart}
      onAddOfferingToCart={handleAddOfferingToCart}
      onOpenCart={() => setIsCartOpen(true)}
      cartItemCount={cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0)}
    >

      {/* ═══ FLOATING CART BUTTON ═══ */}
      {cartItems.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-full bg-amber-500 text-gray-950 font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all border border-amber-300/40"
        >
          <div className="relative">
            <Coffee size={22} weight="bold" />
          </div>
          <span>Keranjang ({cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0)})</span>
          <span className="bg-gray-950 text-white text-xs px-2 py-0.5 rounded-full">
            Rp {grandTotal.toLocaleString("id-ID")}
          </span>
        </button>
      )}

      {/* ═══ GLOBAL CART DRAWER ═══ */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-md"
              onClick={() => setIsCartOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full sm:max-w-md h-full flex flex-col overflow-hidden bg-[var(--portal-surface)] text-[var(--portal-text)] shadow-2xl"
            >
              {/* Cart Header */}
              <div className="p-4 md:p-5 flex justify-between items-center flex-shrink-0 border-b border-[var(--portal-border)]">
                <h2 className="text-lg font-bold tracking-tight text-[var(--portal-text)]">
                  Keranjang
                </h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  aria-label="Tutup keranjang"
                  className="w-9 h-9 rounded-[var(--portal-radius)] flex items-center justify-center transition-all hover:bg-[var(--portal-bg)] text-[var(--portal-text-muted)]"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-auto p-5 md:p-6 space-y-5">
                {cartItems.length === 0 ? (
                  <div className="text-center py-16 text-[var(--portal-text-muted)]">
                    <Package size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-sm font-medium">Keranjang kosong</p>
                    <p className="text-xs mt-1 opacity-60">Tambahkan produk untuk mulai berbelanja.</p>
                  </div>
                ) : (
                  cartItems.map((item: any) => (
                    <motion.div
                      layout
                      key={item.id}
                      className="flex gap-4 items-center"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={item.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Coffee size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold line-clamp-1 mb-1 text-[var(--portal-text)]">
                          {item.name}
                        </h4>
                        <p className="text-xs mb-2 text-[var(--portal-text-muted)]">
                          Rp {item.price.toLocaleString("id-ID")}
                        </p>
<p className="text-[11px] font-semibold text-[var(--portal-primary)]">
                          {item.packageName ? `${item.packageName} · ` : ""}
                          {item.grindSize
                            ? (item.grindSize === "CUSTOM" ? item.customGrindLabel : STOREFRONT_GRIND_LABEL[item.grindSize as keyof typeof STOREFRONT_GRIND_LABEL])
                            : STOREFRONT_GRIND_LABEL.WHOLE_BEAN}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cart.updateQuantity(tenant.subdomain || "", item.id, -1)}
                            aria-label={`Kurangi ${item.name}`}
                            className="w-7 h-7 rounded-[var(--portal-radius)] flex items-center justify-center text-xs font-bold transition-colors border border-[var(--portal-border)] hover:bg-[var(--portal-bg)] text-[var(--portal-text)]"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold w-5 text-center text-[var(--portal-text)]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => cart.updateQuantity(tenant.subdomain || "", item.id, 1)}
                            aria-label={`Tambah ${item.name}`}
                            className="w-7 h-7 rounded-[var(--portal-radius)] flex items-center justify-center text-xs font-bold transition-colors border border-[var(--portal-border)] hover:bg-[var(--portal-bg)] text-[var(--portal-text)]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[var(--portal-text)]">
                          Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                        </p>
                        <button
                          onClick={() => cart.removeItem(tenant.subdomain || "", item.id)}
                          className="text-xs mt-1 font-semibold text-red-500 hover:text-red-700"
                        >
                          Hapus
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}

                {/* Checkout Form */}
                {cartItems.length > 0 && (
                  <div className="pt-6 space-y-4 border-t border-[var(--portal-border)] mt-6">
                    <h3 className="text-sm font-bold text-[var(--portal-text)] uppercase tracking-wider mb-2">
                      Detail Pengiriman
                    </h3>
                    <input
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="w-full bg-[var(--portal-bg)] text-[var(--portal-text)] border border-[var(--portal-border)] rounded-[var(--portal-radius)] px-4 py-3 text-base focus:outline-none focus:border-[var(--portal-primary)] focus:ring-1 focus:ring-[var(--portal-primary)] transition-colors"
                    />
                    <input
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="Nomor WhatsApp"
                      type="tel"
                      className="w-full bg-[var(--portal-bg)] text-[var(--portal-text)] border border-[var(--portal-border)] rounded-[var(--portal-radius)] px-4 py-3 text-base focus:outline-none focus:border-[var(--portal-primary)] focus:ring-1 focus:ring-[var(--portal-primary)] transition-colors"
                    />
                    {shippingMethod !== "PICKUP" ? <textarea
                      value={customerAddress}
                      onChange={e => setCustomerAddress(e.target.value)}
                      placeholder="Alamat Lengkap (Jalan, Kec, Kota, Kode Pos)"
                      rows={3}
                      className="w-full bg-[var(--portal-bg)] text-[var(--portal-text)] border border-[var(--portal-border)] rounded-[var(--portal-radius)] px-4 py-3 text-base focus:outline-none focus:border-[var(--portal-primary)] focus:ring-1 focus:ring-[var(--portal-primary)] transition-colors"
                    /> : null}

                    <div className="mb-4 mt-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Metode Pengiriman</label>
                      <select
                        value={shippingMethod}
                        onChange={e => setShippingMethod(e.target.value)}
                        className="w-full border border-[var(--portal-border)] rounded-[var(--portal-radius)] px-4 py-3 text-base focus:outline-none focus:border-[var(--portal-primary)] focus:ring-1 focus:ring-[var(--portal-primary)] transition-colors bg-[var(--portal-bg)] text-[var(--portal-text)]"
                      >
                        {tenant.storefrontPickupEnabled ? <option value="PICKUP">Ambil di roastery · gratis</option> : null}
                        {tenant.storefrontDeliveryEnabled ? <>
                          <option value="LOCAL_DELIVERY">Kurir lokal</option>
                          <option value="STORE_COURIER">Kurir roastery</option>
                          <option value="COURIER">Ekspedisi luar kota</option>
                        </> : null}
                      </select>
                      {!isCourier && shippingMethod !== "PICKUP" && <p className="mt-2 text-xs text-[var(--portal-text-muted)]">Ongkir {tenant.storefrontFreeShippingMinimum && cartSubtotal >= Number(tenant.storefrontFreeShippingMinimum) ? "gratis" : `Rp ${Number(tenant.storefrontFlatShippingRate || 0).toLocaleString("id-ID")}`}; total final dihitung aman di server.</p>}
                    </div>

                    {/* COURIER destination + quote search */}
                    {isCourier && setCourierShipping && courierShippingCartItems && (
                      <CourierShippingSearch
                        subdomain={tenant.subdomain || ""}
                        cartItems={courierShippingCartItems}
                        onShippingChange={setCourierShipping}
                        rateChangedError={courierRateChangedError ?? null}
                        onClearRateChanged={onClearRateChanged || (() => {})}
                      />
                    )}

                    {tenant.paymentMethods?.length ? (
                      <div className="mb-4 mt-2">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Metode Pembayaran</label>
                        <div className="space-y-2">
                          {tenant.paymentMethods.map((method: any) => (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => setPaymentMethodId?.(method.id)}
                              className={`w-full rounded-[var(--portal-radius)] border px-4 py-3 text-left text-sm transition-colors ${paymentMethodId === method.id ? "border-[var(--portal-primary)] bg-[var(--portal-bg)] ring-1 ring-[var(--portal-primary)]" : "border-[var(--portal-border)] bg-[var(--portal-bg)]"}`}
                            >
                              <span className="block font-bold text-[var(--portal-text)]">{method.label}</span>
                              <span className="mt-0.5 block text-xs text-[var(--portal-text-muted)]">{method.method === "QRIS" ? "Scan QRIS setelah pesanan dibuat" : `${method.bankName} • ${method.accountNumber}`}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cartItems.length > 0 && (
                <div className="p-4 md:p-5 flex-shrink-0 border-t border-[var(--portal-border)] bg-[var(--portal-bg)]">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[var(--portal-text-muted)]">Subtotal</span>
                      <span className="font-semibold text-[var(--portal-text)]">
                        Rp {cartSubtotal.toLocaleString("id-ID")}
                      </span>
                    </div>
                    {tax > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--portal-text-muted)]">Pajak ({taxRate}%)</span>
                        <span className="font-semibold text-[var(--portal-text)]">
                          Rp {tax.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    {!isPickup && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--portal-text-muted)]">Ongkir</span>
                        <span className="font-semibold text-[var(--portal-text)]">
                          {isCourier && courierShipping?.selectedRate
                            ? `${courierShipping.selectedRate.courierName} · Rp ${shippingCost.toLocaleString("id-ID")}`
                            : shippingCost === 0
                              ? "Gratis"
                              : `Rp ${shippingCost.toLocaleString("id-ID")}`}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-[var(--portal-border)] pt-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-[var(--portal-text)]">Total</span>
                      <span className="text-xl font-black text-[var(--portal-text)]">
                        Rp {grandTotal.toLocaleString("id-ID")}
                      </span>
                    </div>
                    {!isPickup && !isCourier && (
                      <p className="text-[11px] text-[var(--portal-text-muted)] text-right">
                        Ongkir final dihitung di server.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (!customerName || !customerPhone || (shippingMethod !== "PICKUP" && !customerAddress)) {
                        handleCheckout();
                        return;
                      }
                      if (tenant.paymentMethods?.length && !paymentMethodId) {
                        handleCheckout();
                        return;
                      }
                      setIsConfirmingOrder(true);
                    }}
                    disabled={isCheckingOut}
                    className="w-full py-4 rounded-[var(--portal-radius)] font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 bg-[var(--portal-primary)] text-[var(--portal-bg)] shadow-lg disabled:cursor-wait disabled:opacity-60"
                  >
                    <Phone size={18} weight="bold" />
                    {isCheckingOut ? "Memproses Pesanan..." : tenant.paymentMethods?.length ? "Lanjut ke Konfirmasi" : "Checkout Sekarang"}
                  </button>
                </div>
              )}
            </motion.div>

            {/* Order Confirmation Modal */}
            <AnimatePresence>
              {isConfirmingOrder && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-sm overflow-hidden rounded-[var(--portal-radius)] bg-[var(--portal-surface)] p-6 text-[var(--portal-text)] shadow-2xl"
                  >
                    <div className="mb-4 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]">
                        <CheckCircle size={32} weight="fill" />
                      </div>
                      <h3 className="text-xl font-bold">Konfirmasi Pesanan</h3>
                      <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
                        Pastikan detail pesanan Anda sudah benar sebelum diproses.
                      </p>
                    </div>

                    <div className="mb-6 space-y-3 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-bg)] p-4 text-sm">
                      <div className="flex justify-between border-b border-[var(--portal-border)] pb-2">
                        <span className="text-[var(--portal-text-muted)]">Penerima</span>
                        <span className="font-semibold text-right">{customerName}<br/><span className="text-xs font-normal">{customerPhone}</span></span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--portal-border)] pb-2">
                        <span className="text-[var(--portal-text-muted)]">Pengiriman</span>
                        <span className="font-semibold text-right max-w-[150px] truncate">{shippingMethod === "PICKUP" ? "Ambil Sendiri" : shippingMethod === "COURIER" ? `Ekspedisi${courierShipping?.selectedRate ? ` · ${courierShipping.selectedRate.courierName}` : ""}` : "Kirim Kurir"}</span>
                      </div>
                      <div className="border-b border-[var(--portal-border)] pb-2">
                        <span className="text-[var(--portal-text-muted)] text-xs">Item</span>
                        {cartItems.map((item: any) => (
                          <div key={item.id} className="flex justify-between mt-1">
                            <span className="text-xs">{item.name} × {item.quantity}</span>
                            <span className="text-xs font-semibold">Rp {(item.price * item.quantity).toLocaleString("id-ID")}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs text-[var(--portal-text-muted)]">
                          <span>Subtotal</span>
                          <span>Rp {cartSubtotal.toLocaleString("id-ID")}</span>
                        </div>
                        {tax > 0 && (
                          <div className="flex justify-between text-xs text-[var(--portal-text-muted)]">
                            <span>Pajak ({taxRate}%)</span>
                            <span>Rp {tax.toLocaleString("id-ID")}</span>
                          </div>
                        )}
                        {!isPickup && (
                          <div className="flex justify-between text-xs text-[var(--portal-text-muted)]">
                            <span>Ongkir</span>
                            <span>{shippingCost === 0 ? "Gratis" : `Rp ${shippingCost.toLocaleString("id-ID")}`}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-[var(--portal-border)] pt-1 mt-1">
                          <span>Total Tagihan</span>
                          <span>Rp {grandTotal.toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingOrder(false)}
                        disabled={isCheckingOut}
                        className="w-1/2 rounded-[var(--portal-radius)] border border-[var(--portal-border)] py-3 font-semibold text-[var(--portal-text)] transition-colors hover:bg-[var(--portal-bg)] disabled:opacity-50"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleCheckout();
                          if (!tenant.paymentMethods?.length) {
                             setIsConfirmingOrder(false);
                          }
                        }}
                        disabled={isCheckingOut}
                        className="w-1/2 rounded-[var(--portal-radius)] bg-[var(--portal-primary)] py-3 font-bold text-[var(--portal-bg)] transition-transform hover:scale-[1.02] active:scale-[0.95] disabled:cursor-wait disabled:opacity-70 flex justify-center"
                      >
                        {isCheckingOut ? <Phone className="animate-spin" size={20} /> : "Konfirmasi"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </PortalThemeRenderer>
  );
}
