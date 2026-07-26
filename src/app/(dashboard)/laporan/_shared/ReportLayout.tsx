"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  ReceiptText,
  WalletCards,
  Package,
  Flame,
  Factory,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportTab =
  | "summary"
  | "sales"
  | "expense"
  | "stock"
  | "roasting"
  | "production"
  | "daily";

interface TabConfig {
  id: ReportTab;
  label: string;
  icon: LucideIcon;
  href: string;
}

const REPORT_TABS: TabConfig[] = [
  { id: "summary", label: "Ringkasan", icon: LayoutDashboard, href: "/laporan/summary" },
  { id: "sales", label: "Penjualan", icon: ReceiptText, href: "/laporan/sales" },
  { id: "expense", label: "Pengeluaran", icon: WalletCards, href: "/laporan/expense" },
  { id: "stock", label: "Stok", icon: Package, href: "/laporan/stock" },
  { id: "roasting", label: "Roasting", icon: Flame, href: "/laporan/roasting" },
  { id: "production", label: "Produksi", icon: Factory, href: "/laporan/production" },
  { id: "daily", label: "Harian", icon: Calendar, href: "/laporan/daily" },
];

interface ReportLayoutProps {
  activeTab: ReportTab;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ReportLayout({ activeTab, children, actions }: ReportLayoutProps) {
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
              {REPORT_TABS.find((t) => t.id === activeTab)?.label}
            </h1>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {/* Tab Navigation */}
        <nav className="border-t border-white/[0.06]">
          <div className="mx-auto flex w-full max-w-[1600px] overflow-x-auto px-4 sm:px-6 lg:px-8">
            {REPORT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
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
