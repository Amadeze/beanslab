"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { getSystemUserId, getCurrentTenantId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { getCurrentDate } from "@/lib/date-utils";
import { canReviewPayment, validatePaymentReview } from "@/lib/manual-payments";
import { postCustomerPrepayment } from "@/lib/posting";
import { dispatchPaymentReviewNotifications } from "@/lib/payment-notifications";
import { markInvoicePaidForFulfillment } from "@/lib/storefront-commerce";
import { withSerializableRetry } from "@/lib/transaction-retry";

export type ReviewPaymentResult = { success: true } | { success: false; error: string };

class PaymentReviewError extends Error {}

export async function verifyPaymentSubmission(
  id: string,
  input: { appliedAmount: number; confirmDuplicate?: boolean },
): Promise<ReviewPaymentResult> {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();
    const now = getCurrentDate();
    const appliedAmount = Number(input.appliedAmount);
    if (!Number.isFinite(appliedAmount) || appliedAmount <= 0) {
      return { success: false, error: "Nominal yang diterapkan harus lebih dari nol." };
    }

    await tp.$transaction(async (tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id },
        include: { invoice: { include: { customer: { select: { name: true } } } } },
      });
      if (!submission || !canReviewPayment(submission.status)) {
        throw new Error("Bukti sudah diproses atau tidak dapat diverifikasi.");
      }
      if (submission.invoice.status === "VOID" || submission.invoice.status === "RETURNED") {
        throw new Error("Invoice tidak dapat menerima pembayaran.");
      }
      // Sisa tagihan = tagihan − bayar − retur (2F.2).
      const outstanding = Math.max(0, Number(submission.invoice.grandTotal) - Number(submission.invoice.paidAmount) - Number(submission.invoice.returnedAmount));
      const declaredAmount = Number(submission.declaredAmount || submission.amount);
      const validationError = validatePaymentReview({
        outstanding,
        declaredAmount,
        appliedAmount,
        suspectedDuplicate: Boolean(submission.suspectedDuplicateOfId),
        duplicateConfirmed: Boolean(input.confirmDuplicate),
      });
      if (validationError) throw new Error(validationError);

      const payCode = `PAY-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${randomBytes(4).toString("hex").toUpperCase()}`;
      const payment = await tx.payment.create({
        data: {
          tenantId,
          code: payCode,
          invoiceId: submission.invoiceId,
          amount: appliedAmount,
          method: submission.method,
          reference: submission.reference,
          paidAt: submission.submittedAt || now,
          notes: `Diverifikasi dari bukti pembayaran portal oleh ${submission.payerName || "pelanggan"}`,
          createdById: userId,
        },
      });
      const paidAmount = Number(submission.invoice.paidAmount) + appliedAmount;
      const isPaid = paidAmount >= Number(submission.invoice.grandTotal) - Number(submission.invoice.returnedAmount) - 0.01;
      const remainingAmount = Math.max(0, Number(submission.invoice.grandTotal) - Number(submission.invoice.returnedAmount) - paidAmount);
      await tx.invoice.update({
        where: { id: submission.invoiceId },
        data: { paidAmount, status: isPaid ? "PAID" : "PARTIAL" },
      });
      await tx.paymentSubmission.update({
        where: { id },
        data: {
          status: "VERIFIED",
          reviewedAmount: appliedAmount,
          reviewedAt: now,
          reviewedById: userId,
          paymentId: payment.id,
          rejectionReason: null,
        },
      });
      if (isPaid) {
        await markInvoicePaidForFulfillment(tx, {
          tenantId,
          invoiceId: submission.invoiceId,
          invoiceCode: submission.invoice.code,
          createdById: submission.invoice.createdById,
          now,
        });
      }
      const nextSubmission = !isPaid ? await tx.paymentSubmission.create({
        data: {
          tenantId,
          invoiceId: submission.invoiceId,
          paymentMethodId: submission.paymentMethodId,
          publicToken: randomBytes(24).toString("base64url"),
          provider: submission.provider,
          method: submission.method,
          amount: remainingAmount,
          destination: submission.destination ?? undefined,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
        },
        select: { id: true },
      }) : null;

      await postCustomerPrepayment(payment.id, appliedAmount, submission.invoice.code, submission.invoice.customer.name, { tx, tenantId, userId, date: now });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VERIFY",
        entityType: "PaymentSubmission",
        entityId: id,
        after: {
          status: "VERIFIED",
          paymentId: payment.id,
          declaredAmount,
          appliedAmount,
          duplicateConfirmed: Boolean(submission.suspectedDuplicateOfId && input.confirmDuplicate),
          nextSubmissionId: nextSubmission?.id || null,
          remainingAmount,
        },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/penjualan");
    revalidatePath("/penjualan/pembayaran");
    await dispatchPaymentReviewNotifications(id).catch((error) => {
      console.error("[verifyPaymentSubmission.notification]", error);
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Pembayaran gagal diverifikasi." };
  }
}

export async function rejectPaymentSubmission(id: string, reason: string): Promise<ReviewPaymentResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER", "CASHIER");
    const tp = await requireTenantPrisma();
    const cleanReason = reason.trim();
    if (cleanReason.length < 3 || cleanReason.length > 500) return { success: false, error: "Alasan penolakan wajib diisi." };
    const now = getCurrentDate();

    // Baca di dalam transaksi Serializable (bounded retry untuk P2034), cek
    // kepemilikan tenant, dan lakukan CAS pada status terbaru sehingga hanya
    // satu dari dua review paralel yang bisa berhasil.
    await withSerializableRetry(tp, async (tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id, tenantId: user.tenantId },
      });
      if (!submission || !canReviewPayment(submission.status)) {
        throw new PaymentReviewError("Bukti sudah diproses.");
      }
      const result = await tx.paymentSubmission.updateMany({
        where: { id, tenantId: user.tenantId, status: "AWAITING_VERIFICATION" },
        data: {
          status: "REJECTED",
          reviewedAmount: null,
          rejectionReason: cleanReason,
          reviewedAt: now,
          reviewedById: user.id,
        },
      });
      if (result.count !== 1) {
        throw new PaymentReviewError("Bukti sudah diproses.");
      }
      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "REJECT",
        entityType: "PaymentSubmission",
        entityId: id,
        after: { status: "REJECTED", reason: cleanReason },
      });
    });

    revalidatePath("/penjualan/pembayaran");
    await dispatchPaymentReviewNotifications(id).catch((error) => {
      console.error("[rejectPaymentSubmission.notification]", error);
    });
    return { success: true };
  } catch (error) {
    if (error instanceof PaymentReviewError) return { success: false, error: error.message };
    return { success: false, error: "Bukti pembayaran gagal ditolak." };
  }
}
