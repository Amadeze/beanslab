import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Factory,
  MapPin,
  PackageCheck,
  ReceiptText,
  Scale,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatKg, formatRupiah, formatUnit } from "@/lib/format";
import type { ProductionBatchRecapData } from "../../../actions";

const panel = "rounded-2xl border border-white/60 bg-white/35 shadow-sm backdrop-blur-xl";

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-slate-900">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export function ProductionBatchRecap({ data }: { data: ProductionBatchRecapData }) {
  const placedUnits = data.outputLot?.placements.reduce(
    (sum, placement) => sum + placement.quantityUnit,
    0,
  ) ?? 0;

  return (
    <div className="space-y-5">
      <section className={`${panel} overflow-hidden`}>
        <div className="border-b border-white/60 bg-slate-950 px-4 py-3 text-white md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Paspor konversi</p>
              <p className="mt-1 text-sm font-semibold">Apa yang masuk, menjadi apa, dan tersimpan di mana</p>
            </div>
            <StatusBadge status={data.status} />
          </div>
        </div>

        <div className="grid items-stretch md:grid-cols-[1fr_auto_0.78fr_auto_1fr]">
          <div className="p-4 md:p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <Scale size={15} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Bahan masuk</span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{formatKg(data.totalRbUsedKg)}</p>
            <div className="mt-3 space-y-2">
              {data.components.map((component) => (
                <div key={component.productId} className="flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{component.productName}</p>
                    <p className="font-mono text-[10px] text-slate-400">{component.productCode}</p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-slate-700">{formatKg(component.quantityKg)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden items-center text-slate-300 md:flex"><ArrowRight size={20} /></div>

          <div className="border-y border-white/60 bg-white/45 p-4 md:border-x md:border-y-0 md:p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <Factory size={15} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Batch</span>
            </div>
            <p className="mt-2 font-mono text-sm font-black text-slate-900">{data.code}</p>
            <p className="mt-1 text-xs text-slate-500">{data.recipe?.name ?? "Produksi tanpa resep"}</p>
            <p className="mt-3 text-xs font-semibold text-slate-700">{data.packaging.name}</p>
            <p className="text-[11px] text-slate-500">{formatUnit(data.packaging.quantity)} kemasan</p>
          </div>

          <div className="hidden items-center text-slate-300 md:flex"><ArrowRight size={20} /></div>

          <div className="p-4 md:p-5">
            <div className="flex items-center gap-2 text-emerald-700">
              <PackageCheck size={15} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Hasil keluar</span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-emerald-700">{formatUnit(data.unitsProduced)}</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{data.outputProduct.name}</p>
            <p className="font-mono text-[10px] text-slate-400">{data.outputProduct.code}</p>
            {data.outputLot && (
              <Link
                href={`/inventory/lots/${data.outputLot.id}`}
                className="mt-3 inline-flex text-xs font-bold text-emerald-700 hover:underline"
              >
                Lot {data.outputLot.batchCode} →
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Unit diproduksi" value={formatUnit(data.unitsProduced)} detail={data.outputProduct.name} />
        <Metric label="HPP per unit" value={formatRupiah(data.hppPerUnit)} />
        <Metric label="Total biaya" value={formatRupiah(data.costs.total)} />
        <Metric label="Stok di lokasi" value={formatUnit(placedUnits)} detail="Posisi lot saat ini" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className={`${panel} p-4 md:p-5`}>
          <div className="flex items-center gap-2">
            <ReceiptText size={16} className="text-slate-500" />
            <h2 className="text-sm font-black text-slate-900">Rincian biaya historis</h2>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ["Kopi + kemasan", data.costs.materialsAndPackaging],
              ["Supply tambahan dalam HPP", data.costs.includedSupplies],
              ["Tenaga kerja", data.costs.labor],
              ["Overhead", data.costs.overhead],
            ].map(([label, amount]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 border-b border-white/60 py-2 last:border-0">
                <span className="text-slate-600">{label}</span>
                <span className="font-bold tabular-nums text-slate-900">{formatRupiah(Number(amount))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-950 px-3 py-2.5 text-white">
              <span className="text-xs font-bold uppercase tracking-wider">Total</span>
              <span className="font-black tabular-nums">{formatRupiah(data.costs.total)}</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-500">
            Biaya kopi dan kemasan ditampilkan gabungan karena batch menyimpan total historisnya, bukan snapshot kemasan terpisah.
          </p>

          {data.supplies.length > 0 && (
            <div className="mt-5 border-t border-white/60 pt-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Supply tambahan</h3>
              <div className="mt-2 space-y-2">
                {data.supplies.map((supply) => (
                  <div key={supply.supplyItemId} className="rounded-xl border border-white/60 bg-white/45 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-800">{supply.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{supply.code}</p>
                      </div>
                      <span className="font-bold tabular-nums text-slate-800">{formatRupiah(supply.totalCostSnapshot)}</span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      {supply.quantity} {supply.baseUnit} × {formatRupiah(supply.unitCostSnapshot)}
                      {!supply.includedInHpp && " · tidak masuk HPP"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={`${panel} p-4 md:p-5`}>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-slate-500" />
            <h2 className="text-sm font-black text-slate-900">Lot dan lokasi saat ini</h2>
          </div>
          {data.outputLot ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/45 p-3">
                <div>
                  <Link href={`/inventory/lots/${data.outputLot.id}`} className="font-mono text-xs font-black text-slate-900 hover:underline">
                    {data.outputLot.batchCode}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-slate-500">Dibuat {formatUnit(data.outputLot.quantityUnit)} unit</p>
                </div>
                <span className="text-xs font-bold text-slate-700">Tersisa {formatUnit(placedUnits)}</span>
              </div>
              <div className="mt-3 space-y-2">
                {data.outputLot.placements.length > 0 ? data.outputLot.placements.map((placement) => (
                  <div key={`${placement.locationCode}-${placement.locationName}`} className="flex items-center gap-3 rounded-xl border border-white/60 px-3 py-2.5">
                    <MapPin size={14} className="shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">{placement.warehouseName} · {placement.locationName}</p>
                      <p className="font-mono text-[10px] text-slate-400">{placement.locationCode}</p>
                    </div>
                    <span className="shrink-0 text-xs font-black tabular-nums text-slate-800">{formatUnit(placement.quantityUnit)}</span>
                  </div>
                )) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {data.outputLot.consumedAt ? "Stok lot ini sudah habis atau terpakai." : "Lot ini belum ditempatkan."}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">Lot hasil tidak ditemukan.</p>
          )}

          <div className="mt-5 border-t border-white/60 pt-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Informasi batch</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div><dt className="text-slate-400">Tanggal</dt><dd className="mt-0.5 font-semibold text-slate-800">{formatDate(data.producedAt)}</dd></div>
              <div><dt className="text-slate-400">Dicatat oleh</dt><dd className="mt-0.5 font-semibold text-slate-800">{data.createdBy.name}</dd></div>
              <div><dt className="text-slate-400">Resep</dt><dd className="mt-0.5 font-semibold text-slate-800">{data.recipe?.name ?? "Tanpa resep"}</dd></div>
              <div><dt className="text-slate-400">Kemasan</dt><dd className="mt-0.5 font-semibold text-slate-800">{data.packaging.name}</dd></div>
            </dl>
            {data.parentRoastBatch && (
              <Link
                href={`/roasting/batch/${data.parentRoastBatch.id}`}
                className="mt-4 inline-flex text-xs font-bold text-amber-800 hover:underline"
              >
                Sumber roasting {data.parentRoastBatch.code} →
              </Link>
            )}
            {data.notes && <p className="mt-3 rounded-xl bg-white/45 p-3 text-xs leading-5 text-slate-600">{data.notes}</p>}
            {data.status === "VOID" && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                Void {data.voidAt ? formatDate(data.voidAt) : ""}: {data.voidReason ?? "Tanpa alasan tercatat"}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className={`${panel} p-4 md:p-5`}>
        <div className="flex items-center gap-2">
          <Boxes size={16} className="text-slate-500" />
          <h2 className="text-sm font-black text-slate-900">Pemakaian hasil batch</h2>
        </div>
        {data.downstream.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Belum ada penjualan atau pemakaian aktif dari lot ini.</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {data.downstream.map((item) => {
              const content = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">{item.label} · {item.code}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{item.status ?? item.refType}</p>
                  </div>
                  <span className="shrink-0 text-xs font-black tabular-nums text-slate-800">{formatUnit(item.quantityUnit)}</span>
                </>
              );
              return item.href ? (
                <Link key={`${item.refType}-${item.refId}`} href={item.href} className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/45 p-3 transition hover:bg-white/70">
                  {content}
                </Link>
              ) : (
                <div key={`${item.refType}-${item.refId}`} className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/45 p-3">
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
