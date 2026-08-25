"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, ExternalLink, FileCheck2, History, X } from "lucide-react";
import { EmptyState } from "@/components/shared";
import { rejectPaymentSubmission, verifyPaymentSubmission } from "./actions";

type Row = {
  id: string;
  status: "AWAITING_PROOF" | "AWAITING_VERIFICATION" | "VERIFIED" | "REJECTED" | "EXPIRED";
  method: string;
  amount: number;
  declaredAmount: number | null;
  reviewedAmount: number | null;
  payerName: string | null;
  reference: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  proofObjectPath: string | null;
  suspectedDuplicateOf: { id: string; reference: string | null; invoice: { code: string } } | null;
  invoice: { code: string; grandTotal: number; paidAmount: number; returnedAmount: number; customer: { name: string } };
};

type Filter = "PENDING" | "HISTORY" | "ALL";

const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
const statusLabel: Record<Row["status"], string> = {
  AWAITING_PROOF: "Menunggu bukti",
  AWAITING_VERIFICATION: "Perlu dicek",
  VERIFIED: "Terverifikasi",
  REJECTED: "Ditolak",
  EXPIRED: "Kedaluwarsa",
};

export function PaymentReviewClient({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [message, setMessage] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => {
    const outstanding = Math.max(0, row.invoice.grandTotal - row.invoice.paidAmount - row.invoice.returnedAmount);
    return [row.id, String(Math.min(row.declaredAmount ?? row.amount, outstanding))];
  })));
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [duplicateConfirmations, setDuplicateConfirmations] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (filter === "PENDING") return row.status === "AWAITING_VERIFICATION";
    if (filter === "HISTORY") return row.status === "VERIFIED" || row.status === "REJECTED" || row.status === "EXPIRED";
    return true;
  }), [filter, rows]);

  function verify(row: Row) {
    const appliedAmount = Number(amounts[row.id]);
    setMessage(null);
    startTransition(async () => {
      const result = await verifyPaymentSubmission(row.id, {
        appliedAmount,
        confirmDuplicate: duplicateConfirmations[row.id],
      });
      if (!result.success) return setMessage(result.error);
      window.location.reload();
    });
  }

  function reject(row: Row) {
    const reason = reasons[row.id]?.trim() || "Bukti pembayaran belum dapat dicocokkan.";
    setMessage(null);
    startTransition(async () => {
      const result = await rejectPaymentSubmission(row.id, reason);
      if (!result.success) return setMessage(result.error);
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter bukti pembayaran">
        {(["PENDING", "HISTORY", "ALL"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === item ? "bg-ink text-white" : "border border-border bg-card text-ink"}`}>
            {item === "PENDING" ? `Perlu dicek (${rows.filter((row) => row.status === "AWAITING_VERIFICATION").length})` : item === "HISTORY" ? "Riwayat" : "Semua"}
          </button>
        ))}
      </div>
      {message ? <p role="alert" className="rounded-lg bg-[var(--status-danger)]/10 p-3 text-sm text-[var(--status-danger)]">{message}</p> : null}
      {filteredRows.length === 0 ? <EmptyState label={rows.length === 0 ? "Belum ada bukti pembayaran" : "Tidak ada pembayaran pada filter ini"} description={rows.length === 0 ? "Bukti yang dikirim pelanggan akan muncul di sini untuk diverifikasi." : "Pilih filter lain untuk melihat riwayat atau seluruh bukti pembayaran."} icon={<FileCheck2 size={21} />} /> : null}
      {filteredRows.map((row) => {
        const outstanding = Math.max(0, row.invoice.grandTotal - row.invoice.paidAmount - row.invoice.returnedAmount);
        const declared = row.declaredAmount ?? row.amount;
        const mismatch = Math.abs(declared - outstanding) > 0.01;
        const pending = row.status === "AWAITING_VERIFICATION";
        return (
          <article key={row.id} className="rounded-xl border border-border bg-card p-4 md:p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black text-ink">{row.invoice.code}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${row.status === "AWAITING_VERIFICATION" ? "bg-[var(--status-warning)]/15 text-[var(--status-warning)]" : row.status === "VERIFIED" ? "bg-[var(--status-success)]/15 text-[var(--status-success)]" : row.status === "AWAITING_PROOF" ? "bg-[var(--status-info)]/10 text-[var(--status-info)]" : "bg-[var(--status-danger)]/15 text-[var(--status-danger)]"}`}>{statusLabel[row.status]}</span>
                  {mismatch ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold uppercase text-orange-800">Nominal berbeda</span> : null}
                  {row.suspectedDuplicateOf ? <span className="rounded-full bg-[var(--status-danger)]/15 px-2 py-0.5 text-xs font-bold uppercase text-[var(--status-danger)]">Potensi duplikat</span> : null}
                </div>
                <p className="mt-1 text-xs text-ink-secondary">{row.invoice.customer.name} · {row.method} · pengirim {row.payerName || "-"}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-surface-sunken p-3"><dt className="text-xs font-semibold uppercase text-ink-secondary">Sisa tagihan</dt><dd className="mt-1 font-black text-ink">{rupiah(outstanding)}</dd></div>
                  <div className={`rounded-lg p-3 ${mismatch ? "bg-orange-50" : "bg-[var(--status-success)]/10"}`}><dt className="text-xs font-semibold uppercase text-ink-secondary">Transfer dilaporkan</dt><dd className="mt-1 font-black text-ink">{rupiah(declared)}</dd></div>
                  {row.reviewedAmount !== null ? <div className="rounded-lg bg-[var(--status-success)]/10 p-3"><dt className="text-xs font-semibold uppercase text-ink-secondary">Diterapkan</dt><dd className="mt-1 font-black text-ink">{rupiah(row.reviewedAmount)}</dd></div> : null}
                </dl>
                <p className="mt-3 text-xs text-ink-secondary">Referensi: {row.reference || "-"} · {row.submittedAt ? new Date(row.submittedAt).toLocaleString("id-ID") : "-"}</p>
                {row.suspectedDuplicateOf ? <div className="mt-3 flex gap-2 rounded-lg border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 p-3 text-xs leading-5 text-[var(--status-danger)]"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Bukti atau referensi cocok dengan {row.suspectedDuplicateOf.invoice.code} ({row.suspectedDuplicateOf.reference || "tanpa referensi"}). Periksa sebelum melanjutkan.</span></div> : null}
                {row.rejectionReason ? <p className="mt-3 text-xs text-[var(--status-danger)]">Alasan: {row.rejectionReason}</p> : null}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-surface-sunken p-4">
                {row.proofObjectPath ? <a href={`/api/payment-submissions/${row.id}/proof`} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold text-ink hover:bg-surface-sunken"><ExternalLink size={14} /> Lihat bukti asli</a> : <p className="text-center text-xs text-ink-secondary">Bukti belum diunggah.</p>}
                {pending ? <>
                  <label className="block text-xs font-bold text-ink">Nominal diterapkan ke invoice<input type="number" min="1" max={Math.min(declared, outstanding)} step="1" value={amounts[row.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [row.id]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-border" /></label>
                  {row.suspectedDuplicateOf ? <label className="flex items-start gap-2 rounded-lg border border-[var(--status-danger)]/30 bg-card p-3 text-xs text-ink"><input type="checkbox" className="mt-0.5" checked={Boolean(duplicateConfirmations[row.id])} onChange={(event) => setDuplicateConfirmations((current) => ({ ...current, [row.id]: event.target.checked }))} /><span>Saya sudah membandingkan bukti dan yakin ini transaksi berbeda.</span></label> : null}
                  <label className="block text-xs font-bold text-ink">Alasan bila ditolak<textarea rows={2} value={reasons[row.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Contoh: nominal atau rekening tujuan tidak cocok" className="mt-1.5 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none focus:border-border" /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={isPending} onClick={() => reject(row)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--status-danger)]/30 bg-card px-3 py-2.5 text-xs font-bold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 disabled:opacity-50"><X size={14} /> Tolak</button>
                    <button type="button" disabled={isPending || Boolean(row.suspectedDuplicateOf && !duplicateConfirmations[row.id])} onClick={() => verify(row)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--status-success)] px-3 py-2.5 text-xs font-bold text-white hover:bg-[var(--status-success)] disabled:opacity-50"><Check size={14} /> Verifikasi</button>
                  </div>
                </> : <div className="flex items-center justify-center gap-2 py-2 text-xs text-ink-secondary"><History size={14} /> Keputusan tersimpan di audit log</div>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
