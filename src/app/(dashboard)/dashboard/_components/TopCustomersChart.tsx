"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import type { TopCustomer } from "../actions";
import { formatRupiah } from "@/lib/format";

const COLORS = ["#6F4A6A", "#B65331", "#2B7567", "#A66F12", "#4B6B3C"];

export function TopCustomersChart({ data }: { data: TopCustomer[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] glass-card-static p-5 text-center">
        <p className="text-sm font-semibold text-[var(--text-secondary)] mt-2">Belum ada data pelanggan</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[320px] glass-card-static p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Top Pelanggan</h2>
        <p className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
          5 Pelanggan dengan Belanja Terbanyak
        </p>
      </div>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--glass-border)" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--text-tertiary)", fontWeight: 600 }}
              width={100}
            />
            <Tooltip
              cursor={{ fill: "var(--glass-bg)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-hover)] p-3 shadow-[var(--glass-shadow-lg)]">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                        {payload[0].payload.name}
                      </p>
                      <p className="text-sm font-black text-amber-600">
                        {formatRupiah(Number(payload[0].value))}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="totalSpent" radius={[0, 4, 4, 0]} animationDuration={1000} barSize={24}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
