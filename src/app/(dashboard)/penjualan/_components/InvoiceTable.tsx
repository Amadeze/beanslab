import { useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Search, Plus, MoreHorizontal, Ban } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatRupiah } from "@/lib/format";
import { VoidConfirmDialog } from "@/components/VoidConfirmDialog";
import { TerimaPaymentDialog } from "../../keuangan/_components/TerimaPaymentDialog";
import { ResiDialog } from "./ResiDialog";
import { ReturDialog } from "./ReturDialog";
import { ArrowLeftRight } from "lucide-react";
import { voidInvoice, approveInvoiceForMidtrans } from "../actions";
import type { InvoiceRow } from "../actions";
import { getSalesChannelLabel } from "@/lib/sales-channel";
import {
  nextOperatorFulfillmentStatuses,
  type OperatorFulfillmentStatus,
} from "@/lib/fulfillment-status";
import { EmptyState } from "@/components/shared/EmptyState";
import { NoResults } from "@/components/ui/state";

function canManageFulfillment(invoice: InvoiceRow) {
  return nextOperatorFulfillmentStatuses(
    invoice.fulfillmentStatus as OperatorFulfillmentStatus,
  ).length > 0;
}

const triggerSilentPrint = (url: string) => {
  let iframe = document.getElementById("silent-print-iframe") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "silent-print-iframe";
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);
  }
  iframe.src = url;
};

export function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [voidTarget, setVoidTarget] = useState<InvoiceRow | null>(null);
  const [payTarget, setPayTarget] = useState<InvoiceRow | null>(null);
  const [resiTarget, setResiTarget] = useState<InvoiceRow | null>(null);
  const [returTarget, setReturTarget] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isApproving, setIsApproving] = useState<string | null>(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        inv.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const mappedPayTarget = payTarget ? {
    id: payTarget.id,
    code: payTarget.code,
    customerName: payTarget.customerName,
    customerPhone: null,
    grandTotal: payTarget.grandTotal,
    paidAmount: payTarget.paidAmount,
    returnedAmount: payTarget.returnedAmount,
    balance: payTarget.balance,
    status: payTarget.status as "ISSUED" | "PARTIAL",
    issuedAt: payTarget.issuedAt,
    dueDate: payTarget.dueDate,
    agingBucket: "CURRENT" as any,
    itemSummary: `${payTarget.itemCount} item`,
  } : null;

  const handleApprove = async (inv: InvoiceRow) => {
    setIsApproving(inv.id);
    const res = await approveInvoiceForMidtrans(inv.id);
    setIsApproving(null);
    if (!res.success) {
      toast.error(res.error || "Gagal membatalkan invoice.");
    } else if (res.paymentLink) {
      // Buka link payment di tab baru agar Admin bisa copy atau langsung bayar (opsional)
      // atau redirect WhatsApp? Kita buka link Midtrans di tab baru dan refresh halaman
      window.open(res.paymentLink, "_blank");
    }
  };

  return (
    <>
    <div className="mb-4 flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          placeholder="Cari kode atau nama customer..."
          className="h-10 rounded-card border-border bg-card pl-9 focus-visible:ring-copper/30"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="h-10 rounded-card border border-border bg-card px-3 text-sm font-medium text-ink outline-none focus-visible:ring-copper/30"
      >
        <option value="ALL">Semua Status</option>
        <option value="DRAFT">Draft</option>
        <option value="ISSUED">Tempo</option>
        <option value="PARTIAL">Sebagian</option>
        <option value="PAID">Lunas</option>
        <option value="RETURNED">Diretur</option>
        <option value="VOID">Void</option>
      </select>
    </div>

    <div className="hidden overflow-hidden rounded-card border border-border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-surface-sunken">
            <TableHead className="w-40 text-xs font-bold uppercase tracking-widest text-ink-tertiary">No. Nota</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">Customer</TableHead>
            <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-ink-tertiary">Total</TableHead>
            <TableHead className="w-32 text-center text-xs font-bold uppercase tracking-widest text-ink-tertiary">Status</TableHead>
            <TableHead className=" w-56 text-center text-xs font-bold uppercase tracking-widest text-ink-tertiary">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredInvoices.length === 0 ? (
            <EmptyState.TableEmptyState
  label="nota penjualan"
  isFiltered={invoices.length > 0}
  filteredLabel="Tidak ada nota yang cocok dengan filter."
  filteredDescription="Coba ubah filter atau pencarian."
  actionLabel="Nota Baru"
  actionIcon={<Plus size={12} />}
  onAction={() => { /* navigate to create invoice */ }}
  colSpan={5}
/>
          ) : (
            filteredInvoices.map((inv) => {
              const primary = inv.status === "DRAFT"
                ? { label: isApproving === inv.id ? "Memproses..." : "Approve", onClick: () => handleApprove(inv), disabled: isApproving === inv.id }
                : (inv.status === "ISSUED" || inv.status === "PARTIAL") && inv.balance > 0
                  ? { label: "Bayar", onClick: () => setPayTarget(inv), disabled: false }
                  : canManageFulfillment(inv)
                    ? { label: "Fulfillment", onClick: () => setResiTarget(inv), disabled: false }
                    : null;
              const returEligible = inv.fulfillmentStatus === "DELIVERED" && inv.status !== "VOID" && inv.status !== "RETURNED";
              const voidEligible = inv.status !== "VOID" && inv.status !== "PAID" && inv.status !== "RETURNED";
              return (
              <TableRow key={inv.id} className="transition-colors hover:bg-surface-sunken">
                <TableCell>
                  <p className="font-mono text-xs font-semibold text-ink">{inv.code}</p>
                  <p className="mt-0.5 text-[11px] text-ink-secondary">{formatDate(inv.issuedAt)}</p>
                  {inv.dueDate && (
                    <p className="text-xs text-[var(--status-warning)] font-bold uppercase tracking-wider mt-0.5">
                      Tempo: {formatDate(inv.dueDate)}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm font-bold text-ink">
                  {inv.customerName}
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
                    {getSalesChannelLabel(inv.salesChannel)} · {inv.itemCount} item
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <p className="font-mono text-sm font-black text-ink">{formatRupiah(inv.grandTotal)}</p>
                  {inv.balance > 0 && (
                    <p className="font-mono text-xs font-bold text-[var(--status-warning)] mt-0.5">Sisa {formatRupiah(inv.balance)}</p>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <StatusBadge status={inv.status} />
                    <StatusBadge status={inv.fulfillmentStatus} />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {primary && (
                      <Button
                        size="sm"
                        onClick={primary.onClick}
                        disabled={primary.disabled}
                        className={`h-7 px-2.5 text-[11px] font-bold uppercase tracking-wide shadow-sm ${
                          primary.label === "Bayar"
                            ? "border border-domain-finance/25 bg-domain-finance/8 text-domain-finance hover:bg-domain-finance/15"
                            : primary.label === "Fulfillment"
                              ? "border border-domain-production/25 bg-domain-production/8 text-domain-production hover:bg-domain-production/15"
                              : "border border-domain-sales/25 bg-domain-sales/8 text-domain-sales hover:bg-domain-sales/15"
                        }`}
                      >
                        {primary.label}
                      </Button>
                    )}
                    <Popover>
                        <PopoverTrigger
                            aria-label={`Menu lainnya untuk ${inv.code}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
                          >
                            <MoreHorizontal size={14} />
                      </PopoverTrigger>
                        <PopoverContent align="end" className="w-40 p-1">
                          <button
                            onClick={() => triggerSilentPrint(`/nota/${inv.id}?print=true`)}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-ink hover:bg-surface-sunken"
                          >
                            <ExternalLink size={13} /> Print nota
                          </button>
                          {returEligible && (
                            <button
                              onClick={() => setReturTarget(inv.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-[var(--status-warning)] hover:bg-[var(--status-warning)]/10"
                            >
                              <ArrowLeftRight size={13} /> Retur
                            </button>
                          )}
                          {voidEligible && (
                            <button
                              onClick={() => setVoidTarget(inv)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10"
                            >
                              <Ban size={13} /> Void
                            </button>
                          )}
                        </PopoverContent>
                      </Popover>
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>

        <div className="md:hidden flex flex-col gap-3">
      {filteredInvoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
           <p className="text-sm font-medium text-ink-secondary">
             {invoices.length > 0 ? "Tidak ada nota yang cocok." : "Belum ada nota."}
           </p>
        </div>
      ) : (
        filteredInvoices.map((inv) => (
          <div key={inv.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-ink">{inv.customerName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-xs font-semibold text-ink">{inv.code}</span>
                  <span className="text-xs text-ink-secondary">&middot;</span>
                  <span className="text-xs text-ink-secondary">{inv.itemCount} Item</span>
                  <span className="text-xs text-ink-secondary">&middot;</span>
                  <span className="text-xs text-ink-secondary">{getSalesChannelLabel(inv.salesChannel)}</span>
                  {inv.purchaseOrderReference ? (
                    <span className="text-xs font-medium text-ink">PO {inv.purchaseOrderReference}</span>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-black text-ink">{formatRupiah(inv.grandTotal)}</p>
                {inv.balance > 0 && (
                  <p className="font-mono text-xs font-bold text-[var(--status-warning)] mt-0.5">Sisa: {formatRupiah(inv.balance)}</p>
                )}
              </div>
            </div>
            
            <div className="mt-2 flex items-end justify-between border-t border-border pt-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={inv.status} />
                  <StatusBadge status={inv.fulfillmentStatus} />
                </div>
                <span className="text-xs font-semibold text-ink-secondary">{formatDate(inv.issuedAt)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {inv.status === "DRAFT" && (
                  <Button
                    size="sm"
                    onClick={() => handleApprove(inv)}
                    disabled={isApproving === inv.id}
                    className="h-9 border border-domain-sales/25 bg-domain-sales/8 px-2.5 text-[11px] font-bold uppercase tracking-wide text-domain-sales shadow-sm hover:bg-domain-sales/15"
                  >
                    {isApproving === inv.id ? "Memproses..." : "Approve"}
                  </Button>
                )}
                {(inv.status === "ISSUED" || inv.status === "PARTIAL") && inv.balance > 0 && (
                  <Button size="sm" onClick={() => setPayTarget(inv)} className="h-9 bg-domain-finance px-2 text-white hover:bg-domain-finance/90">Bayar</Button>
                )}
                {canManageFulfillment(inv) && (
                  <Button
                    size="sm"
                    onClick={() => setResiTarget(inv)}
                    aria-label={`Fulfillment ${inv.code}`}
                    className="h-9 bg-domain-production/10 px-2 text-domain-production hover:bg-domain-production/15"
                  >
                    Fulfillment
                  </Button>
                )}
                {inv.fulfillmentStatus === "DELIVERED" && inv.status !== "VOID" && inv.status !== "RETURNED" && (
                  <Button size="sm" variant="ghost" aria-label={`Retur ${inv.code}`} onClick={() => setReturTarget(inv.id)} className="h-9 px-2 text-[11px] font-bold uppercase text-[var(--status-warning)] hover:bg-[var(--status-warning)]/10">
                    Retur
                  </Button>
                )}
                <button onClick={() => triggerSilentPrint(`/nota/${inv.id}?print=true`)} className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card/40 px-2.5 text-[11px] font-bold uppercase text-ink shadow-sm hover:bg-ink hover:text-white">
                  Print
                </button>
                {inv.status !== "VOID" && inv.status !== "PAID" && inv.status !== "RETURNED" && (
                  <Button size="sm" variant="ghost" onClick={() => setVoidTarget(inv)} className="h-9 px-2.5 text-[11px] font-bold uppercase text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]">
                    Void
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>

    <VoidConfirmDialog
      open={!!voidTarget}
      onOpenChange={(v) => { if (!v) setVoidTarget(null); }}
      title={`Void Nota ${voidTarget?.code ?? ""}`}
      description="Stok Produk Jadi akan dikembalikan. Nota yang sudah LUNAS tidak bisa di-void."
      onConfirm={async (reason) => voidInvoice(voidTarget!.id, reason)}
    />

    <TerimaPaymentDialog
      invoice={mappedPayTarget}
      open={!!payTarget}
      onOpenChange={(v) => { if (!v) setPayTarget(null); }}
      onSuccess={() => setPayTarget(null)}
    />

    <ResiDialog
      invoice={resiTarget}
      open={!!resiTarget}
      onOpenChange={(v) => { if (!v) setResiTarget(null); }}
    />

    <ReturDialog
      invoiceId={returTarget}
      open={!!returTarget}
      onOpenChange={(v) => { if (!v) setReturTarget(null); }}
      onSuccess={() => setReturTarget(null)}
    />
    </>
  );
}
