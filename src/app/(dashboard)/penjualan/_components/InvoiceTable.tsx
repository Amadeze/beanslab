import { useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Search, Banknote } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatRupiah } from "@/lib/format";
import { VoidConfirmDialog } from "@/components/VoidConfirmDialog";
import { TerimaPaymentDialog } from "../../keuangan/_components/TerimaPaymentDialog";
import { ResiDialog } from "./ResiDialog";
import { ReturDialog } from "./ReturDialog";
import { Truck, ArrowLeftRight } from "lucide-react";
import { voidInvoice, approveInvoiceForMidtrans } from "../actions";
import type { InvoiceRow } from "../actions";
import {
  nextOperatorFulfillmentStatuses,
  type OperatorFulfillmentStatus,
} from "@/lib/fulfillment-status";

function canManageFulfillment(invoice: InvoiceRow) {
  return nextOperatorFulfillmentStatuses(
    invoice.fulfillmentStatus as OperatorFulfillmentStatus,
  ).length > 0;
}

const SALES_CHANNEL_LABELS: Record<string, string> = {
  WALK_IN: "Walk-in",
  WHATSAPP: "WhatsApp",
  MARKETPLACE: "Marketplace",
  B2B_DIRECT: "B2B langsung",
  OTHER: "Lainnya",
};

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

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={10} className="py-12 text-center">
        <p className="text-sm font-medium text-zinc-400">
          {isFiltered ? "Tidak ada nota yang cocok dengan filter." : "Belum ada nota penjualan."}
        </p>
        {!isFiltered && (
          <p className="mt-1 text-xs text-zinc-300">Klik "Nota Baru" untuk mencatat transaksi pertama.</p>
        )}
      </TableCell>
    </TableRow>
  );
}

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
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Cari kode atau nama customer..."
          className="h-10 rounded-lg border-stone-200 bg-white pl-9 focus-visible:ring-stone-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 outline-none focus:ring-2 focus:ring-stone-400"
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

    <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-stone-200 bg-stone-50">
            <TableHead className="w-36 text-xs font-bold uppercase tracking-widest text-slate-500">No. Nota</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer</TableHead>
            <TableHead className=" text-center text-xs font-bold uppercase tracking-widest text-slate-500">Item</TableHead>
            <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">Total</TableHead>
            <TableHead className=" text-right text-xs font-bold uppercase tracking-widest text-slate-500">Terbayar</TableHead>
            <TableHead className=" text-right text-xs font-bold uppercase tracking-widest text-slate-500">Sisa</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Tanggal</TableHead>
            <TableHead className="w-20 text-center text-xs font-bold uppercase tracking-widest text-slate-500">Pembayaran</TableHead>
            <TableHead className="w-28 text-center text-xs font-bold uppercase tracking-widest text-slate-500">Fulfillment</TableHead>
            <TableHead className=" text-center text-xs font-bold uppercase tracking-widest text-slate-500">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredInvoices.length === 0 ? (
            <EmptyState isFiltered={invoices.length > 0} />
          ) : (
            filteredInvoices.map((inv) => (
              <TableRow key={inv.id} className="transition-colors hover:bg-stone-50">
                <TableCell >
                  <p className="font-mono text-xs font-semibold text-slate-600">{inv.code}</p>
                </TableCell>
                <TableCell className="text-sm font-bold text-slate-900">
                  {inv.customerName}
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {SALES_CHANNEL_LABELS[inv.salesChannel] ?? inv.salesChannel}
                  </p>
                </TableCell>
                <TableCell  className="text-center font-mono text-sm text-slate-500">
                  {inv.itemCount}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-black text-slate-900">
                  {formatRupiah(inv.grandTotal)}
                </TableCell>
                <TableCell  className="text-right font-mono text-sm font-bold text-emerald-700">
                  {formatRupiah(inv.paidAmount)}
                </TableCell>
                <TableCell
                  className={`hidden md:table-cell text-right font-mono text-sm font-black ${
                    inv.balance > 0 ? "text-amber-600" : "text-slate-400"
                  }`}
                >
                  {inv.balance > 0 ? formatRupiah(inv.balance) : "—"}
                </TableCell>
                <TableCell className="text-sm font-semibold text-slate-500">
                  <p>{formatDate(inv.issuedAt)}</p>
                  {inv.dueDate && (
                    <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mt-0.5">
                      Tempo: {formatDate(inv.dueDate)}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={inv.status} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={inv.fulfillmentStatus} />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {inv.status === "DRAFT" && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(inv)}
                        disabled={isApproving === inv.id}
                        className="h-7 border border-domain-sales/25 bg-domain-sales/8 px-2.5 text-[11px] font-bold uppercase tracking-wide text-domain-sales shadow-sm hover:bg-domain-sales/15"
                      >
                        {isApproving === inv.id ? "Memproses..." : "Approve"}
                      </Button>
                    )}
                    {(inv.status === "ISSUED" || inv.status === "PARTIAL") && inv.balance > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setPayTarget(inv)}
                        className="h-7 gap-1 border border-domain-finance/25 bg-domain-finance/8 px-2.5 text-[11px] font-bold uppercase tracking-wide text-domain-finance shadow-sm hover:bg-domain-finance/15"
                      >
                        <Banknote size={12} />
                        Bayar
                      </Button>
                    )}
                    {canManageFulfillment(inv) && (
                      <Button
                        size="sm"
                        onClick={() => setResiTarget(inv)}
                        aria-label={`Fulfillment ${inv.code}`}
                        className="h-7 gap-1 border border-domain-production/25 bg-domain-production/8 px-2.5 text-[11px] font-bold uppercase tracking-wide text-domain-production shadow-sm hover:bg-domain-production/15"
                      >
                        <Truck size={12} />
                        Fulfillment
                      </Button>
                    )}
                    {inv.fulfillmentStatus === "DELIVERED" && inv.status !== "VOID" && inv.status !== "RETURNED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Retur ${inv.code}`}
                        className="h-7 gap-1 px-2.5 text-[11px] font-bold uppercase tracking-wide text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg"
                        onClick={() => setReturTarget(inv.id)}
                      >
                        <ArrowLeftRight size={12} />
                        Retur
                      </Button>
                    )}
                    <button
                      onClick={() => triggerSilentPrint(`/nota/${inv.id}?print=true`)}
                      className="inline-flex items-center gap-1 h-7 rounded-lg border border-white/60 bg-white/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-800 transition-all shadow-sm"
                    >
                      <ExternalLink size={12} />
                      Print
                    </button>
                    {inv.status !== "VOID" && inv.status !== "PAID" && inv.status !== "RETURNED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-[11px] font-bold uppercase tracking-wide text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg"
                        onClick={() => setVoidTarget(inv)}
                      >
                        Void
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

        <div className="md:hidden flex flex-col gap-3">
      {filteredInvoices.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white py-12 text-center">
           <p className="text-sm font-medium text-zinc-400">
             {invoices.length > 0 ? "Tidak ada nota yang cocok." : "Belum ada nota."}
           </p>
        </div>
      ) : (
        filteredInvoices.map((inv) => (
          <div key={inv.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-900">{inv.customerName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-xs font-semibold text-slate-600">{inv.code}</span>
                  <span className="text-xs text-slate-400">&middot;</span>
                  <span className="text-xs text-slate-500">{inv.itemCount} Item</span>
                  <span className="text-xs text-slate-400">&middot;</span>
                  <span className="text-xs text-slate-500">{SALES_CHANNEL_LABELS[inv.salesChannel] ?? inv.salesChannel}</span>
                  {inv.purchaseOrderReference ? (
                    <span className="text-xs font-medium text-slate-600">PO {inv.purchaseOrderReference}</span>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-black text-slate-900">{formatRupiah(inv.grandTotal)}</p>
                {inv.balance > 0 && (
                  <p className="font-mono text-xs font-bold text-amber-600 mt-0.5">Sisa: {formatRupiah(inv.balance)}</p>
                )}
              </div>
            </div>
            
            <div className="mt-2 flex items-end justify-between border-t border-stone-200 pt-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={inv.status} />
                  <StatusBadge status={inv.fulfillmentStatus} />
                </div>
                <span className="text-xs font-semibold text-slate-500">{formatDate(inv.issuedAt)}</span>
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
                  <Button size="sm" variant="ghost" aria-label={`Retur ${inv.code}`} onClick={() => setReturTarget(inv.id)} className="h-9 px-2 text-[11px] font-bold uppercase text-amber-600 hover:bg-amber-50">
                    Retur
                  </Button>
                )}
                <button onClick={() => triggerSilentPrint(`/nota/${inv.id}?print=true`)} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white/40 px-2.5 text-[11px] font-bold uppercase text-slate-600 shadow-sm hover:bg-slate-900 hover:text-white">
                  Print
                </button>
                {inv.status !== "VOID" && inv.status !== "PAID" && inv.status !== "RETURNED" && (
                  <Button size="sm" variant="ghost" onClick={() => setVoidTarget(inv)} className="h-9 px-2.5 text-[11px] font-bold uppercase text-red-500 hover:bg-red-50 hover:text-red-600">
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
