"use client";

import { useState } from "react";
import { X, Package, MapPin, Calendar, Archive, Weight, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import Link from "next/link";

import { type VisualLocation } from "../actions";
import { transferLot, type TransferActionResult } from "@/lib/lot-transfer";
import { createLocationOpname } from "@/lib/lot-opname";

const BTN_GHOST =
  "rounded-xl border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition disabled:opacity-50 disabled:pointer-events-none";
const BTN_PRIMARY =
  "rounded-xl bg-[var(--amber-warm)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50";

const SYSTEM_PURPOSE_LABELS: Record<string, string> = {
  ROASTING_WIP: "Roasting WIP",
};

export function LocationDetailDrawer({
  loc,
  onClose,
}: {
  loc: VisualLocation;
  onClose: () => void;
}) {
  const [isTransferring, setIsTransferring] = useState(false);
  const [isOpname, setIsOpname] = useState(false);

  async function handleTransfer() {
    setIsTransferring(true);
    try {
      if (loc.placements.length === 0) {
        toastSafe.error("Tidak ada stok untuk dipindahkan.");
        return;
      }
      const firstLot = loc.placements[0];
      if (!firstLot) return;

      toastSafe.info(
        `Buka halaman lot untuk transfer. Lot: ${firstLot.batchCode}`,
        {
          action: {
            label: "Buka",
            onClick: () => {
              window.location.href = `/inventory/lots/${firstLot.lotId}`;
            },
          },
        },
      );
    } catch (err: any) {
      toastSafe.error(err.message || "Gagal membuka transfer.");
    } finally {
      setIsTransferring(false);
    }
  }

  async function handleOpname() {
    if (loc.placements.length === 0) {
      toastSafe.error("Tidak ada stok untuk di-opname.");
      return;
    }
    const firstLot = loc.placements[0];
    if (!firstLot) return;

    try {
      setIsOpname(true);
      const res = await createLocationOpname({
        lotId: firstLot.lotId,
        locationId: loc.id,
        countedQuantityKg: firstLot.quantityKg > 0 ? firstLot.quantityKg : undefined,
        countedQuantityUnit: firstLot.quantityUnit > 0 ? firstLot.quantityUnit : undefined,
        countedSupplyQty: firstLot.supplyQty > 0 ? firstLot.supplyQty : undefined,
        notes: "Draft dari visual map pindahan opname",
      });
      if (res.success) {
        toast.success("Draft opname berhasil dibuat. Buka halaman Opname untuk konfirmasi.");
      } else {
        toastSafe.error(res.error || "Gagal membuat draft opname.");
      }
    } catch (err: any) {
      toastSafe.error(err.message || "Gagal membuat draft opname.");
    } finally {
      setIsOpname(false);
    }
  }

  const qtyDisplay = (p: VisualLocation["placements"][number]) => {
    if (p.quantityKg > 0) return `${p.quantityKg.toLocaleString("id-ID")} kg`;
    if (p.quantityUnit > 0) return `${p.quantityUnit} unit`;
    if (p.supplyQty > 0) return `${p.supplyQty.toLocaleString("id-ID")} pcs`;
    return "0";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="glass-card w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--amber-warm)]/10">
              <MapPin className="h-5 w-5 text-[var(--amber-warm)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[var(--text-primary)]">{loc.name}</h3>
                {loc.isSystem && (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-sky-500">
                    Sistem{loc.systemPurpose ? ` · ${SYSTEM_PURPOSE_LABELS[loc.systemPurpose] ?? loc.systemPurpose}` : ""}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-tertiary)]">
                Kode: {loc.code} · {!loc.isActive && "Non-aktif"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[var(--text-tertiary)]">Warehouse</dt>
            <dd className="font-semibold text-[var(--text-primary)]">
              {loc.rackGroup}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-tertiary)]">Status</dt>
            <dd className="font-semibold">
              {loc.lotCount > 0 ? (
                <span className="text-emerald-600">{loc.lotCount} lot</span>
              ) : (
                <span className="text-slate-500">Kosong</span>
              )}
            </dd>
          </div>
          {loc.hasExpiryWarning && (
            <div className="col-span-2 rounded-lg bg-rose-50/30 p-3">
              <span className="flex items-center gap-1 text-xs text-rose-700">
                <Calendar size={14} />
                Peringatan: ada lot dengan expiry &lt; 30 hari
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <h4 className="text-sm font-semibold uppercase text-[var(--text-tertiary)]">
            Konten ({loc.placements.length})
          </h4>
          {loc.placements.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Lokasi kosong.</p>
          ) : (
            <div className="space-y-2">
              {loc.placements.map((p) => (
                <div
                  key={p.lotId}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/2 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Package size={14} className="text-[var(--amber-warm)]" />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{p.label}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {p.batchCode} · {p.supplierName ?? "-"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm">
                    {qtyDisplay(p)}
                    {p.expiryDate && (
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {new Date(p.expiryDate).toLocaleDateString("id-ID")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/inventory/lots/${loc.placements[0]?.lotId ?? ""}`} className={BTN_GHOST}>
            <Package size={14} className="mr-1" /> Lihat Lot
          </Link>
          <button
            onClick={handleTransfer}
            disabled={isTransferring || loc.placements.length === 0 || loc.isSystem}
            title={loc.isSystem ? "Lokasi sistem dikelola otomatis" : undefined}
            className={BTN_GHOST}
          >
            <Archive size={14} className="mr-1" /> Pindahkan Stok
          </button>
          <button
            onClick={handleOpname}
            disabled={isOpname || loc.placements.length === 0 || loc.isSystem}
            title={loc.isSystem ? "Lokasi sistem dikelola otomatis" : undefined}
            className={BTN_GHOST}
          >
            <Weight size={14} className="mr-1" /> {isOpname ? "Membuat..." : "Stock Opname"}
          </button>
          <a
            href={`/gudang/scan?code=${loc.code}`}
            target="_blank"
            rel="noopener noreferrer"
            className={BTN_GHOST}
          >
            <MapPin size={14} className="mr-1" /> Cetak QR
          </a>
        </div>
      </div>
    </div>
  );
}
