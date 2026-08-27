"use server";

import { getCurrentTenantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type InvoicePanelData = {
  code: string;
  status: string;
  fulfillmentStatus: string;
  salesChannel: string;
  customerName: string;
  issuedAt: string;
  dueDate: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  returnedAmount: number;
  balance: number;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  payments: Array<{ amount: number; paidAt: string; method: string }>;
} | null;

/** Ringkasan nota untuk panel konteks (read-only, tenant-scoped). */
export async function fetchInvoicePanelAction(
  invoiceId: string,
): Promise<InvoicePanelData> {
  const tenantId = await getCurrentTenantId();

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: {
      code: true,
      status: true,
      fulfillmentStatus: true,
      salesChannel: true,
      issuedAt: true,
      dueDate: true,
      subtotal: true,
      discount: true,
      tax: true,
      grandTotal: true,
      paidAmount: true,
      returnedAmount: true,
      customer: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } },
        },
        take: 8,
      },
      payments: {
        where: { voidAt: null },
        select: { amount: true, paidAt: true, method: true },
        orderBy: { paidAt: "desc" },
        take: 5,
      },
    },
  });
  if (!inv) return null;

  const grandTotal = Number(inv.grandTotal);
  const paidAmount = Number(inv.paidAmount);
  const returnedAmount = Number(inv.returnedAmount ?? 0);
  const balance = Math.max(0, grandTotal - paidAmount);

  return {
    code: inv.code,
    status: inv.status,
    fulfillmentStatus: inv.fulfillmentStatus,
    salesChannel: inv.salesChannel,
    customerName: inv.customer?.name ?? "-",
    issuedAt: inv.issuedAt.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    tax: Number(inv.tax),
    grandTotal,
    paidAmount,
    returnedAmount,
    balance,
    items: inv.items.map((it) => ({
      name: it.product?.name ?? "-",
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
    })),
    payments: inv.payments.map((p) => ({
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
      method: p.method,
    })),
  };
}
