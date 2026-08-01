"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatRupiah } from "@/lib/format";
import type { RevenueTrend } from "../actions";

export function RevenueChart({ data }: { data: RevenueTrend[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] glass-card-static p-5 text-center">
        <p className="text-sm font-semibold text-[var(--text-secondary)] mt-2">Belum ada data pendapatan</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[320px] glass-card-static p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Tren Pendapatan</h2>
        <p className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
          7 Hari Terakhir
        </p>
      </div>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6F4A6A" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6F4A6A" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
              dy={8}
            />
            <YAxis
              tickFormatter={(v: number) => formatRupiah(v)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
              width={80}
              dx={-4}
            />
            <Tooltip
              cursor={{ stroke: "var(--glass-border)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-hover)] p-3 shadow-[var(--glass-shadow-lg)]">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">{label}</p>
                      <p className="text-sm font-black text-emerald-600">{formatRupiah(Number(payload[0].value))}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6F4A6A"
              strokeWidth={2}
              fill="url(#colorRev)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
