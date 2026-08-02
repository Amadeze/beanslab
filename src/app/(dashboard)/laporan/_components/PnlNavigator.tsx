"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function shift(month: number, year: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function PnlNavigator({ month, year }: { month: number; year: number }) {
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();
  const prev = shift(month, year, -1);
  const next = shift(month, year, 1);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-1">
        <Link
          href={`/laporan/analisa/laba-rugi?month=${prev.month}&year=${prev.year}`}
          className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft size={16} />
        </Link>
        <span className="min-w-[140px] text-center text-sm font-bold text-stone-800">
          {MONTHS[month - 1]} {year}
        </span>
        <Link
          href={`/laporan/analisa/laba-rugi?month=${next.month}&year=${next.year}`}
          className="flex rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight size={16} />
        </Link>
      </div>
      <div className="h-6 w-px bg-stone-200" />
      <Link
        href={`/laporan/analisa/laba-rugi?month=${thisMonth}&year=${thisYear}`}
        className={cn(
          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
          month === thisMonth && year === thisYear
            ? "border-stone-900 bg-stone-900 text-white"
            : "border-stone-200 text-stone-600 hover:bg-stone-50",
        )}
      >
        Bulan Ini
      </Link>
    </div>
  );
}