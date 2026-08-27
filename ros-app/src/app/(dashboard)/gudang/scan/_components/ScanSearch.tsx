"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Package, ChevronLeft, AlertCircle, Loader2 } from "lucide-react";

import { scanLocation, type ScannedLocationDetail } from "../actions";

const INPUT_GLASS =
  "w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50";

export function ScanSearch({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialCode ?? "");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScannedLocationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode && !result && !error) {
      handleScan();
    }
  }, [initialCode]);

  async function handleScan() {
    if (!query.trim()) return;
    setIsScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await scanLocation(query.trim());
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || "Lokasi tidak ditemukan.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleScan();
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setResult(null)} className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)]">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Hasil Pemindaian</h2>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--amber-warm)]/10">
              <MapPin className="h-6 w-6 text-[var(--amber-warm)]" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">{result.name}</h3>
              <p className="text-sm text-[var(--text-tertiary)]">Kode: {result.code} — {result.warehouseName} [{result.warehouseCode}]</p>
              {result.zone && <p className="text-xs text-[var(--text-tertiary)]">Zona: {result.zone}</p>}
            </div>
          </div>

          {result.placements.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Tidak ada lot di lokasi ini.</p>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase">Lot di Lokasi Ini ({result.placements.length})</h4>
              {result.placements.map((p) => (
                <div key={p.lotId} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--amber-warm)]/10">
                      <Package size={14} className="text-[var(--amber-warm)]" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{p.label}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {p.quantityKg > 0
                          ? `${p.quantityKg.toLocaleString("id-ID")} kg`
                          : p.quantityUnit > 0
                          ? `${p.quantityUnit} unit`
                          : `${p.supplyQty.toLocaleString("id-ID")} pcs`}{" "}
                        · {p.expiryDate && `Kedaluwarsa: ${new Date(p.expiryDate).toLocaleDateString("id-ID")}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/inventory/lots/${p.lotId}`)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--amber-warm)] hover:bg-[var(--amber-warm)]/10 transition"
                  >
                    Detail Lot
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleScanSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs uppercase font-bold tracking-wider text-slate-500 mb-1">
            Scan Kode Lokasi / QR
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Masukkan kode lokasi (misal: A-01) atau pindai QR"
            className={INPUT_GLASS}
            required
          />
        </div>
        <button
          type="submit"
          disabled={isScanning || !query.trim()}
          className="flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {isScanning ? "Memindai..." : "Cari"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3 text-sm text-rose-700">
          <AlertCircle size={16} className="inline mr-1" />
          {error}
        </div>
      )}
    </div>
  );
}
