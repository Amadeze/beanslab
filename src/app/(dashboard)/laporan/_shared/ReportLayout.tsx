"use client";

import Link from "next/link";
import {
  ReceiptText,
  WalletCards,
  Package,
  Flame,
  Factory,
  Calendar,
  BarChart3,
  BadgeDollarSign,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportTab =
  | "keuangan"
  | "keuangan/sales"
  | "keuangan/expenses"
  | "inventory"
  | "inventory/stock"
  | "inventory/roasting"
  | "inventory/production"
  | "daily";

interface TabConfig {
  id: ReportTab;
  label: string;
  icon: LucideIcon;
  href: string;
}

// Main tabs (top level)
const MAIN_TABS: TabConfig[] = [
  { id: "keuangan", label: "Keuangan", icon: BadgeDollarSign, href: "/laporan/keuangan" },
  { id: "inventory", label: "Inventory", icon: Package, href: "/laporan/inventory" },
  { id: "daily", label: "Harian", icon: Calendar, href: "/laporan/daily" },
];

// Sub tabs for Keuangan
const KEUANGAN_TABS: TabConfig[] = [
  { id: "keuangan", label: "Overview", icon: TrendingUp, href: "/laporan/keuangan" },
  { id: "keuangan/sales", label: "Penjualan", icon: ReceiptText, href: "/laporan/keuangan/sales" },
  { id: "keuangan/expenses", label: "Pengeluaran", icon: WalletCards, href: "/laporan/keuangan/expenses" },
];

// Sub tabs for Inventory
const INVENTORY_TABS: TabConfig[] = [
  { id: "inventory", label: "Overview", icon: Package, href: "/laporan/inventory" },
  { id: "inventory/stock", label: "Stok", icon: Package, href: "/laporan/inventory/stock" },
  { id: "inventory/roasting", label: "Roasting", icon: Flame, href: "/laporan/inventory/roasting" },
  { id: "inventory/production", label: "Produksi", icon: Factory, href: "/laporan/inventory/production" },
];

interface ReportLayoutProps {
  activeTab: ReportTab;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ReportLayout({ activeTab, children, actions }: ReportLayoutProps) {
  // Determine which sub-tabs to show
  const isKeuangan = activeTab.startsWith("keuangan");
  const isInventory = activeTab.startsWith("inventory");
  const subTabs = isKeuangan ? KEUANGAN_TABS : isInventory ? INVENTORY_TABS : [];

  // Find current main tab label
  const currentMainTab = MAIN_TABS.find((t) => {
    if (isKeuangan) return t.id === "keuangan";
    if (isInventory) return t.id === "inventory";
    return t.id === activeTab;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="instrument-grid-dark shrink-0 border-b border-white/10 bg-[#05090D] text-white">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#69E8F3]">
              Report Center
            </p>
            <h1 className="mt-1 text-lg font-black tracking-[-0.03em] text-white">
              {currentMainTab?.label || "Report"}
            </h1>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {/* Main Tab Navigation */}
        <nav className="border-t border-white/[0.06]">
          <div className="mx-auto flex w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
            {MAIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab || 
                (tab.id === "keuangan" && isKeuangan) ||
                (tab.id === "inventory" && isInventory);
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap",
                    isActive
                      ? "border-[#00C8DF] text-[#00C8DF]"
                      : "border-transparent text-white/40 hover:text-white/70 hover:border-white/20",
                  )}
                >
                  <Icon size={14} />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sub Tab Navigation (if applicable) */}
        {subTabs.length > 0 && (
          <nav className="border-t border-white/[0.04] bg-[#0B141B]/50">
            <div className="mx-auto flex w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
              {subTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[10px] font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "border-[#00C8DF]/60 text-[#00C8DF]"
                        : "border-transparent text-white/30 hover:text-white/50 hover:border-white/10",
                    )}
                  >
                    <Icon size={12} />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-7">
          {children}
        </div>
      </main>
    </div>
  );
}
