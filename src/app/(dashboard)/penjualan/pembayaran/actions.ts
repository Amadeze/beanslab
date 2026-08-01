"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { getSystemUserId, getCurrentTenantId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { getCurrentDate } from "@/lib/date-utils";
import { canReviewPayment, validatePaymentReview } from "@/lib/manual-payments";
import { postCustomerPayment } from "@/lib/posting";
import { dispatchPaymentReviewNotifications } from "@/lib/payment-notifications";
import { consumeInvoiceReservations } from "@/lib/storefront-commerce";

export type ReviewPaymentResult = { success: true } | { success: false; error: string };

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
      const outstanding = Number(submission.invoice.grandTotal) - Number(submission.invoice.paidAmount);
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
      const isPaid = paidAmount >= Number(submission.invoice.grandTotal) - 0.01;
      const remainingAmount = Math.max(0, Number(submission.invoice.grandTotal) - paidAmount);
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
        await consumeInvoiceReservations(tx, {
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

      await postCustomerPayment(payment.id, appliedAmount, submission.invoice.code, submission.invoice.customer.name, { tx, tenantId, userId });
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
    const submission = await tp.paymentSubmission.findUnique({ where: { id } });
    if (!submission || !canReviewPayment(submission.status)) return { success: false, error: "Bukti sudah diproses." };
    await tp.$transaction(async (tx) => {
      await tx.paymentSubmission.update({
        where: { id },
        data: { status: "REJECTED", reviewedAmount: null, rejectionReason: cleanReason, reviewedAt: getCurrentDate(), reviewedById: user.id },
      });
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
  } catch {
    return { success: false, error: "Bukti pembayaran gagal ditolak." };
  }
}
