"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  ClipboardCheck,
  Coffee,
  Factory,
  Flame,
  FlaskConical,
   History,
  ReceiptText,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Waves,
  PackageCheck,
  BadgeCheck,
  PackageOpen,
  FileSignature,
  LayoutGrid,
} from "lucide-react";

import { cn } from "@/lib/utils";

type WorkspaceKind = "supply" | "warehouse" | "roastery" | "sales";

const WORKSPACES = {
  supply: [
    {
      label: "Posisi stok",
      href: "/inventory",
      query: "view=stock",
      icon: Boxes,
    },
    {
      label: "Pesanan & PO",
      href: "/inventory",
      query: "view=po",
      icon: ClipboardList,
    },
    {
      label: "Penerimaan",
      href: "/inventory",
      query: "view=receiving",
      icon: Truck,
    },
    {
      label: "Mutasi",
      href: "/inventory",
      query: "view=mutations",
      icon: History,
    },
    { label: "Supplier", href: "/inventory/suppliers", icon: Users },
    { label: "Lot & FEFO", href: "/inventory/lots", icon: PackageCheck },
    { label: "Persediaan Non-Kopi", href: "/katalog", query: "tab=supply", icon: PackageOpen },
  ],
  warehouse: [
    { label: "Stok & Lokasi", href: "/gudang", icon: Warehouse },
    { label: "Peta Gudang", href: "/gudang/visual", icon: LayoutGrid },
    { label: "Opname", href: "/gudang/opname", icon: ClipboardCheck },
  ],
  roastery: [
    { label: "Batch roasting", href: "/roasting", icon: Flame },
    {
      label: "Log Roast",
      href: "/roasting",
      query: "tab=profiles",
      icon: Waves,
    },
    { label: "Penggilingan", href: "/grinding", icon: Coffee },
    { label: "Produksi & packing", href: "/produksi", icon: Factory },
    { label: "Eksperimen", href: "/eksperimen", icon: FlaskConical },
    { label: "Cupping", href: "/cupping", icon: FlaskConical },
  ],
  sales: [
    { label: "Nota & pesanan", href: "/penjualan", icon: ReceiptText },
    { label: "Pemenuhan pesanan", href: "/penjualan/fulfillment", icon: PackageCheck },
    { label: "Bukti pembayaran", href: "/penjualan/pembayaran", icon: BadgeCheck },
    { label: "Kasir", href: "/kasir", icon: ShoppingCart },
    { label: "Pelanggan", href: "/penjualan/pelanggan", icon: Users },
    { label: "Kontrak B2B", href: "/penjualan/kontrak", icon: FileSignature },
  ],
} as const;

export function WorkspaceNav({ kind }: { kind: WorkspaceKind }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const currentTab = searchParams.get("tab");
  const items = WORKSPACES[kind];
  const workspaceLabel = {
    supply: "Pasokan",
    warehouse: "Gudang",
    roastery: "Roasting",
    sales: "Penjualan",
  }[kind];
  const workspaceTone = {
    supply: {
      active: "tone-inventory-active",
      icon: "nav-icon-active",
      idleIcon: "tone-inventory-text",
    },
    warehouse: {
      active: "tone-warehouse-active",
      icon: "nav-icon-active",
      idleIcon: "tone-warehouse-text",
    },
    roastery: {
      active: "tone-roasting-active",
      icon: "nav-icon-active",
      idleIcon: "tone-roasting-text",
    },
    sales: {
      active: "tone-sales-active",
      icon: "nav-icon-active",
      idleIcon: "tone-sales-text",
    },
  }[kind];

  const itemHref = (item: (typeof items)[number]) => {
    const expectedQuery = "query" in item ? item.query : undefined;
    return expectedQuery ? `${item.href}?${expectedQuery}` : item.href;
  };

  const itemIsActive = (item: (typeof items)[number]) => {
    const expectedQuery = "query" in item ? item.query : undefined;
    return pathname === item.href &&
      (expectedQuery === "view=stock"
        ? !currentView || currentView === "stock"
        : expectedQuery === "view=po"
          ? currentView === "po"
          : expectedQuery === "view=receiving"
            ? currentView === "receiving"
            : expectedQuery === "view=mutations"
              ? currentView === "mutations"
              : expectedQuery === "tab=profiles"
                ? currentTab === "profiles"
                : expectedQuery === "tab=supply"
                  ? currentTab === "supply"
                  : !currentTab);
  };

  const activeHref = itemHref(items.find(itemIsActive) ?? items[0]);

  return (
    <nav
      className="border-b border-white/10 bg-[#05090D]"
      aria-label={`Navigasi workspace ${kind}`}
    >
      <div className="mx-auto flex min-h-12 w-full max-w-[1600px] items-center gap-3 px-4 md:hidden">
        <label htmlFor={`workspace-${kind}`} className="shrink-0 text-xs font-semibold text-white/65">
          {workspaceLabel}
        </label>
        <select
          id={`workspace-${kind}`}
          aria-label={`Pilih area ${workspaceLabel}`}
          value={activeHref}
          onChange={(event) => router.push(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm font-semibold text-white outline-none focus:border-[#00C8DF] focus:ring-2 focus:ring-[#00C8DF]/30"
        >
          {items.map((item) => (
            <option key={itemHref(item)} value={itemHref(item)} className="bg-[#0B141B] text-white">
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mx-auto hidden w-max min-w-full max-w-[1600px] gap-1 overflow-x-auto px-4 py-1.5 md:flex md:px-6 lg:px-8">
        {items.map((item) => {
          const Icon = item.icon;
          const active = itemIsActive(item);
          const href = itemHref(item);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8DF]",
                active
                  ? workspaceTone.active
                  : "border-transparent text-white/46 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-[5px] border",
                  active
                    ? workspaceTone.icon
                    : cn(
                        "border-white/10 bg-white/[0.04]",
                        workspaceTone.idleIcon,
                      ),
                )}
              >
                <Icon size={10} strokeWidth={2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
