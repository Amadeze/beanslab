import { Prisma } from "@prisma/client";
import {
  sendPaymentProofSubmittedEmail,
  sendPaymentProofSubmittedWhatsApp,
  sendPaymentReviewEmail,
  sendPaymentReviewWhatsApp,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const PAYMENT_PROOF_SUBMITTED = "PAYMENT_PROOF_SUBMITTED";
export const PAYMENT_STATUS_UPDATED = "PAYMENT_STATUS_UPDATED";

type DeliveryResult = { success: boolean; error?: unknown; data?: unknown; mocked?: boolean };

function appUrl(path: string) {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1_000);
  try {
    return JSON.stringify(error).slice(0, 1_000);
  } catch {
    return String(error).slice(0, 1_000);
  }
}

async function channelEnabled(tenantId: string, channel: "EMAIL" | "WHATSAPP", event: string) {
  const preference = await prisma.notificationPreference.findUnique({
    where: { tenantId_channel_event: { tenantId, channel, event } },
    select: { enabled: true },
  });
  return preference?.enabled ?? true;
}

async function deliver(input: {
  tenantId: string;
  paymentSubmissionId: string;
  event: string;
  channel: "EMAIL" | "WHATSAPP";
  recipient: string | null | undefined;
  attempt: number;
  send: () => Promise<DeliveryResult>;
}) {
  const recipient = input.recipient?.trim();
  if (!recipient || !(await channelEnabled(input.tenantId, input.channel, input.event))) return;

  let delivery: { id: string };
  try {
    delivery = await prisma.paymentNotificationDelivery.create({
      data: {
        tenantId: input.tenantId,
        paymentSubmissionId: input.paymentSubmissionId,
        event: input.event,
        channel: input.channel,
        recipient,
        attempt: input.attempt,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }

  try {
    const result = await input.send();
    await prisma.paymentNotificationDelivery.update({
      where: { id: delivery.id },
      data: result.success
        ? { status: "SENT", sentAt: new Date(), error: null }
        : { status: "FAILED", error: errorMessage(result.error || "Provider menolak pengiriman.") },
    });
  } catch (error) {
    await prisma.paymentNotificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", error: errorMessage(error) },
    });
  }
}

export async function dispatchPaymentProofSubmittedNotifications(paymentSubmissionId: string) {
  const submission = await prisma.paymentSubmission.findUnique({
    where: { id: paymentSubmissionId },
    select: {
      id: true,
      tenantId: true,
      declaredAmount: true,
      amount: true,
      submissionAttempt: true,
      invoice: { select: { code: true, customer: { select: { name: true } } } },
      tenant: { select: { name: true, contactEmail: true, whatsappNumber: true } },
    },
  });
  if (!submission) return;
  const declaredAmount = Number(submission.declaredAmount || submission.amount);
  const reviewUrl = appUrl("/penjualan/pembayaran");
  await Promise.all([
    deliver({
      tenantId: submission.tenantId,
      paymentSubmissionId: submission.id,
      event: PAYMENT_PROOF_SUBMITTED,
      channel: "EMAIL",
      recipient: submission.tenant.contactEmail,
      attempt: submission.submissionAttempt,
      send: () => sendPaymentProofSubmittedEmail({
        to: submission.tenant.contactEmail!,
        tenantName: submission.tenant.name,
        invoiceCode: submission.invoice.code,
        customerName: submission.invoice.customer.name,
        declaredAmount,
        reviewUrl,
      }),
    }),
    deliver({
      tenantId: submission.tenantId,
      paymentSubmissionId: submission.id,
      event: PAYMENT_PROOF_SUBMITTED,
      channel: "WHATSAPP",
      recipient: submission.tenant.whatsappNumber,
      attempt: submission.submissionAttempt,
      send: () => sendPaymentProofSubmittedWhatsApp({
        phone: submission.tenant.whatsappNumber!,
        invoiceCode: submission.invoice.code,
        customerName: submission.invoice.customer.name,
        declaredAmount,
        reviewUrl,
      }),
    }),
  ]);
}

export async function dispatchPaymentReviewNotifications(paymentSubmissionId: string) {
  const submission = await prisma.paymentSubmission.findUnique({
    where: { id: paymentSubmissionId },
    select: {
      id: true,
      tenantId: true,
      publicToken: true,
      status: true,
      reviewedAmount: true,
      rejectionReason: true,
      submissionAttempt: true,
      invoice: {
        select: {
          code: true,
          customer: { select: { name: true, email: true, phone: true } },
        },
      },
      tenant: { select: { name: true, subdomain: true } },
    },
  });
  if (!submission || (submission.status !== "VERIFIED" && submission.status !== "REJECTED")) return;

  const orderUrl = appUrl(`/tenant/${submission.tenant.subdomain}/order/${submission.publicToken}`);
  const common = {
    customerName: submission.invoice.customer.name,
    invoiceCode: submission.invoice.code,
    tenantName: submission.tenant.name,
    status: submission.status,
    appliedAmount: Number(submission.reviewedAmount || 0),
    reason: submission.rejectionReason,
    orderUrl,
  } as const;
  await Promise.all([
    deliver({
      tenantId: submission.tenantId,
      paymentSubmissionId: submission.id,
      event: PAYMENT_STATUS_UPDATED,
      channel: "EMAIL",
      recipient: submission.invoice.customer.email,
      attempt: submission.submissionAttempt,
      send: () => sendPaymentReviewEmail({ ...common, to: submission.invoice.customer.email! }),
    }),
    deliver({
      tenantId: submission.tenantId,
      paymentSubmissionId: submission.id,
      event: PAYMENT_STATUS_UPDATED,
      channel: "WHATSAPP",
      recipient: submission.invoice.customer.phone,
      attempt: submission.submissionAttempt,
      send: () => sendPaymentReviewWhatsApp({ ...common, phone: submission.invoice.customer.phone! }),
    }),
  ]);
}
