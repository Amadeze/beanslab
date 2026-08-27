"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, ShoppingCart } from "lucide-react";
import { buildDashboardWorkItems } from "@/lib/dashboard-work-queue";
import type { TodayData } from "../actions";
import { WorkQueue } from "./DashboardShell";

const ROLE_LABEL: Record<TodayData["role"], string> = {
  OWNER: "Pemilik",
  MANAGER: "Manajer",
  OPERATOR: "Operator",
  CASHIER: "Kasir",
};

export function TodayShell({ data }: { data: TodayData }) {
  const workItems = useMemo(() => buildDashboardWorkItems({
    signals: data.operationalQueue,
    lowStock: data.lowStock,
    role: data.role,
  }), [data]);
  const primaryAction = data.role === "CASHIER"
    ? { href: "/kasir", label: "Buka kasir", icon: ShoppingCart }
    : { href: "/roasting", label: "Mulai operasional", icon: ClipboardCheck };
  const PrimaryIcon = primaryAction.icon;

  return (
    <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6 lg:p-8">
        <header className="flex flex-col justify-between gap-4 rounded-[14px] border border-border bg-card p-5 sm:flex-row sm:items-end md:p-6">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
              {ROLE_LABEL[data.role]} · Hari ini
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-stone-950 md:text-3xl">
              Kerjakan yang berikutnya
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">
              Satu daftar kerja dari pesanan, produksi, stok, dan roasting. Urutan teratas adalah prioritas sekarang.
            </p>
          </div>
          <Link
            href={primaryAction.href}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-obsidian px-4 text-sm font-bold text-white transition hover:bg-stone-800"
          >
            <PrimaryIcon size={16} />
            {primaryAction.label}
            <ArrowRight size={15} />
          </Link>
        </header>

        <WorkQueue items={workItems} />
      </div>
    </main>
  );
}
