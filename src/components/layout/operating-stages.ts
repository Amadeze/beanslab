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

export const operatingStageTones = {
  inventory: {
    eyebrow: "text-[#87CDBC]",
    active: "border-[#2B7567] bg-[#2B7567] text-white shadow-[0_0_22px_rgba(43,117,103,.3)]",
    complete: "border-[#2B7567]/55 bg-[#2B7567]/14 text-[#87CDBC]",
    label: "text-[#9AD7C8]",
    line: "bg-[#2B7567]",
    signal: "text-[#8CD1C1]",
  },
  roasting: {
    eyebrow: "text-[#E9A17F]",
    active: "border-[#B65331] bg-[#B65331] text-white shadow-[0_0_22px_rgba(182,83,49,.3)]",
    complete: "border-[#B65331]/55 bg-[#B65331]/14 text-[#E9A17F]",
    label: "text-[#F0AC8C]",
    line: "bg-[#B65331]",
    signal: "text-[#E9A17F]",
  },
  production: {
    eyebrow: "text-[#E0BC67]",
    active: "border-[#A66F12] bg-[#A66F12] text-white shadow-[0_0_22px_rgba(166,111,18,.3)]",
    complete: "border-[#A66F12]/55 bg-[#A66F12]/14 text-[#E0BC67]",
    label: "text-[#E7C778]",
    line: "bg-[#A66F12]",
    signal: "text-[#E0BC67]",
  },
  sales: {
    eyebrow: "text-[#C7A8C4]",
    active: "border-[#6F4A6A] bg-[#6F4A6A] text-white shadow-[0_0_22px_rgba(111,74,106,.3)]",
    complete: "border-[#6F4A6A]/55 bg-[#6F4A6A]/14 text-[#C7A8C4]",
    label: "text-[#D2B5CF]",
    line: "bg-[#6F4A6A]",
    signal: "text-[#C7A8C4]",
  },
  finance: {
    eyebrow: "text-[#A8C390]",
    active: "border-[#4B6B3C] bg-[#4B6B3C] text-white shadow-[0_0_22px_rgba(75,107,60,.3)]",
    complete: "border-[#4B6B3C]/55 bg-[#4B6B3C]/14 text-[#A8C390]",
    label: "text-[#B7CE9F]",
    line: "bg-[#4B6B3C]",
    signal: "text-[#A8C390]",
  },
  warehouse: {
    eyebrow: "text-[#9FB8C9]",
    active: "border-[#4A6B84] bg-[#4A6B84] text-white shadow-[0_0_22px_rgba(74,107,132,.3)]",
    complete: "border-[#4A6B84]/55 bg-[#4A6B84]/14 text-[#9FB8C9]",
    label: "text-[#B7CBD9]",
    line: "bg-[#4A6B84]",
    signal: "text-[#9FB8C9]",
  },
} as const;
