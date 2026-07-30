"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import type { ArusKasRow } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORY_LABELS: Record<string, string> = {
  OPERATING: "Aktivitas Operasi",
  INVESTING: "Aktivitas Investasi",
  FINANCING: "Aktivitas Pendanaan",
};

export function ArusKasClient({
  data,
  error,
  fromDate,
  toDate,
}: {
  data: ArusKasRow[] | null;
  error: string | null;
  fromDate: string | null;
  toDate: string | null;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(fromDate ?? "");
  const [to, setTo] = useState(toDate ?? "");

  const grouped = data?.reduce<Record<string, ArusKasRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  function handleFilter() {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    router.push(`/laporan/akuntansi/arus-kas?${p.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-5 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">Dari Tanggal</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Sampai Tanggal</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button onClick={handleFilter}>Terapkan</Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {data && grouped && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {Object.entries(grouped).map(([cat, rows]) => {
            const isTotal = (l: string) => l.includes("Bersih");
            return (
              <div key={cat}>
                <div className="px-5 py-3 bg-stone-50 border-b border-stone-200">
                  <span className="text-xs font-bold uppercase tracking-wider">{CATEGORY_LABELS[cat]}</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {rows.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between px-5 py-3 ${isTotal(r.label) ? "bg-stone-50 font-semibold" : ""}`}>
                      <span className={`text-sm ${isTotal(r.label) ? "font-semibold text-stone-800" : "text-stone-600"}`}>
                        {r.label}
                      </span>
                      <span className={`font-mono text-sm ${r.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {r.amount >= 0 ? formatRupiah(r.amount) : `(${formatRupiah(Math.abs(r.amount))})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!data && !error && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
          Atur periode dan klik <strong>Terapkan</strong>.
        </div>
      )}
    </div>
  );
}
