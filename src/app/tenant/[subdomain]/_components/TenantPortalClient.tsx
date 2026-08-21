"use client";

import { Tenant, Product } from "@prisma/client";
import { useCartStore } from "../_store/cartStore";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ThemeEngine } from "./themes/ThemeEngine";
import { UniversalTheme } from "./themes/UniversalTheme";
import {
  offeringLineId,
  storefrontLineId,
  type StorefrontGrindSize,
  type StorefrontOffering,
} from "@/lib/storefront-grind";
import type { CourierShippingState } from "./CourierShippingSearch";

// =============================================================================
// TENANT PORTAL CLIENT — $10k Architecture
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
  storefrontTaxRate?: number | null;
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

type StorefrontProduct = Product & {
  recipes?: Array<{ storefrontGrindOptions: StorefrontGrindSize[] }>;
};

interface TenantPortalClientProps {
  tenant: ExtendedTenant & { products: StorefrontProduct[]; offerings: StorefrontOffering[] };
  isPreviewMode?: boolean;
}

const defaultCourierShipping: CourierShippingState = {
  destinationToken: null,
  shippingQuoteToken: null,
  selectedRate: null,
  shippingCost: 0,
};

export function TenantPortalClient({ tenant, isPreviewMode }: TenantPortalClientProps) {
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

  // ─── COURIER shipping state ────────────────────────────────────────────
  const [courierShipping, setCourierShippingState] = useState<CourierShippingState>(defaultCourierShipping);
  const [courierRateChangedError, setCourierRateChangedError] = useState<string | null>(null);

  const setCourierShipping = useCallback((state: CourierShippingState) => {
    setCourierShippingState(state);
    setCourierRateChangedError(null);
  }, []);

  const onClearRateChanged = useCallback(() => {
    setCourierRateChangedError(null);
  }, []);

  // Clear COURIER state when switching away from COURIER
  useEffect(() => {
    if (shippingMethod !== "COURIER") {
      setCourierShippingState(defaultCourierShipping);
      setCourierRateChangedError(null);
    }
  }, [shippingMethod]);

  // Build cart items for quote request
  const courierCartItems = (cart.items[tenant.subdomain || ""] || []).map((item: any) => ({
    productId: item.productId || null,
    offeringId: item.offeringId || null,
    variantId: item.variantId || null,
    quantity: item.quantity,
  }));

  const themeMode = tenant.themeMode || "light";
  const isDark = themeMode === "dark";
  const iconStyle = tenant.iconStyle || "regular";
  const iconProps = { weight: iconStyle as "thin" | "light" | "regular" | "bold" | "fill" | "duotone" };

  let iconStroke = 2;
  if (iconStyle === "thin") iconStroke = 1;
  if (iconStyle === "light") iconStroke = 1.5;
  if (iconStyle === "bold") iconStroke = 3;

  // ─── Content (with fallbacks) ─────────────────────────────────────────
  const heroGreeting = tenant.heroText || `Selamat datang di ${tenant.name}`;
  const aboutText = tenant.aboutText || `Portal resmi ${tenant.name}. Akses katalog kopi spesialti eksklusif kami.`;
  const catalogTitle = tenant.catalogTitle || "Katalog Produk";
  const catalogSubtitle = tenant.catalogSubtitle || "Kopi yang dikurasi dan dipanggang untuk konsistensi.";
  const footerText = tenant.footerText || "Hak cipta dilindungi.";

  // ─── Contact Links ────────────────────────────────────────────────────
  let waLink = "";
  if (tenant.whatsappNumber) {
    let cleanWa = tenant.whatsappNumber.replace(/\D/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);
    waLink = `https://wa.me/${cleanWa}`;
  }
  const emailLink = tenant.contactEmail ? `mailto:${tenant.contactEmail}` : null;
  const igLink = tenant.instagramHandle ? `https://instagram.com/${tenant.instagramHandle.replace('@', '')}` : null;

  // ─── Persist customer info ────────────────────────────────────────────
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
  const handleAddToCart = (
    product: Product,
    grindSize?: StorefrontGrindSize,
    customGrindLabel: string | null = null,
  ) => {
    const storefrontProduct = product as StorefrontProduct;
    const resolvedGrindSize = grindSize
      ?? storefrontProduct.recipes?.[0]?.storefrontGrindOptions[0]
      ?? "WHOLE_BEAN";
    cart.addItem(tenant.subdomain || "", {
      id: storefrontLineId(product.id, resolvedGrindSize, customGrindLabel),
      productId: product.id,
      code: product.code,
      name: product.name,
      imageUrl: product.imageUrl,
      price: Number(product.price || 0),
      grindSize: resolvedGrindSize,
      customGrindLabel,
    });
    setIsCartOpen(true);
  };

  const handleAddOfferingToCart = (
    offering: StorefrontOffering,
    variant: StorefrontOffering["variants"][number],
    grindSize?: StorefrontGrindSize,
    customGrindLabel: string | null = null,
  ) => {
    const resolvedGrindSize = grindSize ?? offering.grindOptions[0] ?? "WHOLE_BEAN";
    cart.addItem(tenant.subdomain || "", {
      id: offeringLineId(offering.id, variant.id, resolvedGrindSize, customGrindLabel),
      productId: null,
      offeringId: offering.id,
      variantId: variant.id,
      code: offering.code,
      name: offering.name,
      imageUrl: offering.imageUrl,
      price: Number(variant.unitPrice || 0),
      grindSize: resolvedGrindSize,
      customGrindLabel,
      packageName: variant.packageName,
      netWeightGrams: Number(variant.netWeightGrams || 0),
      roastLevel: offering.roastLevel ?? null,
    });
    setIsCartOpen(true);
  };

  // ─── Checkout ─────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (isCheckingOut) return;
    if (isPreviewMode) {
      toast.error("Checkout dinonaktifkan dalam mode preview.");
      return;
    }
    if (!customerName || !customerPhone || (shippingMethod !== "PICKUP" && !customerAddress)) {
      toast.error("Mohon lengkapi Nama, Nomor HP, dan alamat jika pesanan dikirim.");
      return;
    }
    if (tenant.paymentMethods?.length && !paymentMethodId) {
      toast.error("Mohon pilih metode pembayaran.");
      return;
    }
    // Validate COURIER has required tokens
    if (shippingMethod === "COURIER") {
      if (!courierShipping.destinationToken || !courierShipping.shippingQuoteToken) {
        toast.error("Mohon pilih tujuan dan layanan pengiriman terlebih dahulu.");
        return;
      }
    }

    try {
      setIsCheckingOut(true);
      const checkoutPayload: Record<string, any> = {
        customerName,
        customerPhone,
        customerAddress: customerAddress || "Ambil di roastery",
        shippingMethod,
        paymentMethodId: paymentMethodId || undefined,
        items: cart.items[tenant.subdomain || ""] || [],
      };

      // Wire COURIER tokens
      if (shippingMethod === "COURIER") {
        checkoutPayload.shippingQuoteToken = courierShipping.shippingQuoteToken;
        checkoutPayload.destinationToken = courierShipping.destinationToken;
      }

      const idempotencyStorageKey = `ros_checkout_operation_${tenant.subdomain || "storefront"}`;
      const fingerprint = JSON.stringify(checkoutPayload);
      let operationKey = crypto.randomUUID();
      try {
        const saved = JSON.parse(sessionStorage.getItem(idempotencyStorageKey) || "null") as {
          fingerprint?: string;
          operationKey?: string;
        } | null;
        if (saved?.fingerprint === fingerprint && saved.operationKey) operationKey = saved.operationKey;
        else sessionStorage.setItem(idempotencyStorageKey, JSON.stringify({ fingerprint, operationKey }));
      } catch {
        sessionStorage.setItem(idempotencyStorageKey, JSON.stringify({ fingerprint, operationKey }));
      }
      const res = await fetch(`/api/tenant/${tenant.subdomain}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": operationKey },
        body: fingerprint,
      });

      // Handle SHIPPING_RATE_CHANGED (409)
      if (res.status === 409) {
        const errorData = await res.json();
        if (errorData.code === "SHIPPING_RATE_CHANGED") {
          setCourierRateChangedError(errorData.error || "Harga ongkir berubah. Silakan pilih ulang.");
          setCourierShippingState(defaultCourierShipping);
          toast.error("Harga ongkir telah berubah. Silakan pilih ulang tujuan dan layanan.");
          return;
        }
      }

      if (!res.ok) {
        const errorData = await res.json();
        toast.error("Gagal merekam pesanan: " + (errorData.error || "Terjadi kesalahan server."));
        return;
      }

      const data = await res.json();
      sessionStorage.removeItem(idempotencyStorageKey);
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
        toast.success(`Pesanan terekam (Ref: ${invoiceCode}) tapi nomor WhatsApp admin belum diatur di sistem.`);
        return;
      }

      window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(text)}`, '_blank');
      cart.clearCart(tenant.subdomain || "");
      setIsCartOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat memproses checkout.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────
  const taxRate = Number(tenant.storefrontTaxRate || 0);

  const themeProps = {
    tenant, cart, isCartOpen, setIsCartOpen, customerName, setCustomerName, customerPhone, setCustomerPhone,
    customerAddress, setCustomerAddress, shippingMethod, setShippingMethod, handleAddToCart, handleAddOfferingToCart, handleCheckout, mounted, heroGreeting, aboutText,
    catalogTitle, catalogSubtitle, footerText, waLink, emailLink, igLink, iconProps, iconStroke, isDark,
    isCheckingOut,
    paymentMethodId,
    setPaymentMethodId,
    courierShipping,
    setCourierShipping,
    courierShippingCartItems: courierCartItems,
    courierRateChangedError,
    onClearRateChanged,
    taxRate,
  };

  return (
    <ThemeEngine tenant={tenant}>
      <UniversalTheme {...themeProps} />
    </ThemeEngine>
  );
}
