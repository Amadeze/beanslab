import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { EmptyState } from "@/components/shared";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { STOREFRONT_GRIND_LABEL } from "@/lib/storefront-grind";
import { getSalesChannelLabel } from "@/lib/sales-channel";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Menunggu bayar", NEEDS_PRODUCTION: "Perlu produksi",
  READY_TO_PACK: "Siap dikemas", PACKED: "Dikemas", SHIPPED: "Dikirim", DELIVERED: "Selesai",
};

export default async function FulfillmentPage() {
  await requireRole("OWNER", "MANAGER", "OPERATOR", "CASHIER");
  const tp = await requireTenantPrisma();
  const invoices = await tp.invoice.findMany({
    where: { fulfillmentStatus: { in: ["AWAITING_PAYMENT", "NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED", "SHIPPED"] } },
    orderBy: { issuedAt: "asc" },
    take: 200,
    select: {
      id: true, code: true, salesChannel: true, fulfillmentStatus: true, issuedAt: true, trackingNumber: true,
      customer: { select: { name: true } },
      items: { select: {
        id: true, productId: true, quantity: true, grindSize: true, customGrindLabel: true,
        offeringName: true, packageName: true, netWeightGrams: true, roastLevel: true,
        product: { select: { name: true, materialOrigin: true } },
      } },
      stockReservations: { where: { status: "ACTIVE" }, select: { productId: true, quantityKg: true } },
      fulfillmentTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true, shortageQuantity: true, product: { select: { id: true, name: true, materialOrigin: true } } } },
    },
  });
  const productionUnits = invoices.flatMap((invoice) => invoice.fulfillmentTasks).reduce((sum, task) => sum + task.shortageQuantity, 0);

  return <div className="flex min-h-0 flex-1 flex-col">
    <PageHeader title="Pemenuhan Pesanan" eyebrow="Penjualan" description={`${invoices.length} pesanan aktif · ${productionUnits} unit masih perlu diproduksi.`} />
    <WorkspaceNav kind="sales" />
    <div className="custom-scrollbar flex-1 overflow-auto"><div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
      {invoices.length === 0 ? <EmptyState label="Semua pesanan sudah ditindaklanjuti" description="Pesanan baru yang menunggu pembayaran, produksi, pengemasan, atau pengiriman akan muncul di sini." icon={<PackageCheck size={21} />} /> : <div className="grid gap-3">
        {invoices.map((invoice) => <article key={invoice.id} className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-stone-900">{invoice.code}</strong><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold uppercase text-stone-600">{statusLabel[invoice.fulfillmentStatus]}</span><span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-bold uppercase text-stone-500">{getSalesChannelLabel(invoice.salesChannel)}</span></div><p className="mt-1 text-xs text-stone-500">{invoice.customer.name} · {invoice.issuedAt.toLocaleString("id-ID")}</p>
          <ul className="mt-3 grid gap-2 text-xs text-stone-600">{invoice.items.map((item) => {
            const totalKg = item.netWeightGrams ? Number(item.quantity) * Number(item.netWeightGrams) / 1000 : null;
            return <li key={item.id} className="rounded-lg bg-stone-50 px-3 py-2">
              <strong className="text-stone-900">{item.quantity}× {item.offeringName ?? item.product.name}</strong>
              <span>{item.packageName ? ` · ${item.packageName}` : ""}{totalKg ? ` · ${totalKg.toLocaleString("id-ID")} kg total` : ""}</span>
              <span className="block text-stone-500">
                {item.roastLevel ? `${item.roastLevel.replaceAll("_", " ")} · ` : ""}
                {item.grindSize ? (item.grindSize === "CUSTOM" ? item.customGrindLabel : STOREFRONT_GRIND_LABEL[item.grindSize]) : "Biji utuh"}
                {item.offeringName ? ` · material ${item.product.name} (${item.product.materialOrigin === "INTERNAL_ROAST" ? "sangrai sendiri" : "beli jadi"})` : ""}
              </span>
            </li>;
          })}</ul>
          {invoice.fulfillmentTasks.length ? <ul className="mt-3 grid gap-1 text-xs text-amber-800">{invoice.fulfillmentTasks.map((task) => {
            const requiredKg = invoice.items.filter((item) => item.productId === task.product.id).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.netWeightGrams ?? 0) / 1000), 0);
            const reservedKg = invoice.stockReservations.filter((reservation) => reservation.productId === task.product.id).reduce((sum, reservation) => sum + Number(reservation.quantityKg ?? 0), 0);
            const missingKg = Math.max(0, requiredKg - reservedKg);
            return <li key={task.id}>{task.product.materialOrigin === "INTERNAL_ROAST" ? "Sangrai" : "Tambah stok"} {missingKg > 0 ? `${missingKg.toLocaleString("id-ID")} kg` : `${task.shortageQuantity} unit`} · {task.product.name}</li>;
          })}</ul> : invoice.trackingNumber ? <p className="mt-2 text-xs text-emerald-700">Resi {invoice.trackingNumber}</p> : null}</div>
          <div className="flex flex-wrap gap-2">{invoice.fulfillmentTasks.length ? invoice.fulfillmentTasks.map((task) => <Link key={task.id} href={task.product.materialOrigin === "INTERNAL_ROAST" ? `/roasting?productId=${encodeURIComponent(task.product.id)}` : "/inventory?view=receiving"} className="inline-flex h-9 items-center rounded-lg bg-amber-700 px-3 text-xs font-bold text-white">{task.product.materialOrigin === "INTERNAL_ROAST" ? "Buka roasting" : "Terima stok"}</Link>) : null}<Link href="/penjualan" className="inline-flex h-9 items-center rounded-lg border border-stone-300 px-3 text-xs font-bold">Buka pesanan</Link></div>
        </article>)}
      </div>}
    </div></div>
  </div>;
}
