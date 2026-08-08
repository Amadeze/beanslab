"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  BookOpen,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Factory,
  Flame,
  FileSignature,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { cn } from "@/lib/utils";
import { PLAN_CATALOG, planHasFeature, type PlanTier } from "@/lib/plans";
import { isTenantOwnerRole } from "@/lib/roles";

export type AppNavLink = {
  label: string;
  shortLabel: string;
  href: string;
  icon: React.ElementType;
  step?: string;
  tone: "system" | "inventory" | "roasting" | "sales" | "finance" | "production" | "neutral";
};

export const NAV_TONE_STYLES: Record<AppNavLink["tone"], {
  active: string;
  activeIcon: string;
  inactiveIcon: string;
}> = {
  system: {
    active: "bg-[#00C8DF] text-[#041116] shadow-[0_10px_30px_-18px_rgba(0,200,223,.9)]",
    activeIcon: "border-black/10 bg-[#041116]/10 text-[#041116]",
    inactiveIcon: "text-[#69E8F3]",
  },
  inventory: {
    active: "bg-[#2B7567] text-white shadow-[0_10px_30px_-18px_rgba(43,117,103,.9)]",
    activeIcon: "border-white/10 bg-white/10 text-white",
    inactiveIcon: "text-[#87CDBC]",
  },
  roasting: {
    active: "bg-[#B65331] text-white shadow-[0_10px_30px_-18px_rgba(182,83,49,.9)]",
    activeIcon: "border-white/10 bg-white/10 text-white",
    inactiveIcon: "text-[#E9A17F]",
  },
  production: {
    active: "bg-[#A66F12] text-white shadow-[0_10px_30px_-18px_rgba(166,111,18,.9)]",
    activeIcon: "border-white/10 bg-white/10 text-white",
    inactiveIcon: "text-[#E0BC67]",
  },
  sales: {
    active: "bg-[#6F4A6A] text-white shadow-[0_10px_30px_-18px_rgba(111,74,106,.9)]",
    activeIcon: "border-white/10 bg-white/10 text-white",
    inactiveIcon: "text-[#C7A8C4]",
  },
  finance: {
    active: "bg-[#4B6B3C] text-white shadow-[0_10px_30px_-18px_rgba(75,107,60,.9)]",
    activeIcon: "border-white/10 bg-white/10 text-white",
    inactiveIcon: "text-[#A8C390]",
  },
  neutral: {
    active: "bg-[#426C7A] text-white shadow-[0_10px_30px_-18px_rgba(66,108,122,.9)]",
    activeIcon: "border-white/10 bg-white/10 text-white",
    inactiveIcon: "text-[#83A9B1]",
  },
};

type NavSection = {
  label: string;
  caption: string;
  items: AppNavLink[];
};

export const APP_NAV_SECTIONS: NavSection[] = [
  {
    label: "Hari ini",
    caption: "Fokus dan tindakan",
    items: [
      {
        label: "Ringkasan",
        shortLabel: "Hari ini",
        href: "/dashboard",
        icon: LayoutDashboard,
        tone: "system",
      },
    ],
  },
  {
    label: "Operasional",
    caption: "Bahan menjadi produk",
    items: [
      {
        label: "Pasokan",
        shortLabel: "Pasokan",
        href: "/inventory",
        icon: Boxes,
        tone: "inventory",
      },
      {
        label: "Roasting",
        shortLabel: "Roast",
        href: "/roasting",
        icon: Flame,
        tone: "roasting",
      },
      {
        label: "Profil Roasting",
        shortLabel: "Profil",
        href: "/roasting/profiles",
        icon: Target,
        tone: "roasting",
      },
      {
        label: "Produksi",
        shortLabel: "Produksi",
        href: "/produksi",
        icon: Factory,
        tone: "production",
      },
    ],
  },
  {
    label: "Komersial",
    caption: "Pesanan dan pelanggan",
    items: [
      {
        label: "Buka Kasir",
        shortLabel: "Kasir",
        href: "/kasir",
        icon: ShoppingCart,
        tone: "sales",
      },
      {
        label: "Penjualan",
        shortLabel: "Penjualan",
        href: "/penjualan",
        icon: ShoppingBag,
        tone: "sales",
      },
      {
        label: "Kontrak OEM",
        shortLabel: "Kontrak",
        href: "/penjualan/kontrak",
        icon: FileSignature,
        tone: "sales",
      },
    ],
  },
  {
    label: "Kontrol",
    caption: "Uang dan kinerja",
    items: [
      {
        label: "Keuangan",
        shortLabel: "Keuangan",
        href: "/keuangan",
        icon: WalletCards,
        tone: "finance",
      },
      {
        label: "Laporan",
        shortLabel: "Laporan",
        href: "/laporan",
        icon: ChartNoAxesCombined,
        tone: "neutral",
      },
      {
        label: "Akuntansi",
        shortLabel: "Akun",
        href: "/laporan/akuntansi",
        icon: BookOpen,
        tone: "neutral",
      },
      {
        label: "Insight Assistant",
        shortLabel: "Insight",
        href: "/ai-insights",
        icon: Sparkles,
        tone: "neutral",
      },
    ],
  },
  {
    label: "Kelola",
    caption: "Data dan konfigurasi",
    items: [
      {
        label: "Katalog",
        shortLabel: "Katalog",
        href: "/katalog",
        icon: PackageSearch,
        tone: "production",
      },
      {
        label: "Pengaturan",
        shortLabel: "Setting",
        href: "/settings",
        icon: Settings2,
        tone: "neutral",
      },
    ],
  },
];

export function canAccessNavigation(
  href: string,
  userRole: string,
  subscriptionTier: PlanTier,
) {
  if (href === "/laporan" && !planHasFeature(subscriptionTier, "ADVANCED_REPORTS")) return false;
  if (isTenantOwnerRole(userRole)) return true;
  if (userRole === "MANAGER") return href !== "/billing";
  if (userRole === "OPERATOR") {
    return [
      "/dashboard",
      "/inventory",
      "/roasting",
      "/produksi",
      "/katalog",
    ].includes(href);
  }
  if (userRole === "CASHIER") {
    return ["/dashboard", "/kasir", "/penjualan"].includes(href);
  }
  return false;
}

export function getActiveNavigation(pathname: string, items: AppNavLink[]) {
  const workspacePath = pathname.startsWith("/audit")
      ? "/settings"
      : pathname;
  return items
    .filter((item) => workspacePath === item.href || workspacePath.startsWith(`${item.href}/`))
    .toSorted((a, b) => b.href.length - a.href.length)[0];
}

export function Sidebar({
  userRole,
  subscriptionTier,
  forceExpanded,
  pendingPaymentReviews,
}: {
  userRole: string;
  subscriptionTier: PlanTier;
  forceExpanded?: boolean;
  pendingPaymentReviews: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = forceExpanded ? false : collapsed;

  const visibleSections = APP_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      canAccessNavigation(item.href, userRole, subscriptionTier),
    ),
  })).filter((section) => section.items.length > 0);

  const visibleItems = visibleSections.flatMap((section) => section.items);
  const activeItem = getActiveNavigation(pathname, visibleItems);

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden bg-[#05090D] text-white transition-[width] duration-500 ease-[cubic-bezier(.16,1,.3,1)]",
        isCollapsed ? "w-[74px]" : "w-[264px]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,200,223,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,223,.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "linear-gradient(to bottom, black, transparent 70%)",
        }}
      />

      <div className={cn(
        "relative z-10 flex h-[72px] shrink-0 items-center border-b border-white/[0.08]",
        isCollapsed ? "justify-center px-3" : "gap-3 px-5",
      )}>
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#00C8DF] text-[#041116] shadow-[0_0_34px_rgba(0,200,223,.2)]">
          <Coffee size={18} strokeWidth={2.2} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#05090D] bg-white" />
        </div>

        {!isCollapsed ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-black tracking-[-0.045em]">roastd.id</p>
              <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.19em] text-white/35">
                Operating system
              </p>
            </div>
            {!forceExpanded ? (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-white/10 text-white/35 transition hover:border-[#00C8DF]/35 hover:bg-[#00C8DF]/10 hover:text-[#8EF3FC]"
                aria-label="Ciutkan navigasi"
              >
                <ChevronLeft size={14} />
              </button>
            ) : null}
          </>
        ) : !forceExpanded ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-6 z-20 flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/10 bg-[#0E1C24] text-white/55 shadow-xl transition hover:text-white"
            aria-label="Perluas navigasi"
          >
            <ChevronRight size={13} />
          </button>
        ) : null}
      </div>

      {!isCollapsed ? (
        <div className="relative z-10 mx-4 mt-4 rounded-[12px] border border-white/[0.08] bg-[#0B141B] p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] uppercase tracking-[0.17em] text-white/35">
              Workspace
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C8DF] shadow-[0_0_12px_#00C8DF]" />
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold capitalize text-white/80">
                {userRole.toLowerCase()}
              </p>
              <p className="mt-0.5 text-[9px] text-white/32">akses operasional aktif</p>
            </div>
            <span className="rounded-[6px] border border-[#00C8DF]/25 bg-[#00C8DF]/10 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#bff7ff]">
              {PLAN_CATALOG[subscriptionTier].label}
            </span>
          </div>
        </div>
      ) : null}

      <nav
        className={cn(
          "custom-scrollbar relative z-10 flex-1 overflow-y-auto py-5",
          isCollapsed ? "px-2.5" : "px-4",
        )}
        aria-label="Navigasi aplikasi"
      >
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.label} className={cn(sectionIndex > 0 && "mt-6")}>
            {!isCollapsed ? (
              <div className="mb-2.5 flex items-end justify-between px-2">
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
                  {section.label}
                </p>
                <p className="text-[8px] text-white/20">{section.caption}</p>
              </div>
            ) : sectionIndex > 0 ? (
              <div className="mx-auto mb-3 h-px w-7 bg-white/10" />
            ) : null}

            <div className="space-y-1">
              {section.items.map((item) => {
                const active = activeItem?.href === item.href;
                const Icon = item.icon;
                const tone = NAV_TONE_STYLES[item.tone];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8DF]",
                      isCollapsed
                        ? "mx-auto h-11 w-11 justify-center rounded-[11px]"
                        : "min-h-11 gap-3 rounded-[10px] px-3 py-2",
                      active
                        ? tone.active
                        : "text-white/48 hover:bg-white/[0.045] hover:text-white/82",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border transition",
                        active
                          ? tone.activeIcon
                          : `border-white/[0.07] bg-white/[0.035] ${tone.inactiveIcon} group-hover:border-white/15 group-hover:text-white`,
                      )}
                    >
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                    </span>
                    {!isCollapsed ? (
                      <>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                          {item.label}
                        </span>
                        {item.href === "/penjualan" && pendingPaymentReviews > 0 ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 font-mono text-[9px] font-black text-white">{Math.min(pendingPaymentReviews, 99)}</span> : null}
                        {item.step ? (
                          <span className={cn("font-mono text-[8px] tracking-[0.12em]", active ? "text-current opacity-50" : "text-white/20")}>
                            {item.step}
                          </span>
                        ) : null}
                      </>
                    ) : item.href === "/penjualan" && pendingPaymentReviews > 0 ? <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#05090D] bg-red-500" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn(
        "relative z-10 shrink-0 border-t border-white/[0.08] p-4",
        isCollapsed && "px-2.5",
      )}>
        <form action={logoutAction}>
          <button
            type="submit"
            className={cn(
              "group flex w-full items-center rounded-[10px] text-white/38 transition hover:bg-[#00C8DF]/10 hover:text-[#9ff4ff]",
              isCollapsed
                ? "mx-auto h-11 w-11 justify-center"
                : "gap-3 px-3 py-2.5 text-xs font-medium",
            )}
            title={isCollapsed ? "Keluar" : undefined}
          >
            <LogOut size={16} className="transition group-hover:-translate-x-0.5" />
            {!isCollapsed ? <span>Keluar dari workspace</span> : null}
          </button>
        </form>
      </div>
    </aside>
  );
}
