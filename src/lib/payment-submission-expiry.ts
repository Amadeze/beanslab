import type { PrismaClient } from "@prisma/client";
import { recordAudit } from "./audit";
import { getCurrentDate } from "./date-utils";
import { postVoidReversal } from "./posting";
import { appendLedger } from "./stock";
import { releaseInvoiceReservations } from "./storefront-commerce";

export async function expirePaymentSubmissions(client: PrismaClient, now = getCurrentDate()) {
  const expired = await client.paymentSubmission.findMany({
    where: {
      status: { in: ["AWAITING_PROOF", "REJECTED"] },
      expiresAt: { lte: now },
    },
    select: { id: true },
    take: 500,
  });
  let voidedInvoices = 0;

  for (const candidate of expired) {
    await client.$transaction(async (tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id: candidate.id },
        include: { invoice: true },
      });
      if (!submission || !["AWAITING_PROOF", "REJECTED"].includes(submission.status)) return;
      if (submission.invoice.status === "PAID" || Number(submission.invoice.paidAmount) > 0) {
        await tx.paymentSubmission.update({ where: { id: submission.id }, data: { status: "EXPIRED" } });
        return;
      }
      if (submission.invoice.status !== "VOID") {
        const activeReservations = await tx.stockReservation.count({
          where: { invoiceId: submission.invoiceId, status: "ACTIVE" },
        });
        if (activeReservations > 0) {
          await releaseInvoiceReservations(tx, submission.invoiceId, "EXPIRED", now);
        }
        const alreadyReversed = await tx.inventoryLedger.count({
          where: { tenantId: submission.tenantId, refId: submission.invoiceId, refType: "VOID_REVERSAL" },
        });
        if (alreadyReversed === 0) {
          const saleEntries = await tx.inventoryLedger.findMany({
            where: { tenantId: submission.tenantId, refId: submission.invoiceId, refType: "SALE_FG_OUT", entryType: "OUT" },
          });
          for (const entry of saleEntries) {
            await appendLedger(tx, {
              data: {
                tenantId: submission.tenantId,
                productId: entry.productId,
                packagingId: entry.packagingId,
                entryType: "IN",
                refType: "VOID_REVERSAL",
                refId: submission.invoiceId,
                reversalOfLedgerId: entry.id,
                quantityKg: entry.quantityKg,
                quantityUnit: entry.quantityUnit,
                lotId: entry.lotId,
                lotNumber: entry.lotNumber,
                expiryDate: entry.expiryDate,
                notes: `Pesanan portal kedaluwarsa: ${submission.invoice.code}`,
                createdById: submission.invoice.createdById,
              },
            });
            if (entry.lotId) await tx.lot.update({ where: { id: entry.lotId }, data: { consumedAt: null } });
          }
        }
        const reason = "Pembayaran portal tidak diterima sampai batas waktu";
        await tx.invoice.update({
          where: { id: submission.invoiceId },
          data: { status: "VOID", fulfillmentStatus: "CANCELLED", voidReason: reason, voidAt: now },
        });
        const hasSalesJournal = await tx.journalEntry.count({
          where: { tenantId: submission.tenantId, refType: "INVOICE", reference: submission.invoiceId, voidAt: null },
        });
        if (hasSalesJournal > 0) {
          await postVoidReversal("INVOICE", submission.invoiceId, reason, {
            tx,
            tenantId: submission.tenantId,
            userId: submission.invoice.createdById,
          });
        }
        await recordAudit(tx, {
          tenantId: submission.tenantId,
          userId: submission.invoice.createdById,
          action: "VOID_EXPIRED",
          entityType: "Invoice",
          entityId: submission.invoiceId,
          before: { status: submission.invoice.status },
          after: { status: "VOID", reason },
          metadata: { provider: submission.provider, paymentSubmissionId: submission.id },
        });
        voidedInvoices += 1;
      }
      await tx.paymentSubmission.update({ where: { id: submission.id }, data: { status: "EXPIRED" } });
    }, { isolationLevel: "Serializable" });
  }

  const storefront = await expireUnpaidStorefrontOrders(client, now);
  return { expiredSubmissions: expired.length, voidedInvoices: voidedInvoices + storefront.voidedInvoices };
}

export async function expireUnpaidStorefrontOrders(client: PrismaClient, now = getCurrentDate()) {
  const candidates = await client.invoice.findMany({
    where: {
      publicOrderToken: { not: null },
      reservationExpiresAt: { lte: now },
      status: { in: ["DRAFT", "ISSUED"] },
      paidAmount: 0,
      stockReservations: { some: { status: "ACTIVE" } },
    },
    select: { id: true },
    take: 500,
  });
  let voidedInvoices = 0;
  for (const candidate of candidates) {
    await client.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: candidate.id } });
      if (!invoice || !["DRAFT", "ISSUED"].includes(invoice.status) || Number(invoice.paidAmount) > 0) return;
      const reason = "Reservasi storefront kedaluwarsa sebelum pembayaran diterima";
      await releaseInvoiceReservations(tx, invoice.id, "EXPIRED", now);
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "VOID", fulfillmentStatus: "CANCELLED", voidReason: reason, voidAt: now } });
      const hasSalesJournal = await tx.journalEntry.count({
        where: { tenantId: invoice.tenantId, refType: "INVOICE", reference: invoice.id, voidAt: null },
      });
      if (hasSalesJournal > 0) {
        await postVoidReversal("INVOICE", invoice.id, reason, { tx, tenantId: invoice.tenantId, userId: invoice.createdById });
      }
      await recordAudit(tx, {
        tenantId: invoice.tenantId, userId: invoice.createdById, action: "VOID_EXPIRED",
        entityType: "Invoice", entityId: invoice.id,
        before: { status: invoice.status }, after: { status: "VOID", reason },
        metadata: { source: "STOREFRONT_RESERVATION" },
      });
      voidedInvoices += 1;
    }, { isolationLevel: "Serializable" });
  }
  return { expiredOrders: candidates.length, voidedInvoices };
}
