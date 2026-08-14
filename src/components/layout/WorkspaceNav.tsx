"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
} from "lucide-react";

import { cn } from "@/lib/utils";

type WorkspaceKind = "supply" | "roastery" | "sales";

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
    { label: "Gudang & Lokasi", href: "/gudang", icon: Warehouse },
    { label: "Opname", href: "/gudang/opname", icon: ClipboardCheck },
    { label: "Persediaan Non-Kopi", href: "/katalog", query: "tab=supply", icon: PackageOpen },
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
    { label: "Invoice & pesanan", href: "/penjualan", icon: ReceiptText },
    { label: "Fulfillment", href: "/penjualan/fulfillment", icon: PackageCheck },
    { label: "Review bukti bayar", href: "/penjualan/pembayaran", icon: BadgeCheck },
    { label: "Kasir", href: "/kasir", icon: ShoppingCart },
    { label: "Pelanggan", href: "/penjualan/pelanggan", icon: Users },
    { label: "Kontrak OEM", href: "/penjualan/kontrak", icon: FileSignature },
  ],
} as const;

export function WorkspaceNav({ kind }: { kind: WorkspaceKind }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceTone = {
    supply: {
      active: "border-[#2B7567] bg-[#2B7567] text-white",
      icon: "border-white/10 bg-white/10 text-white",
      idleIcon: "text-[#87CDBC]",
    },
    roastery: {
      active: "border-[#B65331] bg-[#B65331] text-white",
      icon: "border-white/10 bg-white/10 text-white",
      idleIcon: "text-[#E9A17F]",
    },
    sales: {
      active: "border-[#6F4A6A] bg-[#6F4A6A] text-white",
      icon: "border-white/10 bg-white/10 text-white",
      idleIcon: "text-[#C7A8C4]",
    },
  }[kind];

  return (
    <nav
      className="overflow-x-auto border-b border-white/10 bg-[#05090D]"
      aria-label={`Navigasi workspace ${kind}`}
    >
      <div className="mx-auto flex w-max min-w-full max-w-[1600px] gap-1 px-4 py-1.5 md:px-6 lg:px-8">
        {WORKSPACES[kind].map((item) => {
          const Icon = item.icon;
          const expectedQuery = "query" in item ? item.query : undefined;
          const currentView = searchParams.get("view");
          const currentTab = searchParams.get("tab");
          const active =
            pathname === item.href &&
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
          const href = expectedQuery
            ? `${item.href}?${expectedQuery}`
            : item.href;

          return (
            <Link
              key={`${item.href}-${expectedQuery ?? "root"}`}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[7px] border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8DF]",
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
