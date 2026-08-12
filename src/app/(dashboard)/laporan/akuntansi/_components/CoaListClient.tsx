"use client";

import { useState, useMemo } from "react";
import { formatRupiah, formatDate } from "@/lib/format";
import type { CoaRow, JournalEntryRow, TrialBalanceRow } from "../actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createAccount, updateAccount, toggleAccountStatus } from "../actions";
import { ReportExport } from "../../_shared/ReportExport";

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Aset", LIABILITY: "Kewajiban", EQUITY: "Ekuitas",
  REVENUE: "Pendapatan", EXPENSE: "Beban",
};

const money = (v: unknown) => (Number(v) > 0 ? formatRupiah(Number(v)) : "");

const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-50 text-blue-700 border-blue-200",
  LIABILITY: "bg-amber-50 text-amber-700 border-amber-200",
  EQUITY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVENUE: "bg-violet-50 text-violet-700 border-violet-200",
  EXPENSE: "bg-rose-50 text-rose-700 border-rose-200",
};

interface Props {
  accounts: CoaRow[];
  entries: JournalEntryRow[];
  trialBalance: TrialBalanceRow[];
}

function AccountFormDialog({
  open, onOpenChange, account, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: CoaRow | null;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "ASSET");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      if (account) {
        await updateAccount(account.id, { code, name });
        toast.success("Akun diperbarui");
      } else {
        await createAccount({ code, name, type });
        toast.success("Akun dibuat");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan akun");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit Akun" : "Akun Baru"}</DialogTitle>
          <DialogDescription>
            {account ? "Ubah kode atau nama akun" : "Tambah akun baru ke Chart of Accounts"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Kode Akun</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="cth: 1-1400" disabled={!!account?.isSystem} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nama Akun</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama akun" />
          </div>
          {!account && (
            <div className="space-y-2">
              <Label htmlFor="type">Tipe Akun</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">Aset</SelectItem>
                  <SelectItem value="LIABILITY">Kewajiban</SelectItem>
                  <SelectItem value="EQUITY">Ekuitas</SelectItem>
                  <SelectItem value="REVENUE">Pendapatan</SelectItem>
                  <SelectItem value="EXPENSE">Beban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={saving || !code || !name}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CoaListClient({ accounts, entries, trialBalance, embedded = false }: Props & { embedded?: boolean }) {
  const [tab, setTab] = useState<"coa" | "jurnal" | "neraca">("coa");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<CoaRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const grouped = accounts.reduce<Record<string, CoaRow[]>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  async function handleToggleStatus(acct: CoaRow) {
    try {
      await toggleAccountStatus(acct.id, !acct.isActive);
      toast.success(acct.isActive ? "Akun dinonaktifkan" : "Akun diaktifkan");
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal mengubah status");
    }
  }

  function openEdit(acct: CoaRow) {
    setEditAccount(acct);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditAccount(null);
    setDialogOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded && (
        <PageHeader
          title="Akuntansi"
          eyebrow="Double Entry"
          description="Chart of Accounts & Journal Entries"
        />
      )}
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab("coa")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === "coa" ? "bg-stone-900 text-white" : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              Chart of Accounts
            </button>
            <button
              onClick={() => setTab("jurnal")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === "jurnal" ? "bg-stone-900 text-white" : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              Jurnal Umum
            </button>
            <button
              onClick={() => setTab("neraca")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === "neraca" ? "bg-stone-900 text-white" : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              Neraca Saldo
            </button>
          </div>

          {tab === "coa" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ReportExport
                  title="Chart of Accounts"
                  filename="chart-of-accounts"
                  columns={[
                    { header: "Kode", key: "code" },
                    { header: "Nama", key: "name" },
                    { header: "Tipe", key: "type" },
                    { header: "Status", key: "status" },
                  ]}
                  data={accounts.map((a) => ({
                    code: a.code,
                    name: a.name,
                    type: TYPE_LABELS[a.type] ?? a.type,
                    status: a.isActive ? "Aktif" : "Nonaktif",
                  }))}
                />
                <Button size="sm" onClick={openCreate}>
                  + Akun Baru
                </Button>
              </div>
              {Object.entries(grouped).map(([type, accts]) => (
                <div key={type} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                  <div className={`px-5 py-3 border-b ${TYPE_COLORS[type] || "bg-stone-50"}`}>
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span className="ml-2 text-xs opacity-60">({accts.length})</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {accts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-stone-400 w-16">{a.code}</span>
                          <span className={`text-sm font-medium ${a.isActive ? "text-stone-800" : "text-stone-400 line-through"}`}>
                            {a.name}
                          </span>
                          {a.isSystem && (
                            <Badge variant="outline" className="text-xs text-stone-400 border-stone-200">sistem</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(a)} disabled={a.isSystem}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleToggleStatus(a)} disabled={a.isSystem}>
                            {a.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "jurnal" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <ReportExport
                  title="Jurnal Umum"
                  filename="jurnal-umum"
                  columns={[
                    { header: "Tanggal", key: "date", format: (v) => formatDate(v as string) },
                    { header: "No. Jurnal", key: "journalCode" },
                    { header: "Keterangan", key: "description" },
                    { header: "Akun", key: "accountName" },
                    { header: "Debit", key: "debit", format: money },
                    { header: "Kredit", key: "credit", format: money },
                  ]}
                  data={entries.flatMap((e) =>
                    e.lines.map((l) => ({
                      date: e.date,
                      journalCode: e.code,
                      description: e.description,
                      accountName: `${l.accountCode} ${l.accountName}`,
                      debit: l.debit,
                      credit: l.credit,
                    })),
                  )}
                />
              </div>
              {entries.length === 0 ? (
                <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
                  Belum ada jurnal. Jurnal akan tercatat otomatis saat ada transaksi.
                </div>
              ) : entries.map((e) => (
                <div key={e.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-stone-50 border-b border-stone-200">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-stone-700">{e.code}</span>
                      <span className="text-xs text-stone-400">{formatDate(e.date)}</span>
                      {e.refType && (
                        <Badge variant="outline" className="text-xs">{e.refType}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-stone-500">{e.description}</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {e.lines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-stone-400 w-16">{l.accountCode}</span>
                          <span className="text-stone-700">{l.accountName}</span>
                        </div>
                        <div className="flex gap-8 font-mono text-xs tabular-nums">
                          <span className="w-24 text-right text-emerald-700">
                            {l.debit > 0 ? formatRupiah(l.debit) : ""}
                          </span>
                          <span className="w-24 text-right text-rose-700">
                            {l.credit > 0 ? formatRupiah(l.credit) : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-5 py-2.5 bg-stone-50/50 border-t border-stone-200 text-xs font-bold">
                    <span className="text-stone-500">Total</span>
                    <div className="flex gap-8 font-mono tabular-nums">
                      <span className="w-24 text-right text-stone-800">{formatRupiah(e.totalDebit)}</span>
                      <span className="w-24 text-right text-stone-800">{formatRupiah(e.totalCredit)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "neraca" && (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Neraca Saldo</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400">{trialBalance.length} akun</span>
                  <ReportExport
                    title="Neraca Saldo"
                    filename="neraca-saldo"
                    status="FINAL"
                    orientation="landscape"
                    columns={[
                      { header: "Kode", key: "code" },
                      { header: "Nama", key: "name" },
                      { header: "Tipe", key: "type" },
                      { header: "Debit", key: "debit", format: money },
                      { header: "Kredit", key: "credit", format: money },
                      { header: "Saldo", key: "balance", format: (v) => formatRupiah(Math.abs(Number(v))) },
                    ]}
                    data={[
                      ...trialBalance.map((r) => ({
                        code: r.accountCode,
                        name: r.accountName,
                        type: TYPE_LABELS[r.type] ?? r.type,
                        debit: r.debit,
                        credit: r.credit,
                        balance: r.balance,
                      })),
                      {
                        code: "TOTAL",
                        name: "",
                        type: "",
                        debit: trialBalance.reduce((s, r) => s + r.debit, 0),
                        credit: trialBalance.reduce((s, r) => s + r.credit, 0),
                        balance: trialBalance.reduce((s, r) => s + r.balance, 0),
                      },
                    ]}
                    summary={[
                      {
                        label: "Total Trial Balance (Debit)",
                        value: formatRupiah(trialBalance.reduce((s, r) => s + r.debit, 0)),
                      },
                      {
                        label: "Total Trial Balance (Kredit)",
                        value: formatRupiah(trialBalance.reduce((s, r) => s + r.credit, 0)),
                      },
                      {
                        label: "Saldo Akhir",
                        value: formatRupiah(Math.abs(trialBalance.reduce((s, r) => s + r.balance, 0))),
                      },
                    ]}
                  />
                </div>
              </div>
              <div className="divide-y divide-stone-100">
                {trialBalance.map((r) => (
                  <div key={r.accountCode} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-stone-400 w-16 shrink-0">{r.accountCode}</span>
                      <span className="text-stone-700 truncate">{r.accountName}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${TYPE_COLORS[r.type] || ""}`}>
                        {TYPE_LABELS[r.type] || r.type}
                      </Badge>
                    </div>
                    <div className="flex gap-8 font-mono text-xs tabular-nums shrink-0">
                      <span className={`w-24 text-right ${r.debit > 0 ? "text-emerald-700 font-medium" : "text-stone-300"}`}>
                        {r.debit > 0 ? formatRupiah(r.debit) : "—"}
                      </span>
                      <span className={`w-24 text-right ${r.credit > 0 ? "text-rose-700 font-medium" : "text-stone-300"}`}>
                        {r.credit > 0 ? formatRupiah(r.credit) : "—"}
                      </span>
                      <span className={`w-24 text-right font-semibold ${r.balance >= 0 ? "text-stone-800" : "text-red-600"}`}>
                        {formatRupiah(Math.abs(r.balance))}
                        {r.balance < 0 ? " (cr)" : r.balance > 0 ? " (db)" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-2.5 bg-stone-50/50 border-t border-stone-200 text-xs font-bold flex items-center justify-between">
                <span className="text-stone-500">Total</span>
                <div className="flex gap-8 font-mono tabular-nums">
                  <span className="w-24 text-right text-stone-800">
                    {formatRupiah(trialBalance.reduce((s, r) => s + r.debit, 0))}
                  </span>
                  <span className="w-24 text-right text-stone-800">
                    {formatRupiah(trialBalance.reduce((s, r) => s + r.credit, 0))}
                  </span>
                  <span className="w-24 text-right" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AccountFormDialog
        key={refreshKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editAccount}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
