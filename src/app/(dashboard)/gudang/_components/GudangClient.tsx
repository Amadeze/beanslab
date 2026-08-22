"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, ToggleLeft, ToggleRight, Warehouse, MapPin, ChevronDown, ChevronRight, Package } from "lucide-react";
import { createWarehouse, updateWarehouse, toggleWarehouseActive, type WarehouseRow } from "../warehouses/actions";
import { createLocation, updateLocation, toggleLocationActive, type LocationRow } from "../locations/actions";

const INPUT_GLASS =
  "h-11 w-full rounded-[10px] border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[#2B7567]/30";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#2B7567] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#225F54] disabled:pointer-events-none disabled:opacity-50";
const BTN_GHOST =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[var(--glass-border)] px-5 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--glass-bg-hover)]";
const BTN_GHOST_ICON =
  "inline-flex h-11 w-11 items-center justify-center rounded-[9px] text-[var(--text-tertiary)] transition hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15B8C6]";

const SYSTEM_PURPOSE_LABELS: Record<string, string> = {
  ROASTING_WIP: "Roasting WIP",
};

function SystemBadge({ purpose }: { purpose: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-sky-500">
      Sistem{purpose ? ` · ${SYSTEM_PURPOSE_LABELS[purpose] ?? purpose}` : ""}
    </span>
  );
}

export function GudangClient({
  warehouses: initialWarehouses,
  locations: initialLocations,
  qrMap = {},
}: {
  warehouses: WarehouseRow[];
  locations: LocationRow[];
  qrMap?: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<"warehouses" | "locations">("warehouses");
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
  const [lCapacity, setLCapacity] = useState("");

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
    setLCapacity("");
  }

  function startEditLocation(l: LocationRow) {
    setEditingLocation(l);
    setLWarehouseId(l.warehouseId);
    setLCode(l.code);
    setLName(l.name);
    setLZone(l.zone || "");
    setLCapacity(l.capacity === null ? "" : String(l.capacity));
    setShowLocationForm(true);
    setActiveTab("locations");
  }

  async function handleLocationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = editingLocation
        ? await updateLocation(editingLocation.id, {
            warehouseId: lWarehouseId,
            code: lCode,
            name: lName,
            zone: lZone,
            capacity: lCapacity ? Number(lCapacity) : undefined,
          })
        : await createLocation({
            warehouseId: lWarehouseId,
            code: lCode,
            name: lName,
            zone: lZone,
            capacity: lCapacity ? Number(lCapacity) : undefined,
          });
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
      <div className="inline-flex w-fit items-center rounded-[10px] border border-[#CDC8BC] bg-[#E4E1D7] p-1">
        <button
          onClick={() => setActiveTab("warehouses")}
          className={`min-h-10 rounded-[7px] px-4 text-sm font-semibold transition ${
            activeTab === "warehouses"
              ? "bg-[#2B7567] text-white shadow-sm"
              : "text-[#59605B] hover:bg-white/70 hover:text-[#141817]"
          }`}
        >
          Gudang
        </button>
        <button
          onClick={() => setActiveTab("locations")}
          className={`min-h-10 rounded-[7px] px-4 text-sm font-semibold transition ${
            activeTab === "locations"
              ? "bg-[#2B7567] text-white shadow-sm"
              : "text-[#59605B] hover:bg-white/70 hover:text-[#141817]"
          }`}
        >
          Lokasi
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
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#2B7567] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#225F54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15B8C6]"
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
                          <div className="flex items-center gap-1.5">
                            {l.zone && <p className="text-xs text-[var(--text-tertiary)]">Zona: {l.zone}</p>}
                            {l.isSystem && <SystemBadge purpose={l.systemPurpose} />}
                          </div>
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
                          {!l.isSystem && (
                            <>
                              <button onClick={() => startEditLocation(l)} className={BTN_GHOST_ICON} title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleLocationToggle(l.id, l.isActive)} className={BTN_GHOST_ICON} title={l.isActive ? "Nonaktifkan" : "Aktifkan"}>
                                {l.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                              </button>
                            </>
                          )}
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
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Kapasitas lokasi (opsional)</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  inputMode="decimal"
                  value={lCapacity}
                  onChange={(e) => setLCapacity(e.target.value)}
                  className={INPUT_GLASS}
                  placeholder="Contoh: 100"
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Gunakan satuan yang sama dengan stok utama lokasi ini, misalnya kg atau unit.</p>
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
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#2B7567] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#225F54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15B8C6]"
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
                    {l.isSystem && <SystemBadge purpose={l.systemPurpose} />}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">Gudang: {l.warehouseName}</p>
                  {l.zone && <p className="text-xs text-[var(--text-tertiary)]">Zona: {l.zone}</p>}
                  {l.capacity !== null && <p className="text-xs text-[var(--text-tertiary)]">Kapasitas: {l.capacity.toLocaleString("id-ID")}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/gudang/scan?code=${encodeURIComponent(l.code)}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white/10 hover:text-white"
                  >
                    <Package size={13} /> Lihat stok
                  </Link>
                  {!l.isSystem && (
                    <>
                      <button onClick={() => startEditLocation(l)} className={BTN_GHOST_ICON} title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleLocationToggle(l.id, l.isActive)} className={BTN_GHOST_ICON} title={l.isActive ? "Nonaktifkan" : "Aktifkan"}>
                        {l.isActive ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
      )}

    </div>
  );
}
