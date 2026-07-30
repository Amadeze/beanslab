"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import type { NeracaLajurRow } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};

export function NeracaLajurClient({
  data,
  error,
  fromDate,
  toDate,
}: {
  data: NeracaLajurRow[] | null;
  error: string | null;
  fromDate: string | null;
  toDate: string | null;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(fromDate ?? "");
  const [to, setTo] = useState(toDate ?? "");

  const sum = (rows: NeracaLajurRow[], key: keyof NeracaLajurRow) =>
    rows.reduce((s, r) => s + (r[key] as number), 0);

  function handleFilter() {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    router.push(`/laporan/akuntansi/neraca-lajur?${p.toString()}`);
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

      {data && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-stone-50">
                <th className="text-left px-3 py-2 font-medium text-stone-500">Kode</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Nama Akun</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Tipe</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">NS D</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">NS K</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">LR D</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">LR K</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Neraca D</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Neraca K</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map((r, i) => (
                <tr key={i} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-mono text-stone-600">{r.accountCode}</td>
                  <td className="px-3 py-2 text-stone-700">{r.accountName}</td>
                  <td className="px-3 py-2 text-stone-400">{TYPE_LABELS[r.type] ?? r.type}</td>
                  <td className="px-3 py-2 text-right font-mono text-stone-700">{r.tbDebit > 0 ? formatRupiah(r.tbDebit) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono text-stone-700">{r.tbCredit > 0 ? formatRupiah(r.tbCredit) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono text-stone-700">{r.plDebit > 0 ? formatRupiah(r.plDebit) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono text-stone-700">{r.plCredit > 0 ? formatRupiah(r.plCredit) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono text-stone-700">{r.neracaDebit > 0 ? formatRupiah(r.neracaDebit) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono text-stone-700">{r.neracaCredit > 0 ? formatRupiah(r.neracaCredit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-stone-50 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-stone-500">Total</td>
                <td className="px-3 py-2 text-right font-mono text-stone-800">{formatRupiah(sum(data, "tbDebit"))}</td>
                <td className="px-3 py-2 text-right font-mono text-stone-800">{formatRupiah(sum(data, "tbCredit"))}</td>
                <td className="px-3 py-2 text-right font-mono text-stone-800">{formatRupiah(sum(data.filter((r)=>r.type==="REVENUE"||r.type==="EXPENSE"), "plDebit"))}</td>
                <td className="px-3 py-2 text-right font-mono text-stone-800">{formatRupiah(sum(data.filter((r)=>r.type==="REVENUE"||r.type==="EXPENSE"), "plCredit"))}</td>
                <td className="px-3 py-2 text-right font-mono text-stone-800">{formatRupiah(sum(data.filter((r)=>r.type!=="REVENUE"&&r.type!=="EXPENSE"), "neracaDebit"))}</td>
                <td className="px-3 py-2 text-right font-mono text-stone-800">{formatRupiah(sum(data.filter((r)=>r.type!=="REVENUE"&&r.type!=="EXPENSE"), "neracaCredit"))}</td>
              </tr>
            </tfoot>
          </table>
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
