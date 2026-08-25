import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, Boxes, Factory, FileSignature, Flame, PackageCheck, Radar, ShieldCheck, TrendingUp, Warehouse } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { productionExecutionHref, roastingExecutionHref } from "@/lib/operations-execution";
import { getControlTowerData } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Stat } from "@/components/ui/stat";

type ControlTowerData = Awaited<ReturnType<typeof getControlTowerData>>;

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function SectionHeading({ icon: Icon, eyebrow, title, detail, href, action }: { icon: React.ElementType; eyebrow: string; title: string; detail: string; href?: string; action?: string }) {
  return (
    <CardHeader className="flex-row items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0B141B] text-copper">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <Eyebrow tone="muted">{eyebrow}</Eyebrow>
          <CardTitle className="mt-1 text-base">{title}</CardTitle>
          <p className="mt-1 text-xs leading-5 text-ink-secondary">{detail}</p>
        </div>
      </div>
      {href && action ? (
        <Link href={href} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold text-ink-secondary transition hover:border-copper/40 hover:bg-copper-soft hover:text-copper">
          {action}<ArrowRight size={13} />
        </Link>
      ) : null}
    </CardHeader>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) { return <div className="px-5 py-8 text-center text-sm text-ink-tertiary">{children}</div>; }

export function ControlTowerView({ data }: { data: ControlTowerData }) {
  const production = data.plan.finishedGoods.filter((row) => row.suggestedProduction > 0);
  const roast = data.plan.materials.filter((row) => row.kind === "ROASTED_BEAN" && row.shortage > 0);
  const green = data.plan.materials.filter((row) => row.kind === "GREEN_BEAN" && row.shortage > 0);
  const supplies = data.plan.supplies.filter((row) => row.shortage > 0);
  const readyChecks = data.readiness.filter((row) => row.ready).length;

  return (
    <section aria-label="Control Tower" className="overflow-hidden rounded-card border border-border bg-card">
      <PageHeader
        title="Control Tower"
        eyebrow="Hari Ini"
        description="Pesanan → posisi stok → kebutuhan produksi → roasting → pembelian. Rekomendasi bersifat read-only dan tetap memerlukan keputusan manusia."
      />
      <div className="space-y-5 p-4 md:p-6">
        <section aria-label="Ringkasan rekomendasi" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Produksi disarankan" value={`${number.format(data.plan.summary.productionUnits)} unit`} sub={`${data.plan.summary.productionSkuCount} SKU dengan resep siap dieksekusi.`} icon={Factory} />
          <Stat label="Output roast dibutuhkan" value={`${number.format(data.plan.summary.roastOutputKg)} kg`} sub={`${data.plan.summary.roastSkuCount} roasted bean perlu ditutup.`} icon={Flame} />
          <Stat label="SKU perlu dibeli" value={number.format(data.plan.summary.purchaseSkuCount)} sub="Green bean, roasted bean beli-jadi, atau supply setelah PO aktif diperhitungkan." icon={Boxes} />
          <Stat label="Kesiapan konfigurasi" value={`${readyChecks}/${data.readiness.length}`} sub="Pemeriksaan master data, gudang, checkout, dan storefront." icon={ShieldCheck} />
        </section>

        <div className="rounded-card border border-copper/20 bg-copper-soft px-5 py-4 text-sm leading-6 text-copper-strong">
          <strong>Rumus keputusan:</strong> posisi persediaan = stok fisik + sisa PO − stok terikat. Kebutuhan terkonfirmasi tidak dihitung dua kali dengan forecast; safety stock dan lead time tetap dipertahankan.
        </div>

        <Card>
          <SectionHeading icon={Factory} eyebrow="Batch 9 · Demand" title="Rencana produksi produk jadi" detail="Urutan berdasarkan kekurangan terbesar. Produk tanpa resep tetap terlihat sebagai blocker, bukan dihitung dengan asumsi." href="/produksi" action="Buka produksi" />
          {production.length === 0 ? <EmptyRow>Tidak ada produksi tambahan yang disarankan saat ini.</EmptyRow> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-surface-sunken text-[10px] uppercase tracking-[0.1em] text-ink-tertiary"><tr><th className="px-5 py-3">Produk</th><th className="px-3 py-3 text-right">Pesanan</th><th className="px-3 py-3 text-right">Terikat</th><th className="px-3 py-3 text-right">Stok + PO</th><th className="px-3 py-3 text-right">Safety</th><th className="px-3 py-3 text-right">Saran</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Tindakan</th></tr></thead><tbody className="divide-y divide-border">{production.map((row) => <tr key={row.productId} className="hover:bg-surface-sunken/60"><td className="px-5 py-3"><strong className="block text-sm text-ink">{row.name}</strong><span className="font-mono text-[10px] text-ink-tertiary">{row.code}</span></td><td className="px-3 py-3 text-right">{number.format(row.openDemand)}</td><td className="px-3 py-3 text-right">{number.format(row.committed)}</td><td className="px-3 py-3 text-right">{number.format(row.onHand + row.onOrder)}</td><td className="px-3 py-3 text-right">{number.format(row.safetyStock)}</td><td className="px-3 py-3 text-right text-base font-black text-copper">{number.format(row.suggestedProduction)}</td><td className="px-3 py-3">{row.hasRecipe ? <span className="rounded-full bg-[#E8F3E6] px-2.5 py-1 font-bold text-[#2f6b2a]">Resep siap</span> : <span className="rounded-full bg-[#FBE9E7] px-2.5 py-1 font-bold text-[#9c3a2f]">Resep belum ada</span>}</td><td className="px-5 py-3 text-right"><Link href={row.hasRecipe ? productionExecutionHref(row.productId, row.suggestedProduction) : "/katalog"} className="inline-flex min-h-9 items-center rounded-lg bg-[#0B141B] px-3 font-bold text-white transition hover:bg-[#1c2a33]">{row.hasRecipe ? "Mulai produksi" : "Lengkapi resep"}</Link></td></tr>)}</tbody></table></div>}
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <SectionHeading icon={Flame} eyebrow="Batch 11 · Roast" title="Kebutuhan roasting" detail="Kebutuhan RB diturunkan dari resep produk jadi dan dikonversi ke input GB memakai yield historis." href="/roasting" action="Buka roasting" />
            {roast.length === 0 ? <EmptyRow>Tidak ada tambahan roasting yang disarankan.</EmptyRow> : <ul className="divide-y divide-border">{roast.map((row) => <li key={row.productId} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4"><div><strong className="text-sm text-ink">{row.name}</strong><p className="mt-1 text-xs text-ink-secondary">Butuh output {number.format(row.shortage)} kg · yield {number.format((row.yieldRate ?? 0) * 100)}%</p><Link href={roastingExecutionHref(row.productId, row.suggestedRoastInputKg)} className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-[#0B141B] px-3 text-[11px] font-bold text-white transition hover:bg-[#1c2a33]">Siapkan roasting</Link></div><div className="text-right"><p className="text-lg font-black text-copper">{number.format(row.suggestedRoastInputKg)} kg</p><p className="text-[10px] uppercase tracking-wide text-ink-tertiary">input GB</p></div></li>)}</ul>}
          </Card>
          <Card>
            <SectionHeading icon={Boxes} eyebrow="Batch 9 · Material" title="Kebutuhan pembelian" detail="Sisa PO dan penerimaan parsial dikurangkan sebelum rekomendasi dibuat." href="/inventory?view=po" action="Buka PO" />
            {green.length + supplies.length === 0 ? <EmptyRow>Tidak ada pembelian tambahan yang disarankan.</EmptyRow> : <ul className="divide-y divide-border">{green.map((row) => <li key={row.productId} className="flex items-center justify-between gap-4 px-5 py-3"><div><strong className="text-sm text-ink">{row.name}</strong><p className="text-xs text-ink-secondary">Green bean · stok {number.format(row.onHand)} kg · PO {number.format(row.onOrder)} kg</p></div><strong className="text-sm text-[#6F4A6A]">{number.format(row.shortage)} kg</strong></li>)}{supplies.map((row) => <li key={row.supplyItemId} className="flex items-center justify-between gap-4 px-5 py-3"><div><strong className="text-sm text-ink">{row.name}</strong><p className="text-xs text-ink-secondary">Stok {number.format(row.onHand)} · PO {number.format(row.onOrder)} {row.baseUnit}</p></div><strong className="text-sm text-[#6F4A6A]">Beli {number.format(row.shortage)} {row.baseUnit}</strong></li>)}</ul>}
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <Card>
            <SectionHeading icon={PackageCheck} eyebrow="Order priority" title="Pesanan yang harus ditindaklanjuti" detail="Urutan jatuh tempo lalu waktu terbit; satu sumber dari Invoice dan fulfillment task." href="/penjualan/fulfillment" action="Buka fulfillment" />
            {data.orders.length === 0 ? <EmptyRow>Semua pesanan aktif sudah selesai ditindaklanjuti.</EmptyRow> : <ul className="divide-y divide-border">{data.orders.map((order) => <li key={order.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href="/penjualan" className="font-black text-ink hover:underline">{order.code}</Link><span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-bold uppercase text-ink-secondary">{order.status}</span>{order.shortageUnits > 0 ? <span className="rounded-full bg-[#FBE9E7] px-2 py-0.5 text-[10px] font-bold text-[#9c3a2f]">Kurang {order.shortageUnits} unit</span> : null}</div><p className="mt-1 truncate text-xs text-ink-secondary">{order.customer} · {order.channel.replaceAll("_", " ")}</p></div><div className="text-right"><strong className="text-sm text-ink">{currency.format(order.value)}</strong><p className="mt-1 text-[10px] text-ink-tertiary">{order.dueDate ? `Jatuh tempo ${new Date(order.dueDate).toLocaleDateString("id-ID")}` : `Masuk ${new Date(order.issuedAt).toLocaleDateString("id-ID")}`}</p></div></li>)}</ul>}
          </Card>
          <Card>
            <SectionHeading icon={ShieldCheck} eyebrow="Production readiness" title="Gate sebelum scale" detail={`${readyChecks} dari ${data.readiness.length} pemeriksaan konfigurasi lulus.`} />
            <ul className="divide-y divide-border">{data.readiness.map((check) => <li key={check.key} className="flex gap-3 px-5 py-3"><span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${check.ready ? "bg-[#E8F3E6] text-[#2f6b2a]" : "bg-[#F6EBCF] text-[#9c7a1f]"}`}>{check.ready ? <BadgeCheck size={14} /> : <AlertTriangle size={13} />}</span><div className="min-w-0 flex-1"><Link href={check.href} className="text-xs font-bold text-ink hover:underline">{check.label}</Link><p className="mt-0.5 text-[11px] leading-4 text-ink-secondary">{check.detail}</p></div></li>)}</ul>
          </Card>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <SectionHeading icon={Warehouse} eyebrow="Batch 10" title="Warehouse & FEFO" detail="Eksekusi lokasi dan risiko kedaluwarsa." href="/gudang" action="Gudang" />
            <div className="grid grid-cols-3 gap-2 p-4 text-center"><div><strong className="text-xl text-ink">{data.warehouse.expiringLots.length}</strong><p className="text-[10px] text-ink-tertiary">lot ≤30 hari</p></div><div><strong className="text-xl text-ink">{data.warehouse.unplacedLotCount}</strong><p className="text-[10px] text-ink-tertiary">belum ditempatkan</p></div><div><strong className="text-xl text-[#9c3a2f]">{data.warehouse.latePoCount}</strong><p className="text-[10px] text-ink-tertiary">PO terlambat</p></div></div>
            {data.warehouse.expiringLots.length ? <ul className="border-t border-border">{data.warehouse.expiringLots.slice(0, 3).map((lot) => <li key={lot.id} className="px-4 py-2.5 text-xs"><strong className="text-ink">{lot.item}</strong><p className="mt-0.5 text-ink-secondary">{lot.batchCode} · {new Date(lot.expiryDate).toLocaleDateString("id-ID")} · {number.format(lot.remaining)} {lot.unit}</p></li>)}</ul> : null}
          </Card>
          <Card>
            <SectionHeading icon={Radar} eyebrow="Batch 11" title="Quality intelligence" detail="QC tetap opsional, tetapi gap terlihat." href="/cupping" action="Cupping" />
            <div className="space-y-3 p-4 text-xs"><p className="flex justify-between"><span className="text-ink-tertiary">Roast aktif</span><strong className="text-ink">{data.quality.openRoastCount}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Tanpa cupping 30 hari</span><strong className="text-ink">{data.quality.completedWithoutCupping}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Yield rata-rata</span><strong className="text-ink">{data.quality.averageYieldPercent === null ? "Belum ada data" : `${number.format(data.quality.averageYieldPercent)}%`}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Artisan sync</span><strong className={data.quality.artisanEnabled ? "text-[#2f6b2a]" : "text-ink-tertiary"}>{data.quality.artisanEnabled ? "Aktif" : "Opsional / nonaktif"}</strong></p></div>
          </Card>
          <Card>
            <SectionHeading icon={FileSignature} eyebrow="Batch 12" title="B2B command" detail="Kontrak, omzet, dan risiko piutang." href="/penjualan/kontrak" action="Kontrak" />
            <div className="space-y-3 p-4 text-xs"><p className="flex justify-between"><span className="text-ink-tertiary">Kontrak aktif</span><strong className="text-ink">{data.b2b.activeContracts}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Berakhir ≤30 hari</span><strong className="text-ink">{data.b2b.expiringContracts}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Omzet B2B 30 hari</span><strong className="text-ink">{currency.format(data.b2b.sales30Days)}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Piutang terlambat</span><strong className="text-[#9c3a2f]">{data.b2b.overdueReceivables} · {currency.format(data.b2b.overdueValue)}</strong></p></div>
          </Card>
          <Card>
            <SectionHeading icon={TrendingUp} eyebrow="Batch 13" title="Profit intelligence" detail="Revenue dan HPP snapshot dari barang terkirim." href="/laporan/analisa/laba-rugi" action="Laporan" />
            <div className="space-y-3 p-4 text-xs"><p className="flex justify-between"><span className="text-ink-tertiary">Revenue 30 hari</span><strong className="text-ink">{currency.format(data.finance.revenue30Days)}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Laba kotor</span><strong className="text-ink">{currency.format(data.finance.grossProfit30Days)}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">Margin kotor</span><strong className="text-ink">{data.finance.grossMarginPercent === null ? "Belum ada data" : `${number.format(data.finance.grossMarginPercent)}%`}</strong></p><p className="flex justify-between"><span className="text-ink-tertiary">SKU rugi</span><strong className={data.finance.lossMakingSkus.length ? "text-[#9c3a2f]" : "text-[#2f6b2a]"}>{data.finance.lossMakingSkus.length}</strong></p></div>
          </Card>
        </div>
        <p className="pb-2 text-center text-[10px] text-ink-tertiary">Dihitung {new Date(data.generatedAt).toLocaleString("id-ID")} · Semua rekomendasi dapat ditelusuri kembali ke transaksi canonical.</p>
      </div>
    </section>
  );
}
