"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, Menu, MoreHorizontal, Search, X } from "lucide-react";
import {
  APP_NAV_SECTIONS,
  Sidebar,
  canAccessNavigation,
  getActiveNavigation,
  type AppNavLink,
} from "@/components/layout/Sidebar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/lib/plans";

const ALL_NAV_ITEMS = APP_NAV_SECTIONS.flatMap((section) => section.items);
const MOBILE_PRIMARY_HREFS = [
  "/dashboard",
  "/inventory",
  "/kasir",
  "/roasting",
];

/**
 * Tone dock memakai utilitas `.dock-<tone>-*` dari globals.css — tanpa hex
 * literal. Tone "system" memakai instrument dock yang lebih terang.
 */
const MOBILE_TONES: Record<AppNavLink["tone"], {
  text: string;
  line: string;
  activeIcon: string;
  prominent: string;
  inactiveIcon: string;
}> = {
  system: {
    text: "dock-system-text",
    line: "dock-system-line",
    activeIcon: "dock-system-activeicon",
    prominent: "dock-system-prominent",
    inactiveIcon: "dock-system-inactive",
  },
  inventory: {
    text: "dock-inventory-text",
    line: "dock-inventory-line",
    activeIcon: "dock-inventory-activeicon",
    prominent: "dock-inventory-prominent",
    inactiveIcon: "dock-inventory-inactive",
  },
  roasting: {
    text: "dock-roasting-text",
    line: "dock-roasting-line",
    activeIcon: "dock-roasting-activeicon",
    prominent: "dock-roasting-prominent",
    inactiveIcon: "dock-roasting-inactive",
  },
  production: {
    text: "dock-production-text",
    line: "dock-production-line",
    activeIcon: "dock-production-activeicon",
    prominent: "dock-production-prominent",
    inactiveIcon: "dock-production-inactive",
  },
  sales: {
    text: "dock-sales-text",
    line: "dock-sales-line",
    activeIcon: "dock-sales-activeicon",
    prominent: "dock-sales-prominent",
    inactiveIcon: "dock-sales-inactive",
  },
  finance: {
    text: "dock-finance-text",
    line: "dock-finance-line",
    activeIcon: "dock-finance-activeicon",
    prominent: "dock-finance-prominent",
    inactiveIcon: "dock-finance-inactive",
  },
  neutral: {
    text: "dock-neutral-text",
    line: "dock-neutral-line",
    activeIcon: "dock-neutral-activeicon",
    prominent: "dock-neutral-prominent",
    inactiveIcon: "dock-neutral-inactive",
  },
};

function MobileDock({
  items,
  activeItem,
  moreActive,
  onOpenMore,
  pendingPaymentReviews,
}: {
  items: AppNavLink[];
  activeItem?: AppNavLink;
  moreActive: boolean;
  onOpenMore: () => void;
  pendingPaymentReviews: number;
}) {
  return (
    <nav
      className="grid h-[60px] shrink-0 border-t border-white/10 bg-[#05090D] px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_40px_rgba(5,9,13,.18)] md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      aria-label="Navigasi utama mobile"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeItem?.href === item.href;
        const prominent = item.href === "/kasir";
        const tone = MOBILE_TONES[item.tone];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[8px] font-semibold transition",
              active ? tone.text : "text-white/45",
              prominent && "-mt-1.5",
            )}
          >
            {active ? (
              <span className={cn("absolute top-0 h-[2px] w-9", tone.line)} />
            ) : null}
            {prominent ? (
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-[10px] border-[2px] border-[#05090D] shadow-[0_6px_18px_rgba(0,0,0,.4)]",
                  active ? tone.prominent : `border-white/10 bg-[#0E1C24] ${tone.inactiveIcon}`,
                )}
              >
                <Icon size={16} strokeWidth={2.2} />
              </span>
            ) : (
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-[8px] border transition-colors",
                  active
                    ? tone.activeIcon
                    : "border-transparent bg-transparent text-white/40",
                )}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.7} />
              </span>
            )}
            <span className="max-w-full truncate px-1">{item.shortLabel}</span>
            {item.href === "/penjualan" && pendingPaymentReviews > 0 ? <span className="absolute right-[20%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white">{Math.min(pendingPaymentReviews, 99)}</span> : null}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className={cn(
          "relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[8px] font-semibold transition",
          moreActive ? "text-[#8EF3FC]" : "text-white/45",
        )}
        aria-label="Buka semua menu"
      >
        {moreActive ? (
          <span className="absolute top-0 h-[2px] w-8 bg-[#00C8DF] shadow-[0_0_14px_rgba(0,200,223,.8)]" />
        ) : null}
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-[8px] border",
            moreActive
              ? "border-[#00C8DF]/45 bg-[#00C8DF]/15 text-[#00C8DF]"
              : "border-transparent text-white/40",
          )}
        >
          <MoreHorizontal size={14} />
        </span>
        <span>Lainnya</span>
      </button>
    </nav>
  );
}

export function AppShell({
  children,
  userRole,
  subscriptionTier,
  pendingPaymentReviews,
  lowStockCount = 0,
  unfulfilledOrders = 0,
}: {
  children: React.ReactNode;
  userRole: string;
  subscriptionTier: PlanTier;
  pendingPaymentReviews: number;
  lowStockCount?: number;
  unfulfilledOrders?: number;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const visibleItems = ALL_NAV_ITEMS.filter((item) =>
    canAccessNavigation(item.href, userRole, subscriptionTier),
  );
  const activeItem = getActiveNavigation(pathname, visibleItems);
  const primaryHrefs = userRole === "CASHIER"
    ? ["/dashboard", "/kasir", "/penjualan"]
    : userRole === "OPERATOR"
      ? ["/dashboard", "/inventory", "/roasting", "/produksi"]
      : MOBILE_PRIMARY_HREFS;
  const mobileItems = primaryHrefs
    .map((href) => visibleItems.find((item) => item.href === href))
    .filter((item): item is AppNavLink => Boolean(item));
  const mobileDockItems = mobileItems.slice(0, 4);
  const moreActive = Boolean(
    activeItem && !mobileDockItems.some((item) => item.href === activeItem.href),
  );

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="ros-workspace flex h-[100dvh] w-full overflow-hidden bg-[#05090D]">
      {isMobileMenuOpen ? (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <div className="relative h-full shadow-[24px_0_80px_rgba(0,0,0,.34)]">
          <Sidebar
            userRole={userRole}
            subscriptionTier={subscriptionTier}
            pendingPaymentReviews={pendingPaymentReviews}
            lowStockCount={lowStockCount}
            unfulfilledOrders={unfulfilledOrders}
            forceExpanded
          />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/55 transition hover:text-white"
            aria-label="Tutup menu"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="relative hidden h-full md:flex">
        <Sidebar userRole={userRole} subscriptionTier={subscriptionTier} pendingPaymentReviews={pendingPaymentReviews} lowStockCount={lowStockCount} unfulfilledOrders={unfulfilledOrders} />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="absolute bottom-20 left-3 right-3 z-10 flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/55 transition hover:border-[#B65331]/35 hover:bg-[#B65331]/10 hover:text-[#F0B590]"
          aria-label="Buka perintah cepat"
        >
          <Search size={13} />
          <span className="flex-1 text-left">Cari halaman…</span>
          <kbd className="rounded-[5px] border border-white/12 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-white/40">⌘K</kbd>
        </button>
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background md:my-2 md:mr-2 md:rounded-[18px] md:border md:border-white/10 md:shadow-[0_24px_90px_rgba(0,0,0,.48)]">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-white/10 bg-[#05090D] px-4 text-white md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.05] text-white/75 transition active:scale-95"
              aria-label="Buka menu"
            >
              <Menu size={16} />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-[#00C8DF]/40 bg-[#00C8DF]/10 text-[#00C8DF]">
                <Coffee size={12} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold tracking-[-0.02em] text-white">
                  roastd.id
                </p>
              </div>
            </div>
          </div>
          <span className="ml-3 flex shrink-0 items-center gap-1.5 rounded-[7px] border border-[#00C8DF]/35 bg-[#00C8DF]/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#8EF3FC]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C8DF]" />
            live
          </span>
        </header>

        <div className="dashboard-canvas custom-scrollbar relative z-0 flex-1 overflow-auto">
          <Breadcrumbs />
          <div className="flex h-full w-full flex-col">{children}</div>
        </div>

        <MobileDock
          items={mobileDockItems}
          activeItem={activeItem}
          moreActive={moreActive}
          onOpenMore={() => setIsMobileMenuOpen(true)}
          pendingPaymentReviews={pendingPaymentReviews}
        />
      </main>

      <CommandPalette userRole={userRole} subscriptionTier={subscriptionTier} />
    </div>
  );
}
