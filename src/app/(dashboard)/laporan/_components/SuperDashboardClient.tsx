"use client";

import { useState, useTransition } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PnLReportClient } from "./PnLReportClient";
import { InventoryValuationClient } from "./InventoryValuationClient";
import { BalanceSheetClient } from "./BalanceSheetClient";
import type { PnLReport } from "../../keuangan/actions";
import {
  getBalanceSheetReport,
  getCoffeeFlowReport,
  getInventoryValuationReport,
  getSampleReport,
  type BalanceSheetReport,
  type CoffeeFlowReport,
  type InventoryValuationReport,
  type SampleReport,
} from "../actions";
import { cn } from "@/lib/utils";
import { FileText, Database, Scale, Activity, Beaker, ChevronLeft, ChevronRight } from "lucide-react";
import { CoffeeFlowClient } from "./CoffeeFlowClient";
import { SampleReportClient } from "./SampleReportClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";

interface SuperDashboardClientProps {
  pnlReport: PnLReport;
}

type ReportTab = "pnl" | "inventory" | "balanceSheet" | "flow" | "sample";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function navigateMonth(month: number, year: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function ReportPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-white/60 bg-white/50 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-white/60 bg-white/70 p-5">
        <Skeleton className="h-5 w-44" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SuperDashboardClient({ pnlReport }: SuperDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("pnl");
  const [isPending, startTransition] = useTransition();
  const [inventoryReport, setInventoryReport] = useState<InventoryValuationReport | null>(null);
  const [balanceSheetReport, setBalanceSheetReport] = useState<BalanceSheetReport | null>(null);
  const [flowReport, setFlowReport] = useState<CoffeeFlowReport | null>(null);
  const [sampleReport, setSampleReport] = useState<SampleReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reportAsOf = new Date(new Date(pnlReport.periodEnd).getTime() - 1);
  const reportStart = new Date(pnlReport.periodStart);

  const goToMonth = (month: number, year: number) => {
    window.location.search = `month=${month}&year=${year}`;
  };

  const openTab = (tab: ReportTab) => {
    setActiveTab(tab);
    setLoadError(null);

    if (tab === "inventory" && !inventoryReport) {
      startTransition(async () => {
        try {
          setInventoryReport(await getInventoryValuationReport(reportAsOf));
        } catch (err) {
          console.error("[SuperDashboardClient]", err);
          setLoadError("Gagal memuat valuasi aset.");
        }
      });
    }

    if (tab === "balanceSheet" && !balanceSheetReport) {
      startTransition(async () => {
        try {
          const inventory = inventoryReport ?? await getInventoryValuationReport(reportAsOf);
          setInventoryReport(inventory);
          setBalanceSheetReport(await getBalanceSheetReport(inventory.grandTotalValue, reportAsOf));
        } catch (err) {
          console.error("[SuperDashboardClient]", err);
          setLoadError("Gagal memuat neraca.");
        }
      });
    }

    if (tab === "flow" && !flowReport) {
      startTransition(async () => {
        try {
          setFlowReport(await getCoffeeFlowReport(reportStart, new Date(pnlReport.periodEnd)));
        } catch (err) {
          console.error("[SuperDashboardClient]", err);
          setLoadError("Gagal memuat arus kopi.");
        }
      });
    }

    if (tab === "sample" && !sampleReport) {
      startTransition(async () => {
        try {
          setSampleReport(await getSampleReport(reportStart, new Date(pnlReport.periodEnd)));
        } catch (err) {
          console.error("[SuperDashboardClient]", err);
          setLoadError("Gagal memuat laporan sample.");
        }
      });
    }
  };

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();
  const lastMonth = navigateMonth(thisMonth, thisYear, -1);

  const presets = [
    { label: "Bulan Ini", month: thisMonth, year: thisYear },
    { label: "Bulan Lalu", month: lastMonth.month, year: lastMonth.year },
  ];

  const prev = navigateMonth(pnlReport.month, pnlReport.year, -1);
  const next = navigateMonth(pnlReport.month, pnlReport.year, 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Laporan Finansial"
        eyebrow="Intelligence"
        description="Laba rugi, aset, arus kopi, dan sample dalam satu ruang analisis."
      />

      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">

          {/* Date Navigation */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white/70 p-3 shadow-sm">
        {/* Month Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goToMonth(prev.month, prev.year)}
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-bold text-stone-800">
            {MONTHS[pnlReport.month - 1]} {pnlReport.year}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goToMonth(next.month, next.year)}
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="h-6 w-px bg-stone-200" />

        {/* Quick Presets */}
        <div className="flex gap-1.5">
          {presets.map((preset) => {
            const isActive = pnlReport.month === preset.month && pnlReport.year === preset.year;
            return (
              <Button
                key={preset.label}
                size="sm"
                variant={isActive ? "default" : "outline"}
                onClick={() => goToMonth(preset.month, preset.year)}
                className={cn(
                  "h-8 text-xs font-semibold",
                  isActive && "bg-[var(--amber-deep)] text-white"
                )}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="custom-scrollbar mb-6 flex w-full overflow-x-auto border-b border-[var(--glass-border)]">
        {[
          { id: "pnl" as const, icon: FileText, label: "Laba Rugi" },
          { id: "inventory" as const, icon: Database, label: "Valuasi Aset" },
          { id: "balanceSheet" as const, icon: Scale, label: "Neraca" },
          { id: "flow" as const, icon: Activity, label: "Arus Kopi" },
          { id: "sample" as const, icon: Beaker, label: "Sample" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => openTab(tab.id)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
              activeTab === tab.id
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            )}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="h-full flex flex-col">
        {loadError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {loadError}
          </div>
        )}
        {activeTab === "pnl" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <PnLReportClient report={pnlReport} hideLayout />
          </div>
        )}
        {activeTab === "inventory" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {inventoryReport && !isPending ? (
              <InventoryValuationClient report={inventoryReport} hideLayout />
            ) : (
              <ReportPanelSkeleton />
            )}
          </div>
        )}
        {activeTab === "balanceSheet" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {balanceSheetReport && !isPending ? (
              <BalanceSheetClient report={balanceSheetReport} />
            ) : (
              <ReportPanelSkeleton />
            )}
          </div>
        )}
        {activeTab === "flow" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {flowReport && !isPending ? (
              <CoffeeFlowClient report={flowReport} />
            ) : (
              <ReportPanelSkeleton />
            )}
          </div>
        )}
        {activeTab === "sample" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {sampleReport && !isPending ? (
              <SampleReportClient report={sampleReport} />
            ) : (
              <ReportPanelSkeleton />
            )}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
