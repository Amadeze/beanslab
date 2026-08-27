"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupiah } from "@/lib/format";
import { fetchInvoicePanelAction, type InvoicePanelData } from "../panel-actions";

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

/** Konten panel konteks: ringkasan nota penjualan. */
export function InvoicePanelContent({ invoiceId }: { invoiceId: string }) {
  const [data, setData] = useState<InvoicePanelData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchInvoicePanelAction(invoiceId)
      .then((result) => {
        if (!alive) return;
        setData(result);
      })
      .catch(() => {
        if (alive) setError("Gagal memuat ringkasan nota.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-ink-secondary" role="status">
        <Loader2 size={14} className="animate-spin text-copper" /> Memuat nota…
      </div>
    );
  }

  if (error) return <p className="py-4 text-xs text-[var(--status-danger)]">{error}</p>;
  if (!data) return <p className="py-4 text-xs text-ink-secondary">Nota tidak ditemukan.</p>;

  const paidPct =
    data.grandTotal > 0
      ? Math.min(100, Math.round((data.paidAmount / data.grandTotal) * 100))
      : 0;

  return (
    <div data-testid="invoice-panel" className="space-y-4">
      <div className="rounded-xl bg-surface-sunken p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-foreground">{data.code}</span>
          <span className="inline-flex items-center gap-1">
            <StatusBadge status={data.status} />
            <StatusBadge status={data.fulfillmentStatus} />
          </span>
        </div>
        <p className="mt-1.5 truncate text-xs text-ink-secondary">
          {data.customerName} · {formatDate(data.issuedAt)}
          {data.dueDate ? ` · tempo ${formatDate(data.dueDate)}` : ""}
        </p>
      </div>

      {/* Progres pembayaran */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-ink-tertiary">Terbayar</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatRupiah(data.paidAmount)} / {formatRupiah(data.grandTotal)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
          <div
            className={cn("h-full rounded-full", paidPct >= 100 ? "bg-[var(--status-success)]" : "bg-primary")}
            style={{ width: `${paidPct}%` }}
          />
        </div>
        {data.balance > 0 ? (
          <p className="mt-1 text-right text-[11px] font-bold tabular-nums text-[var(--status-warning)]">
            Sisa {formatRupiah(data.balance)}
          </p>
        ) : (
          <p className="mt-1 text-right text-[11px] font-semibold text-[var(--status-success)]">Lunas</p>
        )}
      </div>

      {/* Item */}
      <div>
        <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-tertiary">
          Item ({data.items.length})
        </p>
        <ul className="space-y-1">
          {data.items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-ink">
                {it.name} <span className="text-ink-tertiary">×{it.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-secondary">{formatRupiah(it.unitPrice * it.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pembayaran terakhir */}
      {data.payments.length > 0 ? (
        <div>
          <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-tertiary">
            Pembayaran terakhir
          </p>
          <ul className="space-y-1">
            {data.payments.slice(0, 3).map((p, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-ink-secondary">{formatDate(p.paidAt)}</span>
                <span className="tabular-nums font-semibold text-foreground">{formatRupiah(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link
        href="/penjualan/pelanggan"
        className="inline-block text-[11px] font-semibold text-primary hover:text-primary/80"
      >
        Kelola pelanggan →
      </Link>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}
