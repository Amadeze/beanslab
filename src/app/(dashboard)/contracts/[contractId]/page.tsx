import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Clock, FileText, Layers3, WalletCards } from "lucide-react";
import {
  FLAG_REQUEST_HEADER,
  isFlagEnabledFromSnapshot,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";
import { loadContractDetail } from "../actions";

export const dynamic = "force-dynamic";

const IDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

interface PageProps {
  params: Promise<{ contractId: string }>;
}

const AGING_BUCKETS: Array<{ key: "current" | "d1to30" | "d31to60" | "d61to90" | "over90"; label: string; tone: string }> = [
  { key: "current", label: "Belum jatuh tempo", tone: "text-emerald-700" },
  { key: "d1to30", label: "1–30 hari", tone: "text-amber-700" },
  { key: "d31to60", label: "31–60 hari", tone: "text-amber-800" },
  { key: "d61to90", label: "61–90 hari", tone: "text-orange-800" },
  { key: "over90", label: ">90 hari", tone: "text-red-700" },
];

export default async function ContractDetailPage({ params }: PageProps) {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  if (!isFlagEnabledFromSnapshot(flags, "b2b-contract-lifecycle")) {
    notFound();
  }
  const { contractId } = await params;
  const contract = await loadContractDetail(contractId);
  if (!contract) notFound();

  const totalAging = AGING_BUCKETS.reduce((acc, bucket) => acc + contract.aging[bucket.key], 0);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-secondary hover:text-copper"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke daftar
      </Link>
      <header className="mt-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
          B2B · {contract.contractNumber}
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.04em] text-ink">
          {contract.customerName}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          {contract.terms ?? "Tidak ada syarat khusus."}
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-4 shadow-elevation-soft">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
            Status
          </p>
          <p className="mt-2 font-heading text-base font-bold text-ink">
            {contract.isActive ? "Aktif" : "Non-aktif"}
          </p>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Mulai {contract.startDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
            {contract.endDate
              ? ` · berakhir ${contract.endDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}`
              : " · tanpa batas"}
          </p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-elevation-soft">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
            Pembayaran
          </p>
          <p className="mt-2 font-heading text-base font-bold text-ink">
            {contract.allowCredit ? `Tempo ${contract.paymentTermsDays ?? 0} hari` : "Tunai"}
          </p>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Tier pelanggan: {contract.customerTier ?? "RETAIL"}
          </p>
        </div>
        <div className="rounded-card border border-copper/30 bg-copper-soft/40 p-4 shadow-elevation-soft">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-copper-strong">
            Piutang terbuka
          </p>
          <p className="mt-2 font-heading text-base font-bold text-ink">
            {IDR(totalAging)}
          </p>
          <p className="mt-0.5 text-xs text-ink-secondary">Akumulasi seluruh nota pelanggan</p>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="aging-heading">
        <div className="flex items-end gap-2">
          <Clock className="size-4 text-copper" aria-hidden="true" />
          <h2 id="aging-heading" className="font-heading text-xl font-bold tracking-[-0.02em] text-ink">
            Aging piutang
          </h2>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-5">
          {AGING_BUCKETS.map((bucket) => (
            <li
              key={bucket.key}
              className="rounded-card border border-border bg-card p-3 shadow-elevation-soft"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
                {bucket.label}
              </p>
              <p className={`mt-2 font-heading text-base font-bold tabular-nums ${bucket.tone}`}>
                {IDR(contract.aging[bucket.key])}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="invoices-heading">
        <div className="flex items-end gap-2">
          <FileText className="size-4 text-copper" aria-hidden="true" />
          <h2 id="invoices-heading" className="font-heading text-xl font-bold tracking-[-0.02em] text-ink">
            Nota terbaru
          </h2>
        </div>
        {contract.invoices.length === 0 ? (
          <p className="mt-3 text-sm text-ink-secondary">Belum ada nota untuk pelanggan ini.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-card border border-border bg-card shadow-elevation-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                  <th scope="col" className="px-4 py-3 text-left">Kode</th>
                  <th scope="col" className="px-4 py-3 text-left">Tanggal</th>
                  <th scope="col" className="px-4 py-3 text-left">Jatuh tempo</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                  <th scope="col" className="px-4 py-3 text-right">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {contract.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-border/60">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
                      <Link href={`/penjualan/invoice/${invoice.id}`} className="hover:text-copper">
                        {invoice.code}
                      </Link>
                    </th>
                    <td className="px-4 py-3 text-ink-secondary">
                      {invoice.createdAt.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {invoice.dueDate
                        ? invoice.dueDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">{IDR(invoice.grandTotal)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">{IDR(invoice.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="prices-heading">
        <div className="flex items-end gap-2">
          <Layers3 className="size-4 text-copper" aria-hidden="true" />
          <h2 id="prices-heading" className="font-heading text-xl font-bold tracking-[-0.02em] text-ink">
            Tier harga
          </h2>
        </div>
        {contract.prices.length === 0 ? (
          <p className="mt-3 text-sm text-ink-secondary">Belum ada tier harga terikat.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {contract.prices.map((price) => (
              <li
                key={`${price.productId}-${price.tierName}-${price.minOrderQty}`}
                className="flex items-start justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-elevation-soft"
              >
                <div>
                  <p className="text-sm font-bold text-ink">{price.productName}</p>
                  <p className="text-xs text-ink-secondary">
                    Tier {price.tierName} · minimal {price.minOrderQty} unit
                  </p>
                </div>
                <div className="text-right text-sm font-bold tabular-nums text-ink">
                  {price.pricePerKg ? `${IDR(price.pricePerKg)}/kg` : ""}
                  {price.pricePerKg && price.pricePerUnit ? " · " : ""}
                  {price.pricePerUnit ? `${IDR(price.pricePerUnit)}/unit` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-card border border-border bg-card p-4 shadow-elevation-soft">
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          <WalletCards className="size-4 text-copper" aria-hidden="true" />
          Order → invoice → aging: buat order dari halaman penjualan, invoice otomatis
          jatuh tempo per syarat kontrak, dan aging muncul di sini.
        </div>
      </section>
    </main>
  );
}