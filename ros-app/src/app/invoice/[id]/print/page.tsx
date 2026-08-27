import { notFound } from "next/navigation";
import { getInvoiceForPrint } from "@/app/(dashboard)/penjualan/actions";
import { PrintButton } from "./PrintButton";
import { getCurrentDate } from "@/lib/date-utils";
import { getCurrentTenantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Formatters (no import from lib to keep print page self-contained) ──

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function tgl(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:   "Draft",
  ISSUED:  "Belum Lunas (Tempo)",
  PARTIAL: "Bayar Sebagian",
  PAID:    "LUNAS",
  VOID:    "VOID",
};

const METHOD_LABEL: Record<string, string> = {
  CASH:     "Tunai",
  TRANSFER: "Transfer Bank",
  QRIS:     "QRIS",
  CREDIT:   "Piutang / Tempo",
};

// =============================================================================

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const tenantName = tenant?.name || "roastd.id";

  const inv = await getInvoiceForPrint(id);
  if (!inv) notFound();

  const isPaid = inv.status === "PAID";
  const isVoid = inv.status === "VOID";

  return (
    <>
      {/* ── Print-specific styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 12mm 14mm; }
        }
        body { background: #ECEAE2; }
      `}</style>

      {/* ── Screen toolbar (hidden on print) ── */}
      <div className="no-print fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#080B0C] px-4 py-3 text-white shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Invoice preview</span>
          <span className="hidden bg-white/8 px-2.5 py-0.5 font-mono text-xs font-medium text-white/60 sm:inline">
            {inv.code}
          </span>
          <span
            className={`px-2.5 py-0.5 text-xs font-semibold ${
              isPaid ? "bg-domain-inventory/20 text-[#A0E5D9]" :
              isVoid ? "bg-white/10 text-white/50" :
              "bg-domain-production/20 text-[#E9CF82]"
            }`}
          >
            {STATUS_LABEL[inv.status] ?? inv.status}
          </span>
        </div>
        <PrintButton />
      </div>

      {/* ── A4 Invoice Body ── */}
      <div className="no-print:mt-16 mx-auto max-w-198.5 px-4 py-8 print:p-0 print:m-0">
        <div className="relative border-t-4 border-primary bg-white shadow-lg print:border-t-2 print:shadow-none">
          {/* VOID watermark */}
          {isVoid && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 10 }}
            >
              <span
                style={{
                  fontSize: "120px",
                  fontWeight: 900,
                  color: "rgba(220,38,38,0.12)",
                  transform: "rotate(-30deg)",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                VOID
              </span>
            </div>
          )}

          <div className="p-10 print:p-0">
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-zinc-900 uppercase">
                  {tenantName}
                </h1>
                <p className="mt-1 text-xs text-zinc-500">
                  Artisan Coffee Roaster · Indonesia
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black tracking-tight text-zinc-900">INVOICE</p>
                <p className="mt-1 font-mono text-sm font-semibold text-zinc-600">{inv.code}</p>
              </div>
            </div>

            {/* ── Meta grid ── */}
            <div className="mb-8 grid grid-cols-2 gap-6">
              {/* Customer */}
              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Kepada
                </p>
                <p className="font-semibold text-zinc-900">{inv.customerName}</p>
                {inv.customerPhone && (
                  <p className="text-sm text-zinc-500">{inv.customerPhone}</p>
                )}
                {inv.customerAddress && (
                  <p className="text-sm text-zinc-500">{inv.customerAddress}</p>
                )}
              </div>

              {/* Invoice details */}
              <div className="rounded-lg bg-zinc-50 p-4 space-y-1.5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Detail Nota
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Tanggal Terbit</span>
                  <span className="font-medium text-zinc-900">{tgl(inv.issuedAt)}</span>
                </div>
                {inv.dueDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Jatuh Tempo</span>
                    <span className="font-medium text-amber-700">{tgl(inv.dueDate)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Status</span>
                  <span
                    className={`font-semibold ${
                      isPaid ? "text-emerald-700" :
                      isVoid ? "text-zinc-400" :
                      "text-amber-700"
                    }`}
                  >
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Items Table ── */}
            <table className="mb-6 w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-900">
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Produk
                  </th>
                  <th className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 w-16">
                    Qty
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 w-28">
                    Harga Satuan
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 w-24">
                    Diskon
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 w-28">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-3 font-medium text-zinc-900">{item.productName}</td>
                    <td className="py-3 text-center font-mono text-zinc-700">{item.quantity}</td>
                    <td className="py-3 text-right font-mono text-zinc-700">
                      {rupiah(item.unitPrice)}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-500">
                      {item.discount > 0 ? rupiah(item.discount) : "—"}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-zinc-900">
                      {rupiah(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Totals ── */}
            <div className="flex justify-end mb-8">
              <div className="w-72 space-y-1.5">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{rupiah(inv.subtotal)}</span>
                </div>
                {inv.discount > 0 && (
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Diskon Nota</span>
                    <span className="font-mono text-red-600">- {rupiah(inv.discount)}</span>
                  </div>
                )}
                {inv.tax > 0 && (
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Pajak</span>
                    <span className="font-mono">{rupiah(inv.tax)}</span>
                  </div>
                )}
                <div className="border-t-2 border-zinc-900 pt-2 flex justify-between">
                  <span className="font-bold text-zinc-900">Grand Total</span>
                  <span className="font-mono text-lg font-black text-zinc-900">
                    {rupiah(inv.grandTotal)}
                  </span>
                </div>
                {inv.balance > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-amber-700">
                    <span>Sisa Tagihan</span>
                    <span className="font-mono">{rupiah(inv.balance)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Payment Records ── */}
            {inv.payments.length > 0 && (
              <div className="mb-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-600">
                  Riwayat Pembayaran
                </p>
                {inv.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm text-emerald-800">
                    <span>
                      {tgl(p.paidAt)} · {METHOD_LABEL[p.method] ?? p.method} · {p.code}
                    </span>
                    <span className="font-mono font-semibold">{rupiah(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Notes ── */}
            {inv.notes && (
              <div className="mb-8 rounded-lg bg-zinc-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Catatan
                </p>
                <p className="text-sm text-zinc-600">{inv.notes}</p>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="flex items-end justify-between border-t border-zinc-200 pt-6">
              <div>
                <p className="text-xs text-zinc-400">
                  Dokumen ini dicetak dari roastd.id
                </p>
                <p className="text-xs text-zinc-400">roastd.id · {getCurrentDate().getFullYear()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400 mb-8">Hormat kami,</p>
                <div className="mt-4 border-t border-zinc-400 w-40 text-right">
                  <p className="text-xs text-zinc-500 mt-1">roastd.id</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
