import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { requireRole, requireTenantPrisma } from "@/lib/auth";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Menunggu bayar", NEEDS_PRODUCTION: "Perlu produksi",
  READY_TO_PACK: "Siap dikemas", PACKED: "Dikemas", SHIPPED: "Dikirim", DELIVERED: "Selesai",
};

export default async function FulfillmentPage() {
  await requireRole("OWNER", "MANAGER", "OPERATOR", "CASHIER");
  const tp = await requireTenantPrisma();
  const invoices = await tp.invoice.findMany({
    where: { fulfillmentStatus: { in: ["AWAITING_PAYMENT", "NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED", "SHIPPED"] }, publicOrderToken: { not: null } },
    orderBy: { issuedAt: "asc" },
    take: 200,
    select: {
      id: true, code: true, fulfillmentStatus: true, issuedAt: true, trackingNumber: true,
      customer: { select: { name: true } },
      fulfillmentTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true, shortageQuantity: true, product: { select: { name: true } } } },
    },
  });
  const productionUnits = invoices.flatMap((invoice) => invoice.fulfillmentTasks).reduce((sum, task) => sum + task.shortageQuantity, 0);

  return <div className="flex min-h-0 flex-1 flex-col">
    <PageHeader title="Fulfillment" eyebrow="Penjualan" description={`${invoices.length} pesanan aktif · ${productionUnits} unit masih perlu diproduksi.`} />
    <WorkspaceNav kind="sales" />
    <div className="custom-scrollbar flex-1 overflow-auto"><div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
      {invoices.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">Tidak ada pesanan storefront yang perlu ditindaklanjuti.</div> : <div className="grid gap-3">
        {invoices.map((invoice) => <article key={invoice.id} className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-stone-900">{invoice.code}</strong><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold uppercase text-stone-600">{statusLabel[invoice.fulfillmentStatus]}</span></div><p className="mt-1 text-xs text-stone-500">{invoice.customer.name} · {invoice.issuedAt.toLocaleString("id-ID")}</p>
          {invoice.fulfillmentTasks.length ? <ul className="mt-3 grid gap-1 text-xs text-amber-800">{invoice.fulfillmentTasks.map((task) => <li key={task.id}>Produksi {task.shortageQuantity} unit · {task.product.name}</li>)}</ul> : invoice.trackingNumber ? <p className="mt-2 text-xs text-emerald-700">Resi {invoice.trackingNumber}</p> : null}</div>
          <div className="flex gap-2">{invoice.fulfillmentTasks.length ? <Link href="/produksi" className="inline-flex h-9 items-center rounded-lg bg-amber-700 px-3 text-xs font-bold text-white">Buka produksi</Link> : null}<Link href="/penjualan" className="inline-flex h-9 items-center rounded-lg border border-stone-300 px-3 text-xs font-bold">Buka pesanan</Link></div>
        </article>)}
      </div>}
    </div></div>
  </div>;
}
