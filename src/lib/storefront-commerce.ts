import { appendFefoLedgerOut } from "./stock";
import { postSalesInvoice } from "./posting";

// Kept structural so the helper works with both PrismaClient and a transaction client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StorefrontTx = any;

export type StorefrontRules = {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  flatShippingRate: number;
  freeShippingMinimum: number | null;
  taxRate: number;
};

export function calculateStorefrontTotals(
  subtotal: number,
  shippingMethod: "PICKUP" | "LOCAL_DELIVERY" | "STORE_COURIER" | "COURIER",
  rules: StorefrontRules,
) {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error("Subtotal tidak valid.");
  const pickup = shippingMethod === "PICKUP";
  if (pickup && !rules.pickupEnabled) throw new Error("Pengambilan di lokasi sedang tidak tersedia.");
  if (!pickup && !rules.deliveryEnabled) throw new Error("Pengiriman sedang tidak tersedia.");

  const freeShipping = !pickup
    && rules.freeShippingMinimum !== null
    && subtotal >= rules.freeShippingMinimum;
  const shippingCost = pickup || freeShipping ? 0 : Math.max(0, Math.round(rules.flatShippingRate));
  const tax = Math.max(0, Math.round(subtotal * Math.max(0, rules.taxRate) / 100));
  return { subtotal, tax, shippingCost, grandTotal: subtotal + tax + shippingCost };
}

export async function reserveInvoiceStock(
  tx: StorefrontTx,
  input: {
    tenantId: string;
    invoiceId: string;
    expiresAt: Date;
    items: Array<{ productId: string; quantity: number }>;
  },
) {
  let hasShortage = false;
  for (const item of input.items) {
    const [product, active] = await Promise.all([
      tx.product.findUnique({ where: { id: item.productId }, select: { stockUnit: true } }),
      tx.stockReservation.aggregate({
        where: { tenantId: input.tenantId, productId: item.productId, status: "ACTIVE" },
        _sum: { quantity: true },
      }),
    ]);
    const available = Math.max(0, Number(product?.stockUnit ?? 0) - Number(active._sum.quantity ?? 0));
    const reserved = Math.min(item.quantity, available);
    const shortage = item.quantity - reserved;
    hasShortage ||= shortage > 0;

    if (reserved > 0) {
      await tx.stockReservation.create({
        data: {
          tenantId: input.tenantId,
          invoiceId: input.invoiceId,
          productId: item.productId,
          quantity: reserved,
          expiresAt: input.expiresAt,
        },
      });
    }
    if (shortage > 0) {
      await tx.fulfillmentTask.create({
        data: {
          tenantId: input.tenantId,
          invoiceId: input.invoiceId,
          productId: item.productId,
          requestedQuantity: item.quantity,
          reservedQuantity: reserved,
          shortageQuantity: shortage,
          notes: "Dibuat otomatis dari checkout storefront; prioritaskan produksi dan packing.",
        },
      });
    }
  }
  return { hasShortage };
}

export async function markInvoicePaidForFulfillment(
  tx: StorefrontTx,
  input: { tenantId: string; invoiceId: string; invoiceCode: string; createdById: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const openTasks = await tx.fulfillmentTask.count({
    where: { tenantId: input.tenantId, invoiceId: input.invoiceId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  await tx.invoice.update({
    where: { id: input.invoiceId },
    data: {
      paidAt: now,
      fulfillmentStatus: openTasks > 0 ? "NEEDS_PRODUCTION" : "READY_TO_PACK",
    },
  });
  return { consumedReservations: 0, hasOpenTasks: openTasks > 0 };
}

export async function fulfillInvoiceAtHandover(
  tx: StorefrontTx,
  input: { tenantId: string; invoiceId: string; createdById: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const invoice = await tx.invoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
    include: {
      customer: { select: { name: true } },
      items: { select: { productId: true, quantity: true, hpp: true, product: { select: { type: true } } } },
    },
  });
  if (!invoice) throw new Error("Invoice tidak ditemukan.");
  if (invoice.fulfillmentStatus === "DELIVERED") return { alreadyFulfilled: true };
  if (invoice.status === "VOID" || invoice.status === "RETURNED") throw new Error("Invoice tidak dapat diserahkan.");

  const openTasks = await tx.fulfillmentTask.count({
    where: { tenantId: input.tenantId, invoiceId: invoice.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  if (openTasks > 0) throw new Error("Produksi untuk pesanan ini belum selesai.");

  const reservations = await tx.stockReservation.findMany({
    where: { tenantId: input.tenantId, invoiceId: invoice.id, status: "ACTIVE" },
  });
  const reservedByProduct = new Map<string, number>();
  for (const reservation of reservations) {
    reservedByProduct.set(reservation.productId, (reservedByProduct.get(reservation.productId) ?? 0) + Number(reservation.quantity));
  }
  for (const item of invoice.items) {
    if ((reservedByProduct.get(item.productId) ?? 0) < Number(item.quantity)) {
      throw new Error("Stok pesanan belum seluruhnya dialokasikan.");
    }
  }

  for (const reservation of reservations) {
    await appendFefoLedgerOut(tx, {
      tenantId: input.tenantId,
      productId: reservation.productId,
      refType: "SALE_FG_OUT",
      refId: invoice.id,
      quantityUnit: Number(reservation.quantity),
      notes: `Penyerahan pesanan: ${invoice.code}`,
      createdById: input.createdById,
    });
    await tx.stockReservation.update({
      where: { id: reservation.id },
      data: { status: "CONSUMED", consumedAt: now },
    });
  }
  await postSalesInvoice(
    invoice.id,
    Number(invoice.grandTotal),
    Number(invoice.paidAmount),
    invoice.customer.name,
    invoice.items.map((item: { product: { type: string }; hpp: unknown; quantity: unknown }) => ({
      productType: item.product.type,
      hpp: Number(item.hpp),
      quantity: Number(item.quantity),
    })),
    { tx, tenantId: input.tenantId, userId: input.createdById },
    Number(invoice.tax),
  );
  await tx.invoice.update({
    where: { id: invoice.id },
    data: { fulfillmentStatus: "DELIVERED", deliveredAt: now },
  });
  return { alreadyFulfilled: false, fulfilledReservations: reservations.length };
}

export async function releaseInvoiceReservations(
  tx: StorefrontTx,
  invoiceId: string,
  status: "RELEASED" | "EXPIRED" = "RELEASED",
  now = new Date(),
) {
  await tx.stockReservation.updateMany({
    where: { invoiceId, status: "ACTIVE" },
    data: { status, releasedAt: now },
  });
  await tx.fulfillmentTask.updateMany({
    where: { invoiceId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    data: { status: "CANCELLED" },
  });
  await tx.invoice.update({ where: { id: invoiceId }, data: { fulfillmentStatus: "CANCELLED" } });
}

export async function allocateProducedStockToDemand(
  tx: StorefrontTx,
  input: { tenantId: string; productId: string; createdById: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const [product, active] = await Promise.all([
    tx.product.findUnique({ where: { id: input.productId }, select: { stockUnit: true } }),
    tx.stockReservation.aggregate({
      where: { tenantId: input.tenantId, productId: input.productId, status: "ACTIVE" },
      _sum: { quantity: true },
    }),
  ]);
  let available = Math.max(0, Number(product?.stockUnit ?? 0) - Number(active._sum.quantity ?? 0));
  if (available === 0) return { allocatedUnits: 0, completedTasks: 0 };

  const tasks = await tx.fulfillmentTask.findMany({
    where: { tenantId: input.tenantId, productId: input.productId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    include: { invoice: { select: { id: true, code: true, status: true, createdById: true, reservationExpiresAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  let allocatedUnits = 0;
  let completedTasks = 0;
  for (const task of tasks) {
    if (available <= 0) break;
    if (task.invoice.status === "VOID" || task.invoice.status === "RETURNED") {
      await tx.fulfillmentTask.update({ where: { id: task.id }, data: { status: "CANCELLED" } });
      continue;
    }
    const allocated = Math.min(available, task.shortageQuantity);
    await tx.stockReservation.upsert({
        where: { invoiceId_productId: { invoiceId: task.invoiceId, productId: input.productId } },
        create: {
          tenantId: input.tenantId, invoiceId: task.invoiceId, productId: input.productId,
          quantity: allocated, expiresAt: task.invoice.reservationExpiresAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1_000),
        },
        update: { quantity: { increment: allocated }, status: "ACTIVE", releasedAt: null },
    });
    const shortageQuantity = task.shortageQuantity - allocated;
    const completed = shortageQuantity === 0;
    await tx.fulfillmentTask.update({
      where: { id: task.id },
      data: {
        reservedQuantity: { increment: allocated }, shortageQuantity,
        status: completed ? "COMPLETED" : "IN_PROGRESS", completedAt: completed ? now : null,
      },
    });
    if (completed) {
      completedTasks += 1;
      const remaining = await tx.fulfillmentTask.count({
        where: { invoiceId: task.invoiceId, id: { not: task.id }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      });
      if (remaining === 0) {
        await tx.invoice.update({
          where: { id: task.invoiceId },
          data: { fulfillmentStatus: task.invoice.status === "PAID" ? "READY_TO_PACK" : "AWAITING_PAYMENT" },
        });
      }
    }
    available -= allocated;
    allocatedUnits += allocated;
  }
  return { allocatedUnits, completedTasks };
}
