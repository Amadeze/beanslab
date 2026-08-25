import Link from "next/link";
import { PackageCheck, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { EmptyState } from "@/components/shared";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { STOREFRONT_GRIND_LABEL } from "@/lib/storefront-grind";
import { getSalesChannelLabel } from "@/lib/sales-channel";
import { fulfillmentExecution } from "@/lib/operations-execution";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Menunggu bayar", NEEDS_PRODUCTION: "Perlu produksi",
  READY_TO_PACK: "Siap dikemas", PACKED: "Dikemas", SHIPPED: "Dikirim", DELIVERED: "Selesai",
};

export default async function FulfillmentPage() {
  await requireRole("OWNER", "MANAGER", "OPERATOR", "CASHIER");
  const tp = await requireTenantPrisma();
  const invoices = await tp.invoice.findMany({
    where: { voidAt: null, fulfillmentStatus: { in: ["AWAITING_PAYMENT", "NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED", "SHIPPED"] } },
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
      fulfillmentTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true, shortageQuantity: true, product: { select: { id: true, name: true, type: true, materialOrigin: true } } } },
    },
  });
  const productionUnits = invoices.flatMap((invoice) => invoice.fulfillmentTasks).reduce((sum, task) => sum + task.shortageQuantity, 0);

  return <div className="flex min-h-0 flex-1 flex-col">
    <PageHeader
      title="Pemenuhan Pesanan"
      eyebrow="Penjualan"
      description={`${invoices.length} pesanan aktif · ${productionUnits} unit masih perlu diproduksi.`}
      stage="sales"
      actions={
        <Link
          href="/gudang"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
        >
          <Warehouse size={14} /> Buka Gudang
        </Link>
      }
    />
    <WorkspaceNav kind="sales" />
    <div className="custom-scrollbar flex-1 overflow-auto"><div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
      {invoices.length === 0 ? <EmptyState label="Semua pesanan sudah ditindaklanjuti" description="Pesanan baru yang menunggu pembayaran, produksi, pengemasan, atau pengiriman akan muncul di sini." icon={<PackageCheck size={21} />} /> : <div className="grid gap-3">
        {invoices.map((invoice) => <article key={invoice.id} className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-ink">{invoice.code}</strong><span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-bold uppercase text-ink-secondary">{statusLabel[invoice.fulfillmentStatus]}</span><span className="rounded-full border border-border px-2.5 py-1 text-xs font-bold uppercase text-ink-tertiary">{getSalesChannelLabel(invoice.salesChannel)}</span></div><p className="mt-1 text-xs text-ink-tertiary">{invoice.customer.name} · {invoice.issuedAt.toLocaleString("id-ID")}</p>
          <ul className="mt-3 grid gap-2 text-xs text-ink-secondary">{invoice.items.map((item) => {
            const totalKg = item.netWeightGrams ? Number(item.quantity) * Number(item.netWeightGrams) / 1000 : null;
            return <li key={item.id} className="rounded-lg bg-surface-sunken px-3 py-2">
              <strong className="text-ink">{item.quantity}× {item.offeringName ?? item.product.name}</strong>
              <span>{item.packageName ? ` · ${item.packageName}` : ""}{totalKg ? ` · ${totalKg.toLocaleString("id-ID")} kg total` : ""}</span>
              <span className="block text-ink-tertiary">
                {item.roastLevel ? `${item.roastLevel.replaceAll("_", " ")} · ` : ""}
                {item.grindSize ? (item.grindSize === "CUSTOM" ? item.customGrindLabel : STOREFRONT_GRIND_LABEL[item.grindSize]) : "Biji utuh"}
                {item.offeringName ? ` · material ${item.product.name} (${item.product.materialOrigin === "INTERNAL_ROAST" ? "sangrai sendiri" : "beli jadi"})` : ""}
              </span>
            </li>;
          })}</ul>
          {invoice.fulfillmentTasks.length ? <ul className="mt-3 grid gap-1 text-xs text-[var(--status-warning)]">{invoice.fulfillmentTasks.map((task) => {
            const requiredKg = invoice.items.filter((item) => item.productId === task.product.id).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.netWeightGrams ?? 0) / 1000), 0);
            const reservedKg = invoice.stockReservations.filter((reservation) => reservation.productId === task.product.id).reduce((sum, reservation) => sum + Number(reservation.quantityKg ?? 0), 0);
            const missingKg = Math.max(0, requiredKg - reservedKg);
            const work = task.product.type === "FINISHED_GOODS"
              ? "Produksi"
              : task.product.materialOrigin === "INTERNAL_ROAST"
                ? "Sangrai"
                : "Tambah stok";
            return <li key={task.id}>{work} {missingKg > 0 ? `${missingKg.toLocaleString("id-ID")} kg` : `${task.shortageQuantity} unit`} · {task.product.name}</li>;
          })}</ul> : invoice.trackingNumber ? <p className="mt-2 text-xs text-[var(--status-success)]">Resi {invoice.trackingNumber}</p> : null}</div>
          <div className="flex flex-wrap gap-2">{invoice.fulfillmentTasks.length ? invoice.fulfillmentTasks.map((task) => {
            const requiredKg = invoice.items.filter((item) => item.productId === task.product.id).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.netWeightGrams ?? 0) / 1000), 0);
            const reservedKg = invoice.stockReservations.filter((reservation) => reservation.productId === task.product.id).reduce((sum, reservation) => sum + Number(reservation.quantityKg ?? 0), 0);
            const action = fulfillmentExecution({
              productId: task.product.id,
              productType: task.product.type,
              materialOrigin: task.product.materialOrigin,
              shortageUnits: task.shortageQuantity,
              missingKg: Math.max(0, requiredKg - reservedKg),
            });
            return <Link key={task.id} href={action.href} className="inline-flex min-h-9 items-center rounded-lg bg-[var(--status-warning)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--status-warning)]">{action.label}</Link>;
          }) : null}<Link href="/penjualan" className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-surface-sunken">Buka pesanan</Link></div>
        </article>)}
      </div>}
    </div></div>
  </div>;
}
