import React from "react";
import Link from "next/link";
import {
  Boxes,
  Factory,
  Flame,
  ReceiptText,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type OperatingStage =
  "inventory" | "roasting" | "production" | "sales" | "finance";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  mobileActions?: React.ReactNode;
  stage?: OperatingStage;
  eyebrow?: string;
}

const titleStages: Record<string, OperatingStage | undefined> = {
  Inventory: "inventory",
  Pasokan: "inventory",
  "Pasokan & Stok": "inventory",
  "Bahan & Stok": "inventory",
  Roasting: "roasting",
  Produksi: "production",
  "Produksi & Packing": "production",
  Penjualan: "sales",
  "Penjualan & Pesanan": "sales",
  Keuangan: "finance",
  "Kas & Piutang": "finance",
};

const operatingStages: Array<{
  id: OperatingStage;
  number: string;
  shortLabel: string;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    id: "inventory",
    number: "01",
    shortLabel: "Stok",
    label: "Pasokan & Stok",
    href: "/inventory",
    icon: Boxes,
  },
  {
    id: "roasting",
    number: "02",
    shortLabel: "Roast",
    label: "Roasting",
    href: "/roasting",
    icon: Flame,
  },
  {
    id: "production",
    number: "03",
    shortLabel: "Produksi",
    label: "Produksi",
    href: "/produksi",
    icon: Factory,
  },
  {
    id: "sales",
    number: "04",
    shortLabel: "Jual",
    label: "Penjualan",
    href: "/penjualan",
    icon: ReceiptText,
  },
  {
    id: "finance",
    number: "05",
    shortLabel: "Kas",
    label: "Kas & Piutang",
    href: "/keuangan",
    icon: WalletCards,
  },
];

export function PageHeader({
  title,
  description,
  actions,
  mobileActions,
  stage,
  eyebrow,
}: PageHeaderProps) {
  const activeStage = stage ?? titleStages[title];
  const activeIndex = operatingStages.findIndex(
    (item) => item.id === activeStage,
  );
  const stageTone = {
    inventory: {
      eyebrow: "text-[#87CDBC]",
      active:
        "border-[#2B7567] bg-[#2B7567] text-white shadow-[0_0_22px_rgba(43,117,103,.3)]",
      complete: "border-[#2B7567]/55 bg-[#2B7567]/14 text-[#87CDBC]",
      label: "text-[#9AD7C8]",
      line: "bg-[#2B7567]",
    },
    roasting: {
      eyebrow: "text-[#E9A17F]",
      active:
        "border-[#B65331] bg-[#B65331] text-white shadow-[0_0_22px_rgba(182,83,49,.3)]",
      complete: "border-[#B65331]/55 bg-[#B65331]/14 text-[#E9A17F]",
      label: "text-[#F0AC8C]",
      line: "bg-[#B65331]",
    },
    production: {
      eyebrow: "text-[#E0BC67]",
      active:
        "border-[#A66F12] bg-[#A66F12] text-white shadow-[0_0_22px_rgba(166,111,18,.3)]",
      complete: "border-[#A66F12]/55 bg-[#A66F12]/14 text-[#E0BC67]",
      label: "text-[#E7C778]",
      line: "bg-[#A66F12]",
    },
    sales: {
      eyebrow: "text-[#C7A8C4]",
      active:
        "border-[#6F4A6A] bg-[#6F4A6A] text-white shadow-[0_0_22px_rgba(111,74,106,.3)]",
      complete: "border-[#6F4A6A]/55 bg-[#6F4A6A]/14 text-[#C7A8C4]",
      label: "text-[#D2B5CF]",
      line: "bg-[#6F4A6A]",
    },
    finance: {
      eyebrow: "text-[#A8C390]",
      active:
        "border-[#4B6B3C] bg-[#4B6B3C] text-white shadow-[0_0_22px_rgba(75,107,60,.3)]",
      complete: "border-[#4B6B3C]/55 bg-[#4B6B3C]/14 text-[#A8C390]",
      label: "text-[#B7CE9F]",
      line: "bg-[#4B6B3C]",
    },
  } as const;
  const headerTone = activeStage ? stageTone[activeStage] : undefined;

  return (
    <header
      data-testid="page-header"
      className="instrument-grid-dark relative z-20 shrink-0 border-b border-white/10 bg-[#05090D] text-white"
    >
      <div
        className={cn(
          "mx-auto grid min-h-[72px] w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8",
          activeStage &&
            "xl:grid-cols-[minmax(230px,0.72fr)_minmax(480px,1.4fr)_auto]",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "mb-1.5 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em]",
              headerTone?.eyebrow ?? "text-[#71D2DA]",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full shadow-[0_0_12px_currentColor]",
                headerTone?.active
                  .split(" ")
                  .find((value) => value.startsWith("bg-")) ?? "bg-[#15B8C6]",
              )}
              aria-hidden
            />
            {eyebrow ?? (activeStage ? "Roastery flow" : "Workspace")}
          </p>
          <div className="flex items-center gap-3">
            <h1 className="truncate text-[clamp(1.3rem,2.1vw,1.8rem)] font-black leading-none tracking-[-0.045em] text-white">
              {title}
            </h1>
            {activeIndex >= 0 && (
              <span className="hidden font-mono text-[9px] font-bold tracking-[0.16em] text-white/30 sm:inline">
                SYS 0{activeIndex + 1} / 05
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 max-w-2xl truncate text-[11px] leading-4 text-white/45">
              {description}
            </p>
          )}
        </div>
        {activeStage && (
          <nav
            data-testid="operating-stage-rail"
            aria-label="Alur operasional roastery"
            className="hidden min-w-0 xl:block"
          >
            <div className="grid h-12 w-full grid-cols-5">
              {operatingStages.map((item, index) => {
                const isActive = item.id === activeStage;
                const isComplete = activeIndex > index;
                const Icon = item.icon;
                const tone = stageTone[item.id];

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={isActive ? "step" : undefined}
                    className="group relative flex min-w-0 flex-col items-center justify-center gap-1 text-center"
                  >
                    {index > 0 && (
                      <span
                        aria-hidden
                        className={`absolute right-1/2 top-[16px] h-px w-full ${
                          index <= activeIndex ? tone.line : "bg-white/10"
                        }`}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 flex size-7 items-center justify-center rounded-[7px] border transition-colors",
                        isActive
                          ? tone.active
                          : isComplete
                            ? tone.complete
                            : "border-white/10 bg-white/[0.035] text-white/30 group-hover:border-white/25 group-hover:text-white/60",
                      )}
                      aria-label={`Tahap ${item.number}`}
                    >
                      <Icon size={12} strokeWidth={isActive ? 2.2 : 1.8} />
                    </span>
                    <span
                      className={cn(
                        "relative z-10 truncate text-[9px] font-semibold",
                        isActive ? tone.label : "text-white/32",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
        {(actions || mobileActions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-[11px] border border-white/8 bg-white/[0.035] p-1">
            {actions && (
              <div className="hidden items-center gap-2 md:flex">{actions}</div>
            )}
            {mobileActions && (
              <div className="flex items-center gap-2 md:hidden">
                {mobileActions}
              </div>
            )}
            {actions && !mobileActions && (
              <div className="flex items-center gap-2 md:hidden">{actions}</div>
            )}
          </div>
        )}
      </div>
      {activeStage && (
        <nav
          data-testid="operating-stage-rail-mobile"
          aria-label="Alur operasional roastery"
          className="border-t border-white/[0.08] bg-[#0B141B]/95 xl:hidden"
        >
          <div className="mx-auto grid h-[52px] w-full max-w-[1600px] grid-cols-5 px-2 sm:px-6 lg:px-8">
            {operatingStages.map((item, index) => {
              const isActive = item.id === activeStage;
              const isComplete = activeIndex > index;
              const Icon = item.icon;
              const tone = stageTone[item.id];

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? "step" : undefined}
                  className="group relative flex min-w-0 flex-col items-center justify-center gap-1 text-center"
                >
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={`absolute right-1/2 top-[17px] h-px w-full ${
                        index <= activeIndex ? tone.line : "bg-white/10"
                      }`}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex size-7 items-center justify-center rounded-[7px] border transition-colors",
                      isActive
                        ? tone.active
                        : isComplete
                          ? tone.complete
                          : "border-white/10 bg-white/[0.035] text-white/30 group-hover:border-white/25 group-hover:text-white/60",
                    )}
                    aria-label={`Tahap ${item.number}`}
                  >
                    <Icon size={12} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span
                    className={cn(
                      "relative z-10 truncate text-[8px] font-semibold sm:text-[9px]",
                      isActive ? tone.label : "text-white/32",
                    )}
                  >
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

export function PageHeaderSkeleton({ stage = false }: { stage?: boolean }) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-[#05090D]" aria-hidden>
      <div className="mx-auto flex min-h-[72px] w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="h-2 w-24 animate-pulse rounded-full bg-white/20" />
          <div className="h-6 w-52 animate-pulse rounded-md bg-white/15" />
          <div className="h-2.5 w-56 max-w-[55vw] animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-white/10" />
      </div>
      {stage && (
        <div className="grid h-[52px] grid-cols-5 border-t border-white/10 bg-[#0B141B] px-6 xl:hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center gap-2"
            >
              <div className="h-7 w-7 animate-pulse rounded-[8px] bg-white/10" />
              <div className="h-2 w-12 animate-pulse rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
