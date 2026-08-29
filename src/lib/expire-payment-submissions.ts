import { type PrismaClient } from "@prisma/client";
import { releaseInvoiceReservations } from "./storefront-commerce";
import { getCurrentDate } from "./date-utils";
import { postVoidReversal } from "./posting";

export async function expirePaymentSubmissions(
  prisma: PrismaClient,
  now = getCurrentDate(),
) {
  const expiredSubmissions = await prisma.paymentSubmission.findMany({
    where: {
      status: { in: ["AWAITING_PROOF", "AWAITING_VERIFICATION"] },
      expiresAt: { lt: now },
    },
    include: {
      invoice: {
        select: {
          id: true,
          code: true,
          tenantId: true,
          status: true,
          paidAmount: true,
          createdById: true,
        },
      },
    },
    take: 500,
  });

  const result = {
    expiredCount: 0,
    releasedReservations: 0,
    voidedInvoices: 0,
    errors: [] as string[],
  };

  for (const submission of expiredSubmissions) {
    try {
      await prisma.$transaction(async (tx) => {
        // Update submission status to EXPIRED
        await tx.paymentSubmission.update({
          where: { id: submission.id },
          data: { status: "EXPIRED" },
        });

        const invoice = submission.invoice;
        if (!invoice) return;

        // Only release reservations if invoice is not paid
        if (invoice.status !== "PAID" && Number(invoice.paidAmount) === 0) {
          await releaseInvoiceReservations(tx, invoice.id, "EXPIRED", now);
          result.releasedReservations += 1;

          // If invoice has SALE_FG_OUT ledger entries, void the invoice
          const saleEntries = await tx.inventoryLedger.findMany({
            where: {
              tenantId: invoice.tenantId,
              refId: invoice.id,
              refType: "SALE_FG_OUT",
              entryType: "OUT",
            },
          });

          if (saleEntries.length > 0) {
            for (const entry of saleEntries) {
              await tx.inventoryLedger.create({
                data: {
                  tenantId: invoice.tenantId,
                  productId: entry.productId,
                  entryType: "IN",
                  refType: "VOID_REVERSAL",
                  refId: invoice.id,
                  reversalOfLedgerId: entry.id,
                  quantityUnit: entry.quantityUnit,
                  lotId: entry.lotId,
                  lotNumber: entry.lotNumber,
                  expiryDate: entry.expiryDate,
                  notes: `Payment submission expired: ${invoice.code}`,
                  createdById: invoice.createdById,
                },
              });
              if (entry.lotId) {
                await tx.lot.update({ where: { id: entry.lotId }, data: { consumedAt: null } });
              }
            }
            await postVoidReversal("INVOICE", invoice.id, "Payment submission expired", {
              tx,
              tenantId: invoice.tenantId,
              userId: invoice.createdById,
              date: now,
            });
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: "VOID", fulfillmentStatus: "CANCELLED", voidReason: "Payment submission expired", voidAt: now },
            });
            result.voidedInvoices += 1;
          }
        }
      });

      result.expiredCount += 1;
    } catch (err) {
      result.errors.push(`Submission ${submission.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}