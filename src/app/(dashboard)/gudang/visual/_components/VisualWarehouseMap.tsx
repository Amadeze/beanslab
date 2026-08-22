"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Search,
  Warehouse,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { VisualLocation, VisualWarehouse } from "../actions";
import { LocationDetailDrawer } from "./LocationDetailDrawer";

type LocationFilter = "all" | "attention" | "occupied" | "empty" | "capacity-unset";
type ViewMode = "map" | "list";

const FILTER_OPTIONS: Array<{ value: LocationFilter; label: string }> = [
  { value: "all", label: "Semua status" },
  { value: "attention", label: "Perlu perhatian" },
  { value: "occupied", label: "Terisi" },
  { value: "empty", label: "Kosong" },
  { value: "capacity-unset", label: "Kapasitas belum diatur" },
];

function getMeasurement(loc: VisualLocation) {
  const values = [
    { value: loc.totalKg, unit: "kg" },
    { value: loc.totalUnit, unit: "unit" },
    { value: loc.totalSupply, unit: "pcs" },
  ].filter((item) => item.value > 0);

  if (values.length === 0) return { value: 0, unit: "", mixed: false };
  if (values.length > 1) {
    return {
      value: values.reduce((total, item) => total + item.value, 0),
      unit: "campuran",
      mixed: true,
    };
  }
  return { ...values[0], mixed: false };
}

function getOccupancy(loc: VisualLocation) {
  const measurement = getMeasurement(loc);
  if (!loc.capacity || measurement.mixed) return null;
  return Math.max(0, (measurement.value / loc.capacity) * 100);
}

function getLocationState(loc: VisualLocation) {
  const occupancy = getOccupancy(loc);
  if (!loc.isActive) {
    return { id: "inactive", label: "Nonaktif", icon: Archive, className: "border-stone-300 bg-stone-100 text-stone-700", bar: "bg-stone-400" } as const;
  }
  if (loc.hasExpiryWarning) {
    return { id: "attention", label: "Periksa FEFO", icon: AlertTriangle, className: "border-rose-300 bg-rose-50 text-rose-800", bar: "bg-rose-600" } as const;
  }
  if (occupancy !== null && occupancy > 100) {
    return { id: "attention", label: "Melebihi kapasitas", icon: AlertTriangle, className: "border-rose-300 bg-rose-50 text-rose-800", bar: "bg-rose-600" } as const;
  }
  if (occupancy !== null && occupancy >= 80) {
    return { id: "attention", label: "Hampir penuh", icon: AlertTriangle, className: "border-amber-300 bg-amber-50 text-amber-900", bar: "bg-amber-600" } as const;
  }
  if (loc.lotCount > 0) {
    return { id: "occupied", label: "Terisi", icon: Package, className: "border-emerald-300 bg-emerald-50 text-emerald-900", bar: "bg-emerald-600" } as const;
  }
  return { id: "empty", label: "Kosong", icon: MapPin, className: "border-slate-300 bg-slate-50 text-slate-700", bar: "bg-slate-400" } as const;
}

function formatQuantity(loc: VisualLocation) {
  const measurement = getMeasurement(loc);
  if (measurement.value === 0) return "Belum ada stok";
  if (measurement.mixed) return `${loc.lotCount} lot · satuan campuran`;
  return `${measurement.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${measurement.unit}`;
}

function LocationCard({ loc, onSelect }: { loc: VisualLocation; onSelect: () => void }) {
  const state = getLocationState(loc);
  const occupancy = getOccupancy(loc);
  const StateIcon = state.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${loc.code}, ${loc.name}, ${state.label}, ${formatQuantity(loc)}`}
      className="group flex min-h-[148px] w-full flex-col rounded-[12px] border border-[#CDC8BC] bg-[#FFFDF8] p-4 text-left shadow-[0_1px_0_rgba(5,9,13,.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#2B7567]/60 hover:shadow-[0_12px_28px_-20px_rgba(5,9,13,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15B8C6] focus-visible:ring-offset-2"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-[#2B7567]">{loc.code}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[#141817]">{loc.name}</p>
        </div>
        <span className={cn("inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold", state.className)}>
          <StateIcon size={13} aria-hidden />
          {state.label}
        </span>
      </div>

      <div className="mt-auto w-full pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#59605B]">{formatQuantity(loc)}</p>
            <p className="mt-1 text-xs text-[#777D78]">{loc.lotCount} lot tersimpan</p>
          </div>
          <span className="font-mono text-xs font-bold tabular-nums text-[#141817]">
            {occupancy === null ? "—" : `${Math.round(occupancy)}%`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E4E1D7]" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", state.bar)}
            style={{ width: `${Math.min(100, occupancy ?? (loc.lotCount > 0 ? 18 : 0))}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-[#777D78]">
          {loc.capacity
            ? `Kapasitas ${loc.capacity.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`
            : "Kapasitas belum diatur"}
        </p>
      </div>
    </button>
  );
}

function SummaryCard({ label, value, detail, icon: Icon, tone = "inventory" }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Warehouse;
  tone?: "inventory" | "warning";
}) {
  return (
    <div className="rounded-[12px] border border-[#CDC8BC] bg-[#FFFDF8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#777D78]">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#141817]">{value}</p>
          <p className="mt-1 text-xs text-[#59605B]">{detail}</p>
        </div>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-[10px]", tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-[#D2E8DF] text-[#2B7567]")}>
          <Icon size={18} aria-hidden />
        </span>
      </div>
    </div>
  );
}

export function VisualWarehouseMap({ warehouses }: { warehouses: VisualWarehouse[] }) {
  const [selectedLoc, setSelectedLoc] = useState<VisualLocation | null>(null);
  const [warehouseId, setWarehouseId] = useState("all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LocationFilter>("all");
  const [view, setView] = useState<ViewMode>("map");

  const allLocations = useMemo(
    () => warehouses.flatMap((warehouse) => Object.values(warehouse.rackGroups).flat()),
    [warehouses],
  );

  const stats = useMemo(() => ({
    attention: allLocations.filter((loc) => getLocationState(loc).id === "attention").length,
    occupied: allLocations.filter((loc) => loc.lotCount > 0).length,
    configured: allLocations.filter((loc) => loc.capacity !== null).length,
  }), [allLocations]);

  const visibleWarehouses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return warehouses
      .filter((warehouse) => warehouseId === "all" || warehouse.id === warehouseId)
      .map((warehouse) => {
        const rackGroups = Object.fromEntries(
          Object.entries(warehouse.rackGroups)
            .map(([group, locations]) => [group, locations.filter((loc) => {
              const state = getLocationState(loc);
              const matchesFilter = filter === "all" || (filter === "capacity-unset" ? loc.capacity === null : state.id === filter);
              const haystack = [loc.code, loc.name, loc.zone, ...loc.placements.flatMap((placement) => [placement.label, placement.batchCode, placement.supplierName])]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("id-ID");
              return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
            })])
            .filter(([, locations]) => (locations as VisualLocation[]).length > 0),
        ) as Record<string, VisualLocation[]>;
        return { ...warehouse, rackGroups };
      })
      .filter((warehouse) => Object.keys(warehouse.rackGroups).length > 0);
  }, [filter, query, warehouseId, warehouses]);

  if (warehouses.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-[#BFB9AB] bg-[#FFFDF8] p-10 text-center sm:p-14">
        <Warehouse className="mx-auto h-12 w-12 text-[#2B7567]" aria-hidden />
        <h2 className="mt-4 text-lg font-bold text-[#141817]">Belum ada gudang aktif</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#59605B]">Buat gudang dan lokasi penyimpanan terlebih dahulu. Peta akan tersusun otomatis berdasarkan zona dan kode lokasi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-label="Ringkasan gudang" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Gudang aktif" value={warehouses.length} detail="Siap digunakan" icon={Warehouse} />
        <SummaryCard label="Lokasi terisi" value={`${stats.occupied}/${allLocations.length}`} detail="Lokasi dengan stok" icon={Boxes} />
        <SummaryCard label="Perlu perhatian" value={stats.attention} detail="FEFO atau kapasitas" icon={AlertTriangle} tone="warning" />
        <SummaryCard label="Kapasitas diatur" value={`${stats.configured}/${allLocations.length}`} detail="Lokasi terukur" icon={CheckCircle2} />
      </section>

      <section aria-label="Filter peta gudang" className="rounded-[14px] border border-[#CDC8BC] bg-[#FFFDF8] p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
          <label className="relative block">
            <span className="sr-only">Cari lokasi, lot, atau produk</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777D78]" size={17} aria-hidden />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari lokasi, lot, atau produk…" className="h-11 w-full rounded-[10px] border border-[#BFB9AB] bg-white pl-10 pr-3 text-sm text-[#141817] outline-none placeholder:text-[#777D78] focus:border-[#2B7567] focus:ring-2 focus:ring-[#2B7567]/20" />
          </label>
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} aria-label="Pilih gudang" className="h-11 rounded-[10px] border border-[#BFB9AB] bg-white px-3 text-sm font-medium text-[#141817] outline-none focus:border-[#2B7567] focus:ring-2 focus:ring-[#2B7567]/20">
            <option value="all">Semua gudang</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
          <select value={filter} onChange={(event) => setFilter(event.target.value as LocationFilter)} aria-label="Filter status lokasi" className="h-11 rounded-[10px] border border-[#BFB9AB] bg-white px-3 text-sm font-medium text-[#141817] outline-none focus:border-[#2B7567] focus:ring-2 focus:ring-[#2B7567]/20">
            {FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="grid h-11 grid-cols-2 rounded-[10px] border border-[#BFB9AB] bg-[#F4F2EA] p-1" aria-label="Pilih tampilan">
            <button type="button" onClick={() => setView("map")} aria-pressed={view === "map"} className={cn("inline-flex items-center justify-center gap-1.5 rounded-[7px] px-3 text-sm font-semibold transition", view === "map" ? "bg-[#2B7567] text-white" : "text-[#59605B] hover:bg-white")}><LayoutGrid size={15} aria-hidden /> Peta</button>
            <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={cn("inline-flex items-center justify-center gap-1.5 rounded-[7px] px-3 text-sm font-semibold transition", view === "list" ? "bg-[#2B7567] text-white" : "text-[#59605B] hover:bg-white")}><List size={15} aria-hidden /> Daftar</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E4E1D7] pt-3 text-xs text-[#59605B]" aria-label="Legenda status lokasi">
          <span className="font-semibold text-[#141817]">Legenda:</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Terisi</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-600" />Hampir penuh</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" />Perlu perhatian</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Kosong</span>
        </div>
      </section>

      {visibleWarehouses.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#BFB9AB] bg-[#FFFDF8] p-10 text-center">
          <Search className="mx-auto h-10 w-10 text-[#777D78]" aria-hidden />
          <h2 className="mt-3 text-base font-bold text-[#141817]">Tidak ada lokasi yang cocok</h2>
          <p className="mt-1 text-sm text-[#59605B]">Ubah kata pencarian atau pilih status lain.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleWarehouses.map((warehouse) => (
            <section key={warehouse.id} aria-labelledby={`warehouse-${warehouse.id}`} className="overflow-hidden rounded-[16px] border border-[#CDC8BC] bg-[#F4F2EA]">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CDC8BC] bg-[#FFFDF8] px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#D2E8DF] text-[#2B7567]"><Warehouse size={18} aria-hidden /></span>
                  <div className="min-w-0">
                    <h2 id={`warehouse-${warehouse.id}`} className="truncate text-base font-bold text-[#141817]">{warehouse.name}</h2>
                    <p className="mt-0.5 text-xs text-[#59605B]">{warehouse.code}{warehouse.address ? ` · ${warehouse.address}` : ""}</p>
                  </div>
                </div>
                <span className="rounded-full border border-[#B8D8CC] bg-[#EAF4F0] px-3 py-1 text-xs font-semibold text-[#225F54]">{Object.values(warehouse.rackGroups).flat().length} lokasi ditampilkan</span>
              </header>
              <div className="space-y-5 p-4 sm:p-5">
                {Object.entries(warehouse.rackGroups).map(([rackGroup, locations]) => (
                  <section key={rackGroup} aria-label={`Zona ${rackGroup === "DEFAULT" ? "Umum" : rackGroup}`} className="rounded-[12px] border border-[#D8D3C8] bg-[#ECEAE2] p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2"><span className="h-5 w-1 rounded-full bg-[#2B7567]" aria-hidden /><h3 className="text-sm font-bold text-[#141817]">Zona {rackGroup === "DEFAULT" ? "Umum" : rackGroup}</h3></div>
                      <span className="text-xs text-[#59605B]">{locations.length} lokasi</span>
                    </div>
                    <div className={cn(view === "map" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "grid gap-3 lg:grid-cols-2")}>
                      {locations.map((loc) => <LocationCard key={loc.id} loc={loc} onSelect={() => setSelectedLoc(loc)} />)}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedLoc ? <LocationDetailDrawer loc={selectedLoc} onClose={() => setSelectedLoc(null)} /> : null}
    </div>
  );
}
