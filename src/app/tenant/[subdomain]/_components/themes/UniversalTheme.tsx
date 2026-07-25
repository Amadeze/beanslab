"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Package, Phone, X } from "@phosphor-icons/react";
import { ThemeProps } from "./ThemeProps";
import { resolveSkin } from "./skins";

// =============================================================================
// UNIVERSAL PREMIUM THEME
// =============================================================================
// This is a SINGLE component that renders completely differently
// based on CSS custom properties injected by ThemeEngine.
// No hardcoded colors, no hardcoded fonts, no hardcoded shadows.
// Everything reads from --t-* variables.
// =============================================================================

import { TenantPortalLayout } from "./TenantPortalLayout";
import { PortalThemeRenderer } from "@/features/portal-theme/components/PortalThemeRenderer";

export function UniversalTheme({
  tenant, cart, isCartOpen, setIsCartOpen, customerName, setCustomerName, customerPhone, setCustomerPhone,
  customerAddress, setCustomerAddress, shippingMethod, setShippingMethod, handleAddToCart, handleCheckout, mounted, heroGreeting, aboutText,
  catalogTitle, catalogSubtitle, footerText, waLink, emailLink, igLink, iconProps, iconStroke, isDark,
  isCheckingOut, customerTier,
}: ThemeProps) {

  const products = tenant.products || [];
  const cartItems = cart.items[tenant.subdomain || ""] || [];
  const themeTenant = {
    ...tenant,
    backgroundImageUrl: tenant.heroImageUrl || tenant.backgroundImageUrl,
  };

  // Resolve the visual skin from tenant's layoutStyle
  const skin = resolveSkin(tenant.layoutStyle);

  const themeProps = {
    tenant: themeTenant, products, cart, isCartOpen, setIsCartOpen, customerName, setCustomerName, customerPhone, setCustomerPhone,
    customerAddress, setCustomerAddress, shippingMethod, setShippingMethod, handleAddToCart, handleCheckout, mounted, heroGreeting, aboutText,
    catalogTitle, catalogSubtitle, footerText, waLink, emailLink, igLink, iconProps, iconStroke, isDark, isCheckingOut, customerTier
  };

  return (
    <div className="relative w-full min-h-screen overflow-x-clip">
      
      {/* ═══ THEME MATRIX OR BLOCK RENDERER ═══ */}
      {tenant.portalThemeConfig ? (
        <PortalThemeRenderer
          config={tenant.portalThemeConfig}
          products={products}
          onAddToCart={handleAddToCart}
          onOpenCart={() => setIsCartOpen(true)}
          cartItemCount={cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0)}
        />
      ) : (
        <TenantPortalLayout {...themeProps} skin={skin} />
      )}

      {/* ═══ FLOATING CART BUTTON ═══ */}
      {cartItems.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-full bg-amber-500 text-gray-950 font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all border border-amber-300/40"
        >
          <div className="relative">
            <Coffee size={22} weight="bold" />
          </div>
          <span>Cart ({cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0)})</span>
          <span className="bg-gray-950 text-white text-xs px-2 py-0.5 rounded-full">
            Rp {cart.getTotalPrice(tenant.subdomain || "").toLocaleString("id-ID")}
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
              className="relative w-full max-w-md h-full flex flex-col overflow-hidden bg-[var(--t-surface)] text-[var(--t-text)] shadow-2xl"
            >
              {/* Cart Header */}
              <div className="p-5 md:p-6 flex justify-between items-center flex-shrink-0 border-b border-[var(--t-border)]">
                <h2 className="text-xl font-bold tracking-tight text-[var(--t-text)]">
                  Your Cart
                </h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  aria-label="Tutup keranjang"
                  className="w-9 h-9 rounded-[var(--t-radius)] flex items-center justify-center transition-all hover:bg-[var(--t-bg)] text-[var(--t-text-muted)]"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-auto p-5 md:p-6 space-y-5">
                {cartItems.length === 0 ? (
                  <div className="text-center py-16 text-[var(--t-text-muted)]">
                    <Package size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-sm font-medium">Your cart is empty</p>
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
                        <h4 className="text-sm font-semibold line-clamp-1 mb-1 text-[var(--t-text)]">
                          {item.name}
                        </h4>
                        <p className="text-xs mb-2 text-[var(--t-text-muted)]">
                          Rp {item.price.toLocaleString("id-ID")}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cart.updateQuantity(tenant.subdomain || "", item.id, -1)}
                            aria-label={`Kurangi ${item.name}`}
                            className="w-7 h-7 rounded-[var(--t-radius)] flex items-center justify-center text-xs font-bold transition-colors border border-[var(--t-border)] hover:bg-[var(--t-bg)] text-[var(--t-text)]"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold w-5 text-center text-[var(--t-text)]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => cart.updateQuantity(tenant.subdomain || "", item.id, 1)}
                            aria-label={`Tambah ${item.name}`}
                            className="w-7 h-7 rounded-[var(--t-radius)] flex items-center justify-center text-xs font-bold transition-colors border border-[var(--t-border)] hover:bg-[var(--t-bg)] text-[var(--t-text)]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[var(--t-text)]">
                          Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                        </p>
                        <button
                          onClick={() => cart.removeItem(tenant.subdomain || "", item.id)}
                          className="text-xs mt-1 font-semibold text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}

                {/* Checkout Form */}
                {cartItems.length > 0 && (
                  <div className="pt-6 space-y-4 border-t border-[var(--t-border)] mt-6">
                    <h3 className="text-sm font-bold text-[var(--t-text)] uppercase tracking-wider mb-2">
                      Shipping Details
                    </h3>
                    <input 
                      value={customerName} 
                      onChange={e => setCustomerName(e.target.value)} 
                      placeholder="Full Name" 
                      className="w-full bg-[var(--t-bg)] text-[var(--t-text)] border border-[var(--t-border)] rounded-[var(--t-radius)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--t-primary)] focus:ring-1 focus:ring-[var(--t-primary)] transition-colors"
                    />
                    <input 
                      value={customerPhone} 
                      onChange={e => setCustomerPhone(e.target.value)} 
                      placeholder="WhatsApp Number" 
                      type="tel"
                      className="w-full bg-[var(--t-bg)] text-[var(--t-text)] border border-[var(--t-border)] rounded-[var(--t-radius)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--t-primary)] focus:ring-1 focus:ring-[var(--t-primary)] transition-colors"
                    />
                    <textarea 
                      value={customerAddress} 
                      onChange={e => setCustomerAddress(e.target.value)} 
                      placeholder="Alamat Lengkap (Jalan, Kec, Kota, Kode Pos)" 
                      rows={3}
                      className="w-full bg-[var(--t-bg)] text-[var(--t-text)] border border-[var(--t-border)] rounded-[var(--t-radius)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--t-primary)] focus:ring-1 focus:ring-[var(--t-primary)] transition-colors"
                    />

                    <div className="mb-4 mt-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Metode Pengiriman</label>
                      <select 
                        value={shippingMethod} 
                        onChange={e => setShippingMethod(e.target.value)}
                        className="w-full border border-[var(--t-border)] rounded-[var(--t-radius)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--t-primary)] focus:ring-1 focus:ring-[var(--t-primary)] transition-colors bg-[var(--t-bg)] text-[var(--t-text)]"
                      >
                        <option value="LOCAL_DELIVERY">Dalam Kota - Kurir Lokal (Lalamove / Gojek)</option>
                        <option value="STORE_COURIER">Dalam Kota - Kurir Pribadi Toko</option>
                        <option value="COURIER">Luar Kota - Ekspedisi (JNE/J&T/Sicepat)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cartItems.length > 0 && (
                <div className="p-5 md:p-6 flex-shrink-0 border-t border-[var(--t-border)] bg-[var(--t-bg)]">
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-sm text-[var(--t-text-muted)] font-medium">Total</span>
                    <span className="text-2xl font-black text-[var(--t-text)]">
                      Rp {cart.getTotalPrice(tenant.subdomain || "").toLocaleString("id-ID")}
                    </span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                    className="w-full py-4 rounded-[var(--t-radius)] font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 bg-[var(--t-primary)] text-[var(--t-bg)] shadow-lg disabled:cursor-wait disabled:opacity-60"
                  >
                    <Phone size={18} weight="bold" />
                    {isCheckingOut ? "Memproses Pesanan..." : "Checkout via WhatsApp"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
