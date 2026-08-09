"use client";

import { useState } from "react";
import { MapPin, Package, AlertTriangle, Weight, Calendar, Warehouse, Building, Archive } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import Link from "next/link";

import {
  type VisualWarehouse,
  type VisualLocation,
} from "../actions";
import { LocationDetailDrawer } from "./LocationDetailDrawer";

const LOCATION_BLOCK =
  "relative flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-xs font-medium transition-all hover:scale-105";

function LocationStatusIcon({ loc }: { loc: VisualLocation }) {
  if (!loc.isActive) return <Archive size={12} className="text-slate-400" />;
  if (loc.hasExpiryWarning) return <AlertTriangle size={12} className="text-rose-500" />;
  if (loc.lotCount > 0) return <Package size={12} className="text-emerald-500" />;
  return <MapPin size={12} className="text-slate-400" />;
}

function LocationBlock({ loc, onClick }: { loc: VisualLocation; onClick: () => void }) {
  const statusColor = !loc.isActive
    ? "border-slate-300 bg-slate-100 text-slate-400"
    : loc.hasExpiryWarning
    ? "border-rose-200 bg-rose-50/30 text-rose-700"
    : loc.lotCount > 0
    ? "border-emerald-200 bg-emerald-50/30 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-500";

  const qtyStr =
    loc.totalKg > 0
      ? `${loc.totalKg.toFixed(1)}kg`
      : loc.totalUnit > 0
      ? `${loc.totalUnit}u`
      : loc.totalSupply > 0
      ? `${loc.totalSupply.toFixed(1)}p`
      : "Kosong";

  return (
    <button type="button" onClick={onClick} className={`${LOCATION_BLOCK} ${statusColor}`} title={loc.name}>
      <LocationStatusIcon loc={loc} />
      <span className="font-mono">{loc.code}</span>
      <span className="block max-w-full truncate">{qtyStr}</span>
      {loc.lotCount > 1 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs text-white">
          {loc.lotCount}
        </span>
      )}
    </button>
  );
}

export function VisualWarehouseMap({ warehouses }: { warehouses: VisualWarehouse[] }) {
  const [selectedLoc, setSelectedLoc] = useState<VisualLocation | null>(null);

  if (warehouses.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <Warehouse className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
        <p className="text-[var(--text-secondary)]">Belum ada gudang aktif. Buat gudang di menu Gudang &amp; Lokasi.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {warehouses.map((w) => (
          <div key={w.id} className="glass-card rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--amber-warm)]/10">
                <Warehouse className="h-5 w-5 text-[var(--amber-warm)]" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">
                  {w.name} <span className="text-xs text-[var(--text-tertiary)]">[{w.code}]</span>
                </h3>
                {w.address && <p className="text-xs text-[var(--text-tertiary)]">{w.address}</p>}
              </div>
            </div>

            {Object.keys(w.rackGroups).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Belum ada lokasi di gudang ini.</p>
            ) : (
              <div className="space-y-5">
                {Object.entries(w.rackGroups).map(([rackGroup, locs]) => (
                  <div key={rackGroup}>
                    <h4 className="mb-3 text-sm font-semibold uppercase text-[var(--text-tertiary)]">
                      {rackGroup === "DEFAULT" ? "Umum" : rackGroup}
                    </h4>
                    <div className="grid grid-cols-[repeat(auto-fill,_minmax(80px,_1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,_minmax(90px,_1fr))]">
                      {locs.map((loc) => (
                        <LocationBlock key={loc.id} loc={loc} onClick={() => setSelectedLoc(loc)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedLoc && (
        <LocationDetailDrawer
          loc={selectedLoc}
          onClose={() => setSelectedLoc(null)}
        />
      )}
    </>
  );
}
