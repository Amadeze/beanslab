import { notFound } from "next/navigation";
import { formatRupiah, formatDate } from "@/lib/format";
import { requireTenantPrisma, getCurrentTenantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintTrigger, PrintActionBar } from "./PrintTrigger";
import { getCurrentDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, whatsappNumber: true, contactEmail: true },
  });
  const tenantName = tenant?.name || "roastd.id";

  const invoice = await (await requireTenantPrisma()).invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!invoice) return notFound();

  return (
    <div className="flex min-h-screen justify-center bg-background p-4 print:bg-white print:p-0 sm:p-8">
      <div className="w-full max-w-3xl border-t-4 border-primary bg-white p-5 text-slate-800 shadow-xl print:max-w-none print:border-t-2 print:p-0 print:shadow-none sm:p-8">

        {/* Action Bar (Hidden when printing) */}
        <PrintActionBar />

        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6 mb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">{tenantName}</h1>
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-500">roastd.id</p>
            <div className="mt-2 text-sm text-slate-600">
              {tenant?.whatsappNumber && <p>Telp: {tenant.whatsappNumber}</p>}
              {tenant?.contactEmail && <p>Email: {tenant.contactEmail}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-light text-slate-400 uppercase tracking-widest">Invoice</h2>
            <p className="text-sm font-bold text-slate-800 mt-2">{invoice.code}</p>
            <p className="text-sm text-slate-500">{formatDate(invoice.issuedAt.toISOString())}</p>
            
            <div className={`mt-4 inline-block px-3 py-1 rounded-full text-xs font-bold border print:border-slate-800 print:text-slate-800
              ${invoice.status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}
            `}>
              {invoice.status === 'PAID' ? 'LUNAS' : invoice.status === 'DRAFT' ? 'DRAFT' : 'TEMPO'}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Tagihan Kepada:</h3>
          <p className="text-lg font-bold text-slate-800">{invoice.customer.name}</p>
          {invoice.customer.phone && <p className="text-sm text-slate-600">{invoice.customer.phone}</p>}
          {invoice.customer.address && <p className="text-sm text-slate-600 max-w-xs">{invoice.customer.address}</p>}
        </div>

        {/* Items Table */}
        <table className="w-full text-left mb-8">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="py-3 text-xs font-bold uppercase tracking-widest text-slate-500">Item / Deskripsi</th>
              <th className="py-3 text-xs font-bold uppercase tracking-widest text-slate-500 text-right">Qty</th>
              <th className="py-3 text-xs font-bold uppercase tracking-widest text-slate-500 text-right">Harga Satuan</th>
              <th className="py-3 text-xs font-bold uppercase tracking-widest text-slate-500 text-right">Diskon</th>
              <th className="py-3 text-xs font-bold uppercase tracking-widest text-slate-500 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id} className="text-sm">
                <td className="py-4">
                  <p className="font-bold text-slate-800">{item.product.name}</p>
                  <p className="text-xs text-slate-500">{item.product.code}</p>
                </td>
                <td className="py-4 text-right font-medium">{item.quantity}</td>
                <td className="py-4 text-right">{formatRupiah(Number(item.unitPrice))}</td>
                <td className="py-4 text-right text-red-500">{Number(item.discount) > 0 ? formatRupiah(Number(item.discount)) : "-"}</td>
                <td className="py-4 text-right font-bold">{formatRupiah(Number(item.subtotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Subtotal</span>
              <span className="font-bold text-slate-800">{formatRupiah(Number(invoice.subtotal))}</span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-red-500">
                <span className="font-medium">Diskon Global</span>
                <span className="font-bold">-{formatRupiah(Number(invoice.discount))}</span>
              </div>
            )}
            {Number(invoice.tax) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Pajak</span>
                <span className="font-bold text-slate-800">{formatRupiah(Number(invoice.tax))}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-slate-200 pt-3 text-lg">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="font-black text-slate-900">{formatRupiah(Number(invoice.grandTotal))}</span>
            </div>
            {Number(invoice.paidAmount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span className="font-medium">Sudah Dibayar</span>
                <span className="font-bold">{formatRupiah(Number(invoice.paidAmount))}</span>
              </div>
            )}
            {Number(invoice.grandTotal) - Number(invoice.paidAmount) > 0 && (
              <div className="flex justify-between text-amber-600 bg-amber-50 p-2 rounded-lg mt-2 print:bg-transparent print:p-0 print:mt-0">
                <span className="font-bold">Sisa Tagihan</span>
                <span className="font-black">{formatRupiah(Number(invoice.grandTotal) - Number(invoice.paidAmount))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Notes */}
        {invoice.notes && (
          <div className="mt-12 p-4 bg-slate-50 rounded-xl border border-slate-100 print:border-none print:bg-transparent print:p-0">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Catatan:</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        <div className="mt-16 text-center text-xs font-medium text-slate-400 print:mt-12">
          <p>Terima kasih atas kepercayaan Anda.</p>
          <p>Didukung oleh roastd.id &copy; {getCurrentDate().getFullYear()}</p>
        </div>
      </div>

      <PrintTrigger />
    </div>
  );
}
