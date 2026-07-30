"use client";

import { Tenant, Product } from "@prisma/client";
import { useCartStore } from "../_store/cartStore";
import { useState, useEffect } from "react";
import { ThemeEngine } from "./themes/ThemeEngine";
import { UniversalTheme } from "./themes/UniversalTheme";

// =============================================================================
// TENANT PORTAL CLIENT — $10k Architecture
// =============================================================================
// This is now a thin orchestration layer.
// If a PortalThemeConfig exists (block-based customizer), render via PortalThemeRenderer.
// Otherwise, fall back to the legacy ThemeEngine + UniversalTheme rendering.
// =============================================================================

type ExtendedTenant = Tenant & {
  whatsappNumber?: string | null;
  contactEmail?: string | null;
  instagramHandle?: string | null;
  backgroundImageUrl?: string | null;
  aboutText?: string | null;
  catalogTitle?: string | null;
  catalogSubtitle?: string | null;
  footerText?: string | null;
  midtransClientKey?: string | null;
  midtransIsProduction?: boolean;
  themeConfig?: any;
  paymentMethods?: Array<{
    id: string;
    method: "CASH" | "TRANSFER" | "QRIS" | "CREDIT";
    label: string;
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    qrisImageUrl: string | null;
    instructions: string | null;
    requireProof: boolean;
  }>;
};

interface TenantPortalClientProps {
  tenant: ExtendedTenant & { products: Product[] };
}

export function TenantPortalClient({ tenant }: TenantPortalClientProps) {
  const [mounted, setMounted] = useState(false);
  const cart = useCartStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const defaultShippingMethod = tenant.storefrontPickupEnabled ? "PICKUP" : "LOCAL_DELIVERY";
  const [shippingMethod, setShippingMethod] = useState(defaultShippingMethod);
  const [paymentMethodId, setPaymentMethodId] = useState(tenant.paymentMethods?.[0]?.id || "");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const themeMode = tenant.themeMode || "light";
  const isDark = themeMode === "dark";
  const iconStyle = tenant.iconStyle || "regular";
  const iconProps = { weight: iconStyle as "thin" | "light" | "regular" | "bold" | "fill" | "duotone" };
  
  let iconStroke = 2; // Default
  if (iconStyle === "thin") iconStroke = 1;
  if (iconStyle === "light") iconStroke = 1.5;
  if (iconStyle === "bold") iconStroke = 3;

  // ─── Content (with fallbacks) ─────────────────────────────────────────
  const heroGreeting = tenant.heroText || "Crafting Excellence,\nOne Roast at a Time.";
  const aboutText = tenant.aboutText || `Welcome to the official wholesale portal of ${tenant.name}. Gain access to our exclusive catalog of specialty coffee.`;
  const catalogTitle = tenant.catalogTitle || "The Collection";
  const catalogSubtitle = tenant.catalogSubtitle || "Meticulously profiled and roasted for consistency. Available exclusively for our B2B partners.";
  const footerText = tenant.footerText || "All rights reserved.";

  // ─── Contact Links ────────────────────────────────────────────────────
  let waLink = "mailto:hello@roastd.id";
  if (tenant.whatsappNumber) {
    let cleanWa = tenant.whatsappNumber.replace(/\D/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);
    waLink = `https://wa.me/${cleanWa}`;
  }
  const emailLink = tenant.contactEmail ? `mailto:${tenant.contactEmail}` : null;
  const igLink = tenant.instagramHandle ? `https://instagram.com/${tenant.instagramHandle.replace('@', '')}` : null;

  // Sync state dengan cart localStorage jika ada data sebelumnya
  useEffect(() => {
    setMounted(true);
    const savedName = localStorage.getItem("ros_customer_name");
    const savedPhone = localStorage.getItem("ros_customer_phone");
    const savedAddress = localStorage.getItem("ros_customer_address");
    const savedShipping = localStorage.getItem("ros_shipping_method");
    if (savedName) setCustomerName(savedName);
    if (savedPhone) setCustomerPhone(savedPhone);
    if (savedAddress) setCustomerAddress(savedAddress);
    const savedAllowed = savedShipping === "PICKUP" ? tenant.storefrontPickupEnabled : tenant.storefrontDeliveryEnabled;
    if (savedShipping && savedAllowed) setShippingMethod(savedShipping);
  }, [tenant.storefrontDeliveryEnabled, tenant.storefrontPickupEnabled]);

  useEffect(() => {
    if (customerName) localStorage.setItem("ros_customer_name", customerName);
    if (customerPhone) localStorage.setItem("ros_customer_phone", customerPhone);
    if (customerAddress) localStorage.setItem("ros_customer_address", customerAddress);
    if (shippingMethod) localStorage.setItem("ros_shipping_method", shippingMethod);
  }, [customerName, customerPhone, customerAddress, shippingMethod]);

  // ─── Cart Actions ─────────────────────────────────────────────────────
  const handleAddToCart = (product: Product) => {
    cart.addItem(tenant.subdomain || "", {
      id: product.id,
      code: product.code,
      name: product.name,
      imageUrl: product.imageUrl,
      price: Number(product.price || 0),
    });
    setIsCartOpen(true);
  };

  const handleCheckout = async () => {
    if (isCheckingOut) return;
    if (!customerName || !customerPhone || (shippingMethod !== "PICKUP" && !customerAddress)) {
      alert("Mohon lengkapi Nama, Nomor HP, dan alamat jika pesanan dikirim.");
      return;
    }

    try {
      setIsCheckingOut(true);
      const res = await fetch(`/api/tenant/${tenant.subdomain}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName, customerPhone, customerAddress: customerAddress || "Ambil di roastery", shippingMethod, paymentMethodId: paymentMethodId || undefined, items: cart.items[tenant.subdomain || ""] || [],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert("Gagal merekam pesanan: " + (errorData.error || "Terjadi kesalahan server."));
        return;
      }

      const data = await res.json();
      const invoiceCode = data.invoice?.code || "-";

      if (data.orderUrl) {
        cart.clearCart(tenant.subdomain || "");
        setIsCartOpen(false);
        window.location.assign(data.orderUrl);
        return;
      }

      let text = `Halo Admin ${tenant.name},\nSaya ingin memesan (Order B2B):\n\n`;
      text += `*No. Ref:* ${invoiceCode}\n`;
      let shipText = 'Kurir Lokal (Lalamove/Gojek)';
      if (shippingMethod === 'STORE_COURIER') shipText = 'Kurir Pribadi Toko';
      else if (shippingMethod === 'COURIER') shipText = 'Ekspedisi (JNE/J&T/Sicepat)';
      text += `*Metode Pengiriman:* ${shipText}\n`;
      text += `*Data Pembeli:*\nNama: ${customerName}\nNo. HP: ${customerPhone}\n`;
      text += `Alamat Pengiriman: ${customerAddress}\n`;
      text += `\n*Detail Pesanan:*\n`;
      const tenantItems = cart.items[tenant.subdomain || ""] || [];
      tenantItems.forEach((item: any, idx: number) => {
        text += `${idx + 1}. ${item.name} - ${item.quantity}x @ Rp ${item.price.toLocaleString("id-ID")} = Rp ${(item.quantity * item.price).toLocaleString("id-ID")}\n`;
      });
      text += `\nTotal Harga: Rp ${cart.getTotalPrice(tenant.subdomain || "").toLocaleString("id-ID")}\n\nMohon diinformasikan ketersediaan dan ongkos kirim. Terima kasih.`;
      
      let cleanWa = tenant.whatsappNumber?.replace(/\D/g, '') || '';
      if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);
      
      if (!cleanWa) {
        cart.clearCart(tenant.subdomain || "");
        setIsCartOpen(false);
        alert("Pesanan terekam (Ref: " + invoiceCode + ") tapi nomor WhatsApp admin belum diatur di sistem.");
        return;
      }
      
      window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(text)}`, '_blank');
      cart.clearCart(tenant.subdomain || "");
      setIsCartOpen(false);
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem saat memproses checkout.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  // Always render the full portal with cart, checkout, dashboard
  const themeProps = {
    tenant, cart, isCartOpen, setIsCartOpen, customerName, setCustomerName, customerPhone, setCustomerPhone,
    customerAddress, setCustomerAddress, shippingMethod, setShippingMethod, handleAddToCart, handleCheckout, mounted, heroGreeting, aboutText,
    catalogTitle, catalogSubtitle, footerText, waLink, emailLink, igLink, iconProps, iconStroke, isDark,
    isCheckingOut,
    paymentMethodId,
    setPaymentMethodId,
  };

  return (
    <ThemeEngine tenant={tenant}>
      <UniversalTheme {...themeProps} />
    </ThemeEngine>
  );
}
