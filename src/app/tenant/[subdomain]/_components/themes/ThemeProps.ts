import { Tenant, Product } from "@prisma/client";
import { CustomerTier } from "./pricing";
import type { CartItem } from "../../_store/cartStore";
import type { StorefrontGrindSize, StorefrontOffering } from "@/lib/storefront-grind";

export type ExtendedTenant = Tenant & {
  portalThemeConfig?: any;
  themeConfig?: any;
  paymentMethods?: Array<{
    id: string;
    method: "CASH" | "TRANSFER" | "QRIS" | "CREDIT";
    label: string;
    bankName: string | null;
    accountNumber: string | null;
  }>;
};

export interface CartStore {
  items: Record<string, CartItem[]>;
  addItem: (tenantId: string, product: Omit<CartItem, "quantity">) => void;
  removeItem: (tenantId: string, id: string) => void;
  updateQuantity: (tenantId: string, id: string, delta: number) => void;
  clearCart: (tenantId: string) => void;
  getTotalItems: (tenantId: string) => number;
  getTotalPrice: (tenantId: string) => number;
}

export interface ThemeProps {
  tenant: ExtendedTenant & { products: Product[]; offerings?: StorefrontOffering[] };
  products?: Product[];
  offerings?: StorefrontOffering[];
  cart: CartStore;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  customerAddress: string;
  setCustomerAddress: (val: string) => void;
  shippingMethod: string;
  setShippingMethod: (val: string) => void;
  paymentMethodId?: string;
  setPaymentMethodId?: (val: string) => void;
  handleAddToCart: (product: Product, grindSize?: StorefrontGrindSize, customGrindLabel?: string | null) => void;
  handleAddOfferingToCart: (
    offering: StorefrontOffering,
    variant: StorefrontOffering["variants"][number],
    grindSize?: StorefrontGrindSize,
    customGrindLabel?: string | null,
  ) => void;
  handleCheckout: () => void;
  isCheckingOut?: boolean;
  mounted: boolean;
  // Common computed properties
  heroGreeting: string;
  aboutText: string;
  catalogTitle: string;
  catalogSubtitle: string;
  footerText: string;
  waLink: string;
  emailLink: string | null;
  igLink: string | null;
  iconStroke?: number;
  iconProps: { weight: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" };
  isDark: boolean;
  /** Customer wholesale tier for tiered pricing display */
  customerTier?: CustomerTier;
}
