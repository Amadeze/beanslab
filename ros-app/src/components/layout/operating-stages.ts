import {
  Boxes,
  Factory,
  Flame,
  ReceiptText,
  WalletCards,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type OperatingStage =
  | "inventory"
  | "warehouse"
  | "roasting"
  | "production"
  | "sales"
  | "finance";

export const titleStages: Record<string, OperatingStage | undefined> = {
  Inventory: "inventory",
  Pasokan: "inventory",
  "Pasokan & Stok": "inventory",
  "Bahan & Stok": "inventory",
  Gudang: "warehouse",
  "Gudang & Lokasi": "warehouse",
  "Stok per Lokasi": "warehouse",
  "Opname Lokasi": "warehouse",
  Roasting: "roasting",
  Produksi: "production",
  "Produksi & Packing": "production",
  Penjualan: "sales",
  "Penjualan & Pesanan": "sales",
  "Buka Kasir": "sales",
  Keuangan: "finance",
  "Kas & Piutang": "finance",
};

export const operatingStages: Array<{
  id: OperatingStage;
  number: string;
  shortLabel: string;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { id: "inventory", number: "01", shortLabel: "Stok", label: "Pasokan & Stok", href: "/inventory", icon: Boxes },
  { id: "warehouse", number: "02", shortLabel: "Gudang", label: "Gudang & Lokasi", href: "/gudang", icon: Warehouse },
  { id: "roasting", number: "03", shortLabel: "Roast", label: "Roasting", href: "/roasting", icon: Flame },
  { id: "production", number: "04", shortLabel: "Produksi", label: "Produksi", href: "/produksi", icon: Factory },
  { id: "sales", number: "05", shortLabel: "Jual", label: "Penjualan", href: "/penjualan", icon: ReceiptText },
  { id: "finance", number: "06", shortLabel: "Kas", label: "Kas & Piutang", href: "/keuangan", icon: WalletCards },
];

/**
 * Tone stage memakai utilitas `.tone-<stage>-*` dari globals.css — satu sumber
 * warna untuk stage rail, Sidebar, dan MobileDock. Tanpa hex literal.
 */
export const operatingStageTones = {
  inventory: {
    eyebrow: "tone-inventory-text",
    active: "tone-inventory-active",
    complete: "tone-inventory-complete",
    label: "tone-inventory-text",
    line: "tone-inventory-line",
    signal: "tone-inventory-text",
  },
  roasting: {
    eyebrow: "tone-roasting-text",
    active: "tone-roasting-active",
    complete: "tone-roasting-complete",
    label: "tone-roasting-text",
    line: "tone-roasting-line",
    signal: "tone-roasting-text",
  },
  production: {
    eyebrow: "tone-production-text",
    active: "tone-production-active",
    complete: "tone-production-complete",
    label: "tone-production-text",
    line: "tone-production-line",
    signal: "tone-production-text",
  },
  sales: {
    eyebrow: "tone-sales-text",
    active: "tone-sales-active",
    complete: "tone-sales-complete",
    label: "tone-sales-text",
    line: "tone-sales-line",
    signal: "tone-sales-text",
  },
  finance: {
    eyebrow: "tone-finance-text",
    active: "tone-finance-active",
    complete: "tone-finance-complete",
    label: "tone-finance-text",
    line: "tone-finance-line",
    signal: "tone-finance-text",
  },
  warehouse: {
    eyebrow: "tone-warehouse-text",
    active: "tone-warehouse-active",
    complete: "tone-warehouse-complete",
    label: "tone-warehouse-text",
    line: "tone-warehouse-line",
    signal: "tone-warehouse-text",
  },
} as const;
