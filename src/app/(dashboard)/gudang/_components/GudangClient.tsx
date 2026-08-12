"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, ToggleLeft, ToggleRight, Warehouse, MapPin, ChevronDown, ChevronRight, LayoutGrid, Package } from "lucide-react";
import { createWarehouse, updateWarehouse, toggleWarehouseActive, type WarehouseRow } from "../warehouses/actions";
import { createLocation, updateLocation, toggleLocationActive, type LocationRow } from "../locations/actions";

const INPUT_GLASS =
  "w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50";
const BTN_PRIMARY =
  "rounded-xl bg-[var(--amber-warm)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50";
const BTN_GHOST =
  "rounded-xl border border-[var(--glass-border)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition";
const BTN_GHOST_ICON =
  "rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition";

export function GudangClient({
  warehouses: initialWarehouses,
  locations: initialLocations,
  qrMap = {},
}: {
  warehouses: WarehouseRow[];
  locations: LocationRow[];
  qrMap?: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<"warehouses" | "locations" | "visual">("warehouses");
  const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(null);

  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | null>(null);
  const [wCode, setWCode] = useState("");
  const [wName, setWName] = useState("");
  const [wAddress, setWAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [lWarehouseId, setLWarehouseId] = useState("");
  const [lCode, setLCode] = useState("");
  const [lName, setLName] = useState("");
  const [lZone, setLZone] = useState("");

  function resetWarehouseForm() {
    setShowWarehouseForm(false);
    setEditingWarehouse(null);
    setWCode("");
    setWName("");
    setWAddress("");
  }

  function startEdit(w: WarehouseRow) {
    setEditingWarehouse(w);
    setWCode(w.code);
    setWName(w.name);
    setWAddress(w.address || "");
    setShowWarehouseForm(true);
    setActiveTab("warehouses");
  }

  async function handleWarehouseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = editingWarehouse
        ? await updateWarehouse(editingWarehouse.id, { code: wCode, name: wName, address: wAddress })
        : await createWarehouse({ code: wCode, name: wName, address: wAddress });
      if (result.success) {
        toast.success(editingWarehouse ? "Gudang diperbarui." : "Gudang ditambahkan.");
        resetWarehouseForm();
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleWarehouseToggle(id: string, currentActive: boolean) {
    const result = await toggleWarehouseActive(id, !currentActive);
    if (!result.success) toast.error(result.error);
  }

  function resetLocationForm() {
    setShowLocationForm(false);
    setEditingLocation(null);
    setLWarehouseId("");
    setLCode("");
    setLName("");
    setLZone("");
  }

  function startEditLocation(l: LocationRow) {
    setEditingLocation(l);
    setLWarehouseId(l.warehouseId);
    setLCode(l.code);
    setLName(l.name);
    setLZone(l.zone || "");
    setShowLocationForm(true);
    setActiveTab("locations");
  }

  async function handleLocationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = editingLocation
        ? await updateLocation(editingLocation.id, { warehouseId: lWarehouseId, code: lCode, name: lName, zone: lZone })
        : await createLocation({ warehouseId: lWarehouseId, code: lCode, name: lName, zone: lZone });
      if (result.success) {
        toast.success(editingLocation ? "Lokasi diperbarui." : "Lokasi ditambahkan.");
        resetLocationForm();
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLocationToggle(id: string, currentActive: boolean) {
    const result = await toggleLocationActive(id, !currentActive);
    if (!result.success) toast.error(result.error);
  }

  const warehouseLocations = (wid: string) =>
    initialLocations.filter((l) => l.warehouseId === wid);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab("warehouses")}
          className={`px-4 py-2 text-sm font-semibold transition ${
            activeTab === "warehouses"
              ? "border-b-2 border-[#2B7567] text-[#2B7567]"
              : "text-[#87CDBC] hover:text-white"
          }`}
        >
          Gudang
        </button>
        <button
          onClick={() => setActiveTab("locations")}
          className={`px-4 py-2 text-sm font-semibold transition ${
            activeTab === "locations"
              ? "border-b-2 border-[#2B7567] text-[#2B7567]"
              : "text-[#87CDBC] hover:text-white"
          }`}
        >
          Lokasi
        </button>
        <button
          onClick={() => setActiveTab("visual")}
          className={`px-4 py-2 text-sm font-semibold transition ${
            activeTab === "visual"
              ? "border-b-2 border-[#2B7567] text-[#2B7567]"
              : "text-[#87CDBC] hover:text-white"
          }`}
        >
          <LayoutGrid size={16} className="inline mr-1" />
          Visual Map
        </button>
      </div>

      {activeTab === "warehouses" && !showLocationForm && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Gudang Anda</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {initialWarehouses.length} gudang terdaftar. Klik untuk lihat lokasi.
              </p>
            </div>
            <button
              onClick={() => {
                resetWarehouseForm();
                setShowWarehouseForm(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
            >
              <Plus size={16} /> Tambah Gudang
            </button>
          </div>

          {showWarehouseForm && (
            <form onSubmit={handleWarehouseSubmit} className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-[var(--text-primary)]">
                {editingWarehouse ? "Edit Gudang" : "Tambah Gudang Baru"}
              </h3>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Kode</label>
                <input type="text" value={wCode} onChange={(e) => setWCode(e.target.value)}
                  required maxLength={50} className={INPUT_GLASS} placeholder="Contoh: WH-01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nama</label>
                <input type="text" value={wName} onChange={(e) => setWName(e.target.value)}
                  required maxLength={100} className={INPUT_GLASS} placeholder="Contoh: Gudang Utama" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Alamat (opsional)</label>
                <input type="text" value={wAddress} onChange={(e) => setWAddress(e.target.value)}
                  maxLength={500} className={INPUT_GLASS} />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading || !wCode.trim()} className={BTN_PRIMARY}>
                  {loading ? "Menyimpan..." : editingWarehouse ? "Simpan" : "Tambah"}
                </button>
                <button type="button" onClick={resetWarehouseForm} className={BTN_GHOST}>Batal</button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {initialWarehouses.length === 0 && (
              <div className="glass-card rounded-2xl p-12 text-center">
                <Warehouse className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
                <p className="text-[var(--text-secondary)]">Belum ada gudang. Buat gudang pertama Anda.</p>
              </div>
            )}
            {initialWarehouses.map((w) => (
              <div key={w.id} className="glass-card rounded-2xl p-4 transition hover:shadow-md">
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedWarehouse(expandedWarehouse === w.id ? null : w.id)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--amber-warm)]/10">
                    <Warehouse className="h-5 w-5 text-[var(--amber-warm)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--text-primary)]">{w.name}</p>
                      <span className="text-xs text-[var(--text-tertiary)]">[{w.code}]</span>
                      {w.isDefault && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold uppercase text-emerald-500">Default</span>
                      )}
                    </div>
                    {w.address && <p className="text-sm text-[var(--text-tertiary)] truncate">{w.address}</p>}
                    <p className="text-xs text-[var(--text-tertiary)]">{w._count.locations} lokasi</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(w); }} className={BTN_GHOST_ICON} title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleWarehouseToggle(w.id, w.isActive); }} className={BTN_GHOST_ICON} title={w.isActive ? "Nonaktifkan" : "Aktifkan"}>
                      {w.isActive ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                    </button>
                    {expandedWarehouse === w.id ? <ChevronDown size={16} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={16} className="text-[var(--text-tertiary)]" />}
                  </div>
                </div>

                {expandedWarehouse === w.id && warehouseLocations(w.id).length > 0 && (
                  <div className="mt-3 ml-12 space-y-2 border-l-2 border-white/5 pl-4">
                    {warehouseLocations(w.id).map((l) => (
                      <div key={l.id} className="flex items-center justify-between rounded-lg bg-white/2 py-2 px-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{l.name} <span className="text-xs text-[var(--text-tertiary)]">[{l.code}]</span></p>
                          {l.zone && <p className="text-xs text-[var(--text-tertiary)]">Zona: {l.zone}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/gudang/scan?code=${encodeURIComponent(l.code)}`}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white/10 hover:text-white"
                          >
                            <Package size={13} /> Lihat stok
                          </Link>
                          {qrMap[l.id] && (
                            <button
                              onClick={() => {
                                const w = window.open("/gudang/scan", "_blank");
                                if (w) w.focus();
                              }}
                              className={BTN_GHOST_ICON}
                              title="Lihat QR / Pindai"
                            >
                              <Image src={qrMap[l.id]} alt={`QR ${l.code}`} width={32} height={32} className="h-8 w-8 rounded" />
                            </button>
                          )}
                          <button onClick={() => startEditLocation(l)} className={BTN_GHOST_ICON} title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleLocationToggle(l.id, l.isActive)} className={BTN_GHOST_ICON} title={l.isActive ? "Nonaktifkan" : "Aktifkan"}>
                            {l.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {expandedWarehouse === w.id && warehouseLocations(w.id).length === 0 && (
                  <p className="mt-3 ml-12 text-xs text-[var(--text-tertiary)]">Belum ada lokasi di gudang ini.</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "locations" && (
        <>
          {showLocationForm && (
            <form onSubmit={handleLocationSubmit} className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-[var(--text-primary)]">
                {editingLocation ? "Edit Lokasi" : "Tambah Lokasi Baru"}
              </h3>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Gudang</label>
                <select
                  value={lWarehouseId} onChange={(e) => setLWarehouseId(e.target.value)} required
                  className={INPUT_GLASS}
                >
                  <option value="">Pilih gudang</option>
                  {initialWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} [{w.code}]</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Kode</label>
                <input type="text" value={lCode} onChange={(e) => setLCode(e.target.value)} required maxLength={50} className={INPUT_GLASS} placeholder="Contoh: A-01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nama</label>
                <input type="text" value={lName} onChange={(e) => setLName(e.target.value)} required maxLength={100} className={INPUT_GLASS} placeholder="Contoh: Rak A, Anrak, Bin 02" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Zona (opsional)</label>
                <input type="text" value={lZone} onChange={(e) => setLZone(e.target.value)} maxLength={50} className={INPUT_GLASS} placeholder="Contoh: DRY" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading || !lCode.trim()} className={BTN_PRIMARY}>
                  {loading ? "Menyimpan..." : editingLocation ? "Simpan" : "Tambah"}
                </button>
                <button type="button" onClick={() => { resetLocationForm(); setShowLocationForm(true); }} className={BTN_GHOST}>
                  {showLocationForm && editingLocation ? "Batal" : showLocationForm ? "Batal" : ""}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Daftar Lokasi</h2>
              <p className="text-sm text-[var(--text-secondary)]">Posisi rak/bin di setiap gudang.</p>
            </div>
            <button
              onClick={() => { resetLocationForm(); setShowLocationForm(true); }}
              className="flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
            >
              <Plus size={16} /> Tambah Lokasi
            </button>
          </div>

          <div className="space-y-3">
            {initialLocations.length === 0 && (
              <div className="glass-card rounded-2xl p-12 text-center">
                <MapPin className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
                <p className="text-[var(--text-secondary)]">Belum ada lokasi. Buat lokasi di gudang mana saja.</p>
              </div>
            )}
            {initialLocations.map((l) => (
              <div key={l.id} className="glass-card flex items-center gap-4 rounded-2xl p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--amber-warm)]/10">
                  <MapPin className="h-5 w-5 text-[var(--amber-warm)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--text-primary)]">{l.name}</p>
                    <span className="text-xs text-[var(--text-tertiary)]">[{l.code}]</span>
                    {l.isDefault && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold uppercase text-emerald-500">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">Gudang: {l.warehouseName}</p>
                  {l.zone && <p className="text-xs text-[var(--text-tertiary)]">Zona: {l.zone}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/gudang/scan?code=${encodeURIComponent(l.code)}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white/10 hover:text-white"
                  >
                    <Package size={13} /> Lihat stok
                  </Link>
                  <button onClick={() => startEditLocation(l)} className={BTN_GHOST_ICON} title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleLocationToggle(l.id, l.isActive)} className={BTN_GHOST_ICON} title={l.isActive ? "Nonaktifkan" : "Aktifkan"}>
                    {l.isActive ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
      )}

      {activeTab === "visual" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Peta Visual Gudang</h2>
            <Link href="/gudang/visual" className="flex items-center gap-1 text-sm text-[var(--amber-warm)] hover:underline">
              <LayoutGrid size={14} /> Buka penuh
            </Link>
          </div>
          <div className="space-y-6">
            {initialWarehouses.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Belum ada gudang untuk ditampilkan.</p>
            ) : (
              initialWarehouses.map((w) => {
                const wLocations = initialLocations.filter((l) => l.warehouseId === w.id);
                const rackGroups: Record<string, LocationRow[]> = {};
                wLocations.forEach((l) => {
                  const rg = l.zone ?? (l.code.split("-")[0] ?? "DEFAULT").toUpperCase();
                  if (!rackGroups[rg]) rackGroups[rg] = [];
                  rackGroups[rg].push(l);
                });

                return (
                  <div key={w.id} className="glass-card rounded-2xl p-4">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-2">{w.name} [{w.code}]</h3>
                    {Object.keys(rackGroups).length === 0 ? (
                      <p className="text-xs text-[var(--text-tertiary)]">Tidak ada lokasi.</p>
                    ) : (
                      Object.entries(rackGroups).map(([rg, locs]) => (
                        <div key={rg} className="mb-3">
                          <span className="text-xs font-semibold text-[var(--text-tertiary)]">{rg}</span>
                          <div className="mt-1 grid grid-cols-[repeat(auto-fill,_minmax(70px,_1fr))] gap-2">
                            {locs.map((l) => (
                              <div
                                key={l.id}
                                className={`flex h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border p-1 text-center text-xs transition hover:scale-105 ${
                                  l.isActive
                                    ? "border-slate-200 bg-slate-50 text-slate-500"
                                    : "border-slate-300 bg-slate-100 text-slate-400"
                                }`}
                                title={l.name}
                                onClick={() => { window.location.href = `/gudang/scan?code=${l.code}`; }}
                              >
                                <span className="font-mono font-semibold">{l.code}</span>
                                <span className="block max-w-full truncate px-1">{l.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
