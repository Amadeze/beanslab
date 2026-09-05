import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  FLAG_REQUEST_HEADER,
  isFlagEnabledFromSnapshot,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";
import { listContractsForTenant } from "./actions";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const IDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default async function ContractsListPage() {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  if (!isFlagEnabledFromSnapshot(flags, "b2b-contract-lifecycle")) {
    notFound();
  }
  const items = await listContractsForTenant();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
          B2B · Kontrak
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.04em] text-ink">
          Kontrak B2B
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          Daftar kontrak pelanggan wholesale. Setiap kontrak memiliki tier harga
          dan akses ke piutang.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-8 text-center shadow-elevation-soft">
          <FileText className="mx-auto size-8 text-ink-tertiary" aria-hidden="true" />
          <p className="mt-3 font-heading text-base font-bold text-ink">Belum ada kontrak</p>
          <p className="mt-1 text-sm text-ink-secondary">Buat kontrak baru dari halaman pelanggan.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((contract) => (
            <li key={contract.id}>
              <Link
                href={`/contracts/${contract.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-elevation-soft transition hover:border-copper/60 hover:shadow-elevation-card"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
                    {contract.contractNumber}
                  </p>
                  <p className="mt-1 font-heading text-base font-bold text-ink">
                    {contract.customerName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    Mulai {contract.startDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                    {contract.endDate
                      ? ` · berakhir ${contract.endDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}`
                      : " · tanpa batas"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span
                    className={`inline-flex h-6 items-center rounded-pill border px-2.5 text-[11px] font-bold ${
                      contract.isActive
                        ? "border-emerald-300/60 bg-emerald-50 text-emerald-800"
                        : "border-border bg-surface-sunken text-ink-tertiary"
                    }`}
                  >
                    {contract.isActive ? "Aktif" : "Non-aktif"}
                  </span>
                  <span className="text-xs text-ink-secondary">
                    {contract.openInvoiceCount} nota terbuka · {IDR(contract.openInvoiceTotal)}
                  </span>
                  <span className="text-[11px] text-ink-tertiary">
                    {contract.allowCredit ? `Tempo ${contract.paymentTermsDays ?? 0} hari` : "Tunai"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}