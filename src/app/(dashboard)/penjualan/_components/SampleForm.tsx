"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { createSampleUsage, type SamplePageData, type SampleSourceType } from "../sample-actions";

type BlendRow = { key: string; productId: string; ratioPercent: number };

export function SampleForm({
  id,
  data,
  onSuccess,
  onPendingChange,
}: {
  id: string;
  data: SamplePageData;
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [sourceType, setSourceType] = useState<SampleSourceType>("FINISHED_GOODS");
  const [finishedProductId, setFinishedProductId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [packagingId, setPackagingId] = useState("");
  const [gramsPerPack, setGramsPerPack] = useState(100);
  const [packCount, setPackCount] = useState(1);
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [blendRows, setBlendRows] = useState<BlendRow[]>([
    { key: "initial", productId: "", ratioPercent: 100 },
  ]);

  const totalGrams = Math.max(0, gramsPerPack) * Math.max(0, packCount);
  const ratioTotal = blendRows.reduce((sum, row) => sum + Number(row.ratioPercent || 0), 0);
  const previewCost = useMemo(() => {
    if (sourceType === "FINISHED_GOODS") {
      const product = data.finishedGoods.find((item) => item.id === finishedProductId);
      return (product?.hppPerUnit ?? 0) * packCount;
    }
    const ratios = sourceType === "RECIPE"
      ? data.recipes.find((item) => item.id === recipeId)?.items ?? []
      : blendRows;
    const coffeeCost = ratios.reduce((sum, row) => {
      const bean = data.roastedBeans.find((item) => item.id === row.productId);
      return sum + ((totalGrams * Number(row.ratioPercent)) / 100_000) * (bean?.avgCostPerKg ?? 0);
    }, 0);
    const packaging = data.packagings.find((item) => item.id === packagingId);
    return coffeeCost + (packaging?.avgCostPerUnit ?? 0) * packCount;
  }, [blendRows, data, finishedProductId, packCount, packagingId, recipeId, sourceType, totalGrams]);

  function changeSource(next: SampleSourceType) {
    setSourceType(next);
    if (next !== "RECIPE") setPackagingId("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPendingChange(true);
    const result = await createSampleUsage({
      operationKey: crypto.randomUUID(),
      sourceType,
      finishedProductId: sourceType === "FINISHED_GOODS" ? finishedProductId : undefined,
      recipeId: sourceType === "RECIPE" ? recipeId : undefined,
      customLabel: sourceType === "CUSTOM_BLEND" ? customLabel : undefined,
      customComponents: sourceType === "CUSTOM_BLEND"
        ? blendRows.map(({ productId, ratioPercent }) => ({ productId, ratioPercent: Number(ratioPercent) }))
        : undefined,
      packagingId: sourceType === "FINISHED_GOODS" ? undefined : packagingId || undefined,
      gramsPerPack: Number(gramsPerPack),
      packCount: Number(packCount),
      recipient: recipient.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onPendingChange(false);
    if (!result.success) {
      toastSafe.error(result.error);
      return;
    }
    toast.success(`${result.sampleCode} tercatat. Stok dan laporan sudah diperbarui.`);
    onSuccess();
  }

  const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100";
  return (
    <form id={id} onSubmit={submit} className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-stone-700">Ambil sample dari</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([
            ["FINISHED_GOODS", "Produk jadi"],
            ["RECIPE", "Resep blend"],
            ["CUSTOM_BLEND", "Custom blend"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => changeSource(value)} className={`min-h-11 rounded-lg border px-2 text-xs font-semibold transition-colors ${sourceType === value ? "border-[var(--amber-deep)] bg-[var(--amber-deep)] text-white" : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {sourceType === "FINISHED_GOODS" && (
        <label className="block text-xs font-semibold text-stone-700">Produk siap jual
          <select required value={finishedProductId} onChange={(event) => {
            setFinishedProductId(event.target.value);
            const selected = data.finishedGoods.find((item) => item.id === event.target.value);
            if (selected?.outputGrams) setGramsPerPack(selected.outputGrams);
          }} className={fieldClass}>
            <option value="">Pilih produk</option>
            {data.finishedGoods.map((item) => <option key={item.id} value={item.id}>{item.name} · stok {item.stockUnit}</option>)}
          </select>
        </label>
      )}

      {sourceType === "RECIPE" && (
        <label className="block text-xs font-semibold text-stone-700">Resep tersimpan
          <select required value={recipeId} onChange={(event) => {
            setRecipeId(event.target.value);
            const selected = data.recipes.find((item) => item.id === event.target.value);
            if (selected) {
              setGramsPerPack(selected.outputGrams);
              setPackagingId(selected.packagingId);
            }
          }} className={fieldClass}>
            <option value="">Pilih resep</option>
            {data.recipes.map((item) => <option key={item.id} value={item.id}>{item.productName} · {item.name}</option>)}
          </select>
        </label>
      )}

      {sourceType === "CUSTOM_BLEND" && (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <label className="block text-xs font-semibold text-stone-700">Nama singkat blend
            <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="Contoh: Sample House Blend A" className={fieldClass} />
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-700">Komposisi</p>
            <span className={`text-xs font-bold ${Math.abs(ratioTotal - 100) < 0.01 ? "text-emerald-700" : "text-red-600"}`}>{ratioTotal}%</span>
          </div>
          {blendRows.map((row, index) => (
            <div key={row.key} className="grid grid-cols-[1fr_76px_36px] gap-2">
              <select required value={row.productId} onChange={(event) => setBlendRows((current) => current.map((item) => item.key === row.key ? { ...item, productId: event.target.value } : item))} className="h-10 rounded-lg border border-stone-200 bg-white px-2 text-xs">
                <option value="">Pilih roasted bean</option>
                {data.roastedBeans.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stockKg.toLocaleString("id-ID")} kg</option>)}
              </select>
              <input required type="number" min="0.01" max="100" step="0.01" value={row.ratioPercent} onChange={(event) => setBlendRows((current) => current.map((item) => item.key === row.key ? { ...item, ratioPercent: Number(event.target.value) } : item))} aria-label={`Persentase komponen ${index + 1}`} className="h-10 rounded-lg border border-stone-200 bg-white px-2 text-right text-xs" />
              <button type="button" disabled={blendRows.length === 1} onClick={() => setBlendRows((current) => current.filter((item) => item.key !== row.key))} className="flex h-10 items-center justify-center rounded-lg border border-stone-200 text-stone-400 disabled:opacity-30"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={blendRows.length >= 10} onClick={() => setBlendRows((current) => [...current, { key: crypto.randomUUID(), productId: "", ratioPercent: 0 }])} className="w-full gap-1.5"><Plus size={14} />Tambah komponen</Button>
          <p className="text-[11px] leading-4 text-stone-500">Hanya snapshot komposisi untuk transaksi ini. Sistem tidak membuat resep baru.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-stone-700">Gram / pack
          <input required type="number" min="1" max="10000" step="1" value={gramsPerPack} onChange={(event) => setGramsPerPack(Number(event.target.value))} className={fieldClass} />
        </label>
        <label className="block text-xs font-semibold text-stone-700">Jumlah pack
          <input required type="number" min="1" max="1000" step="1" value={packCount} onChange={(event) => setPackCount(Number(event.target.value))} className={fieldClass} />
        </label>
      </div>

      {sourceType !== "FINISHED_GOODS" && (
        <label className="block text-xs font-semibold text-stone-700">Kemasan <span className="font-normal text-stone-400">(opsional)</span>
          <select value={packagingId} onChange={(event) => setPackagingId(event.target.value)} className={fieldClass}>
            <option value="">Tanpa kemasan dari stok</option>
            {data.packagings.map((item) => <option key={item.id} value={item.id}>{item.name} · stok {item.stockUnit}</option>)}
          </select>
        </label>
      )}

      <label className="block text-xs font-semibold text-stone-700">Penerima <span className="font-normal text-stone-400">(opsional)</span>
        <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Nama pelanggan atau calon pelanggan" className={fieldClass} />
      </label>
      <label className="block text-xs font-semibold text-stone-700">Catatan <span className="font-normal text-stone-400">(opsional)</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Tujuan sample atau tindak lanjut" className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
      </label>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex justify-between gap-3 text-xs"><span className="text-amber-800">Stok keluar</span><strong className="text-amber-950">{totalGrams.toLocaleString("id-ID")} g · {packCount} pack</strong></div>
        <div className="mt-1.5 flex justify-between gap-3 text-xs"><span className="text-amber-800">Estimasi HPP sample</span><strong className="text-amber-950">{formatRupiah(previewCost)}</strong></div>
        <p className="mt-2 text-[11px] leading-4 text-amber-800">Tidak membuat nota, pendapatan, piutang, atau mutasi kas.</p>
      </div>
    </form>
  );
}
