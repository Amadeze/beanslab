"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createMachine, updateMachine, toggleMachineActive } from "../actions";
import { Plus, Pencil, ToggleLeft, ToggleRight, Cpu } from "lucide-react";

type Machine = {
  id: string;
  name: string;
  description: string | null;
  capacityKg: number | null;
  isActive: boolean;
  createdAt: string;
  _count: { artisanConnectors: number; artisanImports: number };
};

export function MachinesClient({ machines }: { machines: Machine[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacityKg, setCapacityKg] = useState("");
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setCapacityKg("");
  }

  function startEdit(m: Machine) {
    setEditingId(m.id);
    setName(m.name);
    setDescription(m.description || "");
    setCapacityKg(m.capacityKg?.toString() || "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const capacity = capacityKg ? parseFloat(capacityKg) : undefined;
      const result = editingId
        ? await updateMachine(editingId, { name, description, capacityKg: capacity })
        : await createMachine({ name, description, capacityKg: capacity });
      if (result.success) {
        toast.success(editingId ? "Mesin diperbarui." : "Mesin ditambahkan.");
        resetForm();
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    const result = await toggleMachineActive(id, !currentActive);
    if (!result.success) {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Daftar mesin</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Kelola mesin roasting yang terhubung dengan akun Anda.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
        >
          <Plus size={16} />
          Tambah Mesin
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="glass-card rounded-2xl p-6 space-y-4"
        >
          <h3 className="font-semibold text-[var(--text-primary)]">
            {editingId ? "Edit Mesin" : "Tambah Mesin Baru"}
          </h3>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Nama Mesin
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Loring S35"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Deskripsi (opsional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kapasitas, tahun, dll."
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Kapasitas per Batch (kg)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={capacityKg}
              onChange={(e) => setCapacityKg(e.target.value)}
              placeholder="Contoh: 1.5"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--amber-warm)]/50"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-xl bg-[var(--amber-warm)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : editingId ? "Simpan" : "Tambah"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-[var(--glass-border)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {machines.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Cpu className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
            <p className="text-[var(--text-secondary)]">
              Belum ada mesin. Tambahkan mesin roasting pertama Anda.
            </p>
          </div>
        )}
        {machines.map((m) => (
          <div
            key={m.id}
            className="glass-card flex items-center gap-4 rounded-2xl p-4 transition hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--amber-warm)]/10">
              <Cpu className="h-5 w-5 text-[var(--amber-warm)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--text-primary)]">{m.name}</p>
                {!m.isActive && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold uppercase text-red-500">
                    Nonaktif
                  </span>
                )}
              </div>
              {m.description && (
                <p className="text-sm text-[var(--text-tertiary)]">{m.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                {m.capacityKg && (
                  <span>Kapasitas: <strong>{m.capacityKg} kg</strong></span>
                )}
                <span>{m._count.artisanConnectors} connector · {m._count.artisanImports} import</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => startEdit(m)}
                className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition"
                title="Edit"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => handleToggle(m.id, m.isActive)}
                className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition"
                title={m.isActive ? "Nonaktifkan" : "Aktifkan"}
              >
                {m.isActive ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
