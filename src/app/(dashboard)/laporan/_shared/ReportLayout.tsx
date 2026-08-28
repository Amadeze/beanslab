"use client";

import Link from "next/link";
import {
  ReceiptText,
  WalletCards,
  Package,
  Flame,
  Factory,
  Calendar,
  BadgeDollarSign,
  TrendingUp,
  FileText,
  Scale,
  Database,
  Activity,
  Beaker,
  ChartPie,
  BookOpen,
  Landmark,
  Wallet,
  Layers,
  PiggyBank,
  TableProperties,
  RefreshCcw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "@/components/layout/PageHeader";

export type ReportTab =
  | "keuangan"
  | "keuangan/sales"
  | "keuangan/expenses"
  | "keuangan/laba-rugi"
  | "keuangan/neraca"
  | "inventory"
  | "inventory/stock"
  | "inventory/roasting"
  | "inventory/production"
  | "analisa/nilai-stok"
  | "analisa/alur-kopi"
  | "analisa/sample"
  | "daily"
  | "akuntansi"
  | "akuntansi/arus-kas"
  | "akuntansi/buku-besar"
  | "akuntansi/integrity"
  | "akuntansi/laba-ditahan"
  | "akuntansi/neraca-lajur"
  | "akuntansi/perubahan-ekuitas";

interface TabConfig {
  id: ReportTab;
  label: string;
  icon: LucideIcon;
  href: string;
}

const SUPER_TABS: TabConfig[] = [
  { id: "keuangan", label: "Keuangan", icon: BadgeDollarSign, href: "/laporan/keuangan" },
  { id: "inventory", label: "Persediaan", icon: Package, href: "/laporan/inventory" },
  { id: "analisa/alur-kopi", label: "Analisa", icon: ChartPie, href: "/laporan/analisa/alur-kopi" },
  { id: "akuntansi", label: "Akuntansi", icon: BookOpen, href: "/laporan/akuntansi" },
  { id: "daily", label: "Harian", icon: Calendar, href: "/laporan/daily" },
];

const AKUNTANSI_TABS: TabConfig[] = [
  { id: "akuntansi", label: "Akuntansi", icon: Landmark, href: "/laporan/akuntansi" },
  { id: "akuntansi/arus-kas", label: "Arus Kas", icon: Wallet, href: "/laporan/akuntansi/arus-kas" },
  { id: "akuntansi/buku-besar", label: "Buku Besar", icon: Layers, href: "/laporan/akuntansi/buku-besar" },
  { id: "akuntansi/laba-ditahan", label: "Laba Ditahan", icon: PiggyBank, href: "/laporan/akuntansi/laba-ditahan" },
  { id: "akuntansi/neraca-lajur", label: "Neraca Lajur", icon: TableProperties, href: "/laporan/akuntansi/neraca-lajur" },
  { id: "akuntansi/perubahan-ekuitas", label: "Perubahan Ekuitas", icon: RefreshCcw, href: "/laporan/akuntansi/perubahan-ekuitas" },
  { id: "akuntansi/integrity", label: "Integritas GL", icon: ShieldCheck, href: "/laporan/akuntansi/integrity" },
];

const KEUANGAN_TABS: TabConfig[] = [
  { id: "keuangan", label: "Overview", icon: TrendingUp, href: "/laporan/keuangan" },
  { id: "keuangan/sales", label: "Penjualan", icon: ReceiptText, href: "/laporan/keuangan/sales" },
  { id: "keuangan/expenses", label: "Pengeluaran", icon: WalletCards, href: "/laporan/keuangan/expenses" },
  { id: "keuangan/laba-rugi", label: "Laba Rugi", icon: FileText, href: "/laporan/analisa/laba-rugi" },
  { id: "keuangan/neraca", label: "Neraca", icon: Scale, href: "/laporan/analisa/neraca" },
];

const INVENTORY_TABS: TabConfig[] = [
  { id: "inventory", label: "Overview", icon: Package, href: "/laporan/inventory" },
  { id: "inventory/stock", label: "Stok", icon: Package, href: "/laporan/inventory/stock" },
  { id: "inventory/roasting", label: "Roasting", icon: Flame, href: "/laporan/inventory/roasting" },
  { id: "inventory/production", label: "Produksi", icon: Factory, href: "/laporan/inventory/production" },
];

const ANALISA_TABS: TabConfig[] = [
  { id: "analisa/alur-kopi", label: "Alur Kopi", icon: Activity, href: "/laporan/analisa/alur-kopi" },
  { id: "analisa/nilai-stok", label: "Valuasi Stok", icon: Database, href: "/laporan/analisa/nilai-stok" },
  { id: "analisa/sample", label: "Sample", icon: Beaker, href: "/laporan/analisa/sample" },
];

interface ReportLayoutProps {
  activeTab: ReportTab;
  children: React.ReactNode;
  actions?: React.ReactNode;
  title?: string;
}

export function ReportLayout({ activeTab, children, actions, title }: ReportLayoutProps) {
  const isKeuangan = activeTab.startsWith("keuangan");
  const isInventory = activeTab.startsWith("inventory");
  const isAnalisa = activeTab.startsWith("analisa");
  const isAkuntansi = activeTab.startsWith("akuntansi");
  const subTabs = isKeuangan
    ? KEUANGAN_TABS
    : isInventory
      ? INVENTORY_TABS
      : isAnalisa
        ? ANALISA_TABS
        : isAkuntansi
          ? AKUNTANSI_TABS
          : [];

  const currentMain = SUPER_TABS.find((t) => {
    if (isKeuangan) return t.id === "keuangan";
    if (isInventory) return t.id === "inventory";
    if (isAnalisa) return t.id === "analisa/alur-kopi";
    if (isAkuntansi) return t.id === "akuntansi";
    return t.id === activeTab;
  });

  const [portalNode, setPortalNode] = useState<Element | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setPortalNode(document.getElementById("app-top-bar-bottom-portal"));
  }, []);

  const tabsContent = (
    <div className="w-full shrink-0">
      <nav className="border-b border-border bg-card">
        <div className="flex w-full overflow-x-auto no-scrollbar mask-fade-right">
          {SUPER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab ||
              (tab.id === "keuangan" && isKeuangan) ||
              (tab.id === "inventory" && isInventory) ||
              (tab.id === "analisa/alur-kopi" && isAnalisa) ||
              (tab.id === "akuntansi" && isAkuntansi);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-[11px] font-semibold transition-colors sm:px-4",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-ink-secondary hover:border-border hover:text-foreground active:border-foreground active:text-foreground",
                )}
              >
                <Icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {subTabs.length > 0 && (
        <nav className="border-b border-border bg-surface-sunken">
          <div className="flex w-full overflow-x-auto no-scrollbar mask-fade-right">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-1.5 text-[10px] font-medium transition-colors sm:px-4",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-ink-secondary hover:border-border hover:text-foreground",
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
    </div>
  );

  return (
    <>
      <PageHeader
        title={title || currentMain?.label || "Laporan"}
        eyebrow="Report Center"
        actions={actions}
      />
      {mounted && portalNode && createPortal(tabsContent, portalNode)}
      <div className="flex min-h-0 flex-1 flex-col">
        {(!mounted || !portalNode) && tabsContent}
        <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto bg-transparent">
          <div className="mx-auto w-full max-w-[1600px] p-2.5 sm:p-3 md:p-4 lg:p-5">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

