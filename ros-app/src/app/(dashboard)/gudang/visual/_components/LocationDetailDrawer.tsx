"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  MapPin,
  Package,
  Scale,
  ScanLine,
  Warehouse,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { toastSafe } from "@/lib/toast";
import { createLocationOpname } from "@/lib/lot-opname";
import type { VisualLocation } from "../actions";

const SYSTEM_PURPOSE_LABELS: Record<string, string> = {
  ROASTING_WIP: "Roasting WIP",
};

function quantityLabel(placement: VisualLocation["placements"][number]) {
  if (placement.quantityKg > 0) return `${placement.quantityKg.toLocaleString("id-ID")} kg`;
  if (placement.quantityUnit > 0) return `${placement.quantityUnit.toLocaleString("id-ID")} unit`;
  if (placement.supplyQty > 0) return `${placement.supplyQty.toLocaleString("id-ID")} pcs`;
  return "0";
}

function locationMeasurement(loc: VisualLocation) {
  const measurements = [
    { value: loc.totalKg, unit: "kg" },
    { value: loc.totalUnit, unit: "unit" },
    { value: loc.totalSupply, unit: "pcs" },
  ].filter((item) => item.value > 0);
  if (measurements.length !== 1) return null;
  return measurements[0];
}

export function LocationDetailDrawer({ loc, onClose }: { loc: VisualLocation; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [opnameLotId, setOpnameLotId] = useState<string | null>(null);
  const measurement = locationMeasurement(loc);
  const occupancy = loc.capacity && measurement ? (measurement.value / loc.capacity) * 100 : null;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  async function handleOpname(placement: VisualLocation["placements"][number]) {
    try {
      setOpnameLotId(placement.lotId);
      const result = await createLocationOpname({
        lotId: placement.lotId,
        locationId: loc.id,
        countedQuantityKg: placement.quantityKg > 0 ? placement.quantityKg : undefined,
        countedQuantityUnit: placement.quantityUnit > 0 ? placement.quantityUnit : undefined,
        countedSupplyQty: placement.supplyQty > 0 ? placement.supplyQty : undefined,
        notes: `Draft opname dari Peta Gudang · ${loc.code}`,
      });
      if (result.success) {
        toast.success("Draft opname dibuat. Konfirmasi hasilnya di halaman Opname.");
      } else {
        toastSafe.error(result.error || "Draft opname tidak dapat dibuat.");
      }
    } catch (error) {
      toastSafe.error(error instanceof Error ? error.message : "Draft opname tidak dapat dibuat.");
    } finally {
      setOpnameLotId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Tutup detail lokasi" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-detail-title"
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-white/10 bg-[var(--surface)] shadow-[-24px_0_80px_rgba(5,9,13,.35)]"
      >
        <header className="shrink-0 border-b border-white/10 bg-[var(--obsidian)] px-4 py-4 text-white sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--stage-inventory)]/45 bg-[var(--stage-inventory)]/20 text-[var(--stage-inventory-soft)]">
                <MapPin size={19} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="location-detail-title" className="text-lg font-bold tracking-tight">{loc.name}</h2>
                  {loc.isSystem ? (
                    <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-xs font-semibold text-sky-200">
                      Sistem{loc.systemPurpose ? ` · ${SYSTEM_PURPOSE_LABELS[loc.systemPurpose] ?? loc.systemPurpose}` : ""}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-white/55">{loc.code} · Zona {loc.rackGroup}</p>
              </div>
            </div>
            <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-white/15 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--instrument)]" aria-label="Tutup detail lokasi">
              <X size={19} aria-hidden />
            </button>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <section aria-label="Ringkasan lokasi" className="grid grid-cols-2 gap-3">
            <div className="rounded-[12px] border border-[var(--technical-line)] bg-[var(--surface-raised)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-tertiary)]">Status</p>
              <p className="mt-2 text-base font-bold text-[var(--foreground)]">{loc.lotCount > 0 ? `${loc.lotCount} lot tersimpan` : "Lokasi kosong"}</p>
            </div>
            <div className="rounded-[12px] border border-[var(--technical-line)] bg-[var(--surface-raised)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-tertiary)]">Kapasitas</p>
              <p className="mt-2 text-base font-bold text-[var(--foreground)]">{loc.capacity ? loc.capacity.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "Belum diatur"}</p>
            </div>
            <div className="col-span-2 rounded-[12px] border border-[var(--technical-line)] bg-[var(--surface-raised)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-tertiary)]">Pemakaian lokasi</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {measurement ? `${measurement.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${measurement.unit}` : loc.lotCount > 0 ? "Satuan campuran" : "Belum ada stok"}
                  </p>
                </div>
                <span className="font-mono text-lg font-bold tabular-nums text-[var(--stage-inventory)]">{occupancy === null ? "—" : `${Math.round(occupancy)}%`}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--secondary)]" aria-hidden>
                <div className={`h-full rounded-full ${occupancy !== null && occupancy > 100 ? "bg-rose-600" : occupancy !== null && occupancy >= 80 ? "bg-amber-600" : "bg-[var(--stage-inventory)]"}`} style={{ width: `${Math.min(100, occupancy ?? 0)}%` }} />
              </div>
            </div>
          </section>

          {loc.hasExpiryWarning ? (
            <div className="mt-4 flex items-start gap-3 rounded-[12px] border border-rose-300 bg-rose-50 p-4 text-rose-900" role="status">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden />
              <div>
                <p className="text-sm font-bold">Ada lot yang perlu didahulukan</p>
                <p className="mt-1 text-xs leading-5">Setidaknya satu lot sudah kedaluwarsa atau akan kedaluwarsa dalam 30 hari.</p>
              </div>
            </div>
          ) : null}

          <section aria-labelledby="stored-lots-title" className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 id="stored-lots-title" className="text-sm font-bold text-[var(--foreground)]">Lot di lokasi ini</h3>
              <span className="rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-secondary)]">{loc.placements.length}</span>
            </div>

            {loc.placements.length === 0 ? (
              <div className="mt-3 rounded-[12px] border border-dashed border-[var(--input)] bg-[var(--surface-raised)] p-7 text-center">
                <Package className="mx-auto h-9 w-9 text-[var(--ink-tertiary)]" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">Lokasi masih kosong</p>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">Pindahkan lot melalui halaman detail lot atau gunakan pemindai lokasi.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {loc.placements.map((placement) => (
                  <article key={placement.lotId} className="rounded-[12px] border border-[var(--technical-line)] bg-[var(--surface-raised)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--foreground)]">{placement.label}</p>
                        <p className="mt-1 font-mono text-xs text-[var(--ink-secondary)]">{placement.batchCode}</p>
                        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">{placement.supplierName ?? "Supplier tidak dicatat"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-bold tabular-nums text-[var(--foreground)]">{quantityLabel(placement)}</p>
                        {placement.expiryDate ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--ink-secondary)]"><Calendar size={12} aria-hidden />{new Date(placement.expiryDate).toLocaleDateString("id-ID")}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--secondary)] pt-3">
                      <Link href={`/inventory/lots/${placement.lotId}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--input)] px-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--instrument)]"><Package size={14} aria-hidden />Lihat</Link>
                      <Link href={`/inventory/lots/${placement.lotId}?action=transfer&sourceLocationId=${loc.id}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--input)] px-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--instrument)]"><ArrowRightLeft size={14} aria-hidden />Pindahkan</Link>
                      <button type="button" disabled={loc.isSystem || opnameLotId === placement.lotId} onClick={() => handleOpname(placement)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--input)] px-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--instrument)]"><Scale size={14} aria-hidden />{opnameLotId === placement.lotId ? "Membuat…" : "Opname"}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-[var(--technical-line)] bg-[var(--surface-raised)] p-4 sm:px-6">
          <Link href={`/gudang/scan?code=${encodeURIComponent(loc.code)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[var(--stage-inventory)] px-4 text-sm font-semibold text-white transition hover:bg-[color-mix(in srgb, var(--stage-inventory) 85%, black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--instrument)] focus-visible:ring-offset-2"><ScanLine size={16} aria-hidden />Pindai lokasi</Link>
          <Link href="/gudang" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[var(--input)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--instrument)]"><Warehouse size={16} aria-hidden />Kelola lokasi</Link>
        </footer>
      </aside>
    </div>
  );
}
