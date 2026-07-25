import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { decryptCredential } from "@/lib/credentials";
import { Prisma } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { getCurrentDate } from "@/lib/date-utils";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";
import {
  claimWebhookEvent,
  PermanentWebhookError,
  timingSafeEqualText,
} from "@/lib/webhook-inbox";

type MidtransWebhookPayload = {
  order_id?: string;
  signature_key?: string;
  status_code?: string;
  gross_amount?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
};

function isSuccessfulPayment(transactionStatus?: string, fraudStatus?: string) {
  if (transactionStatus === "settlement") return true;
  if (transactionStatus === "capture") return fraudStatus === "accept";
  return false;
}

function toPaymentMethod(paymentType?: string) {
  return paymentType?.toLowerCase().includes("qris") ? "QRIS" : "TRANSFER";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req.headers);
  let webhookEventId: string | null = null;
  try {
    const data = (await req.json()) as MidtransWebhookPayload;
    const orderId = data.order_id;
    const signatureKey = data.signature_key;
    const statusCode = data.status_code;
    const grossAmount = data.gross_amount;
    const transactionStatus = data.transaction_status;
    const fraudStatus = data.fraud_status;

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }
    if (!signatureKey || !statusCode || !grossAmount) {
      return NextResponse.json({ error: "Incomplete Midtrans payload" }, { status: 400 });
    }

    // Find the invoice to get the tenant's Server Key
    const invoice = await prisma.invoice.findUnique({
      where: { midtransOrderId: orderId },
      include: { tenant: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const serverKey = decryptCredential(invoice.tenant.midtransServerKey);
    if (!serverKey) {
      return NextResponse.json({ error: "Tenant Midtrans server key is not configured" }, { status: 400 });
    }

    // Verify Signature Key using Tenant's Server Key
    const hash = crypto.createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    if (!timingSafeEqualText(hash, signatureKey)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const paidAmount = Number(grossAmount);
    const expectedAmount = Number(invoice.grandTotal);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - expectedAmount) > 0.01) {
      return NextResponse.json({ error: "Payment amount does not match invoice total" }, { status: 400 });
    }

    const eventId = `${orderId}:${transactionStatus || "unknown"}:${data.transaction_id || statusCode}`;
    const claim = await claimWebhookEvent(prisma, {
      tenantId: invoice.tenantId,
      provider: "MIDTRANS_TENANT",
      eventId,
      eventType: transactionStatus || "unknown",
      payload: data as Prisma.InputJsonValue,
    });
    webhookEventId = claim.eventId;
    if (!claim.claimed) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    // Update Invoice Status
    if (isSuccessfulPayment(transactionStatus, fraudStatus)) {
      // Create Payment Record
      await prisma.$transaction(async (tx) => {
        const freshInvoice = await tx.invoice.findFirst({
          where: { id: invoice.id, tenantId: invoice.tenantId },
          select: { id: true, grandTotal: true, status: true, paidAmount: true },
        });

        if (!freshInvoice || freshInvoice.status === "VOID") {
          throw new PermanentWebhookError("Invoice is no longer payable");
        }

        if (freshInvoice.status === "PAID") {
          await tx.webhookEvent.update({
            where: { id: webhookEventId! },
            data: { status: "PROCESSED", processedAt: getCurrentDate() },
          });
          return;
        }
        const previousPaid = Number(freshInvoice.paidAmount);
        if (previousPaid + paidAmount > Number(freshInvoice.grandTotal) + 0.01) {
          throw new PermanentWebhookError(
            "Payment would exceed the remaining invoice balance.",
          );
        }

        const reference = `Midtrans:${orderId}:${data.transaction_id || transactionStatus || "success"}`;
        const existingPayment = await tx.payment.findFirst({
          where: {
            tenantId: invoice.tenantId,
            invoiceId: invoice.id,
            reference,
          },
          select: { id: true },
        });

        if (existingPayment) {
          await tx.webhookEvent.update({
            where: { id: webhookEventId! },
            data: { status: "PROCESSED", processedAt: getCurrentDate() },
          });
          return;
        }

        const rawSettlement = (data as { settlement_time?: string }).settlement_time;
        const paidAtDate = rawSettlement ? new Date(rawSettlement) : new Date();
        const paidAt = !isNaN(paidAtDate.getTime()) ? paidAtDate : new Date();

        const payment = await tx.payment.create({
          data: {
            code: `PAY-${invoice.tenant.code}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
            invoiceId: invoice.id,
            amount: paidAmount,
            method: toPaymentMethod(data.payment_type),
            reference,
            paidAt,
            tenantId: invoice.tenantId,
            createdById: invoice.createdById, 
          }
        });

        // Update Invoice status to PAID
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { 
            status: "PAID",
            paidAmount: previousPaid + paidAmount,
          }
        });
        await recordAudit(tx, {
          tenantId: invoice.tenantId,
          userId: invoice.createdById,
          action: "CREATE_WEBHOOK",
          entityType: "Payment",
          entityId: payment.id,
          after: {
            code: payment.code,
            invoiceId: invoice.id,
            amount: paidAmount,
            method: payment.method,
          },
          metadata: { provider: "MIDTRANS" },
        });
        await tx.webhookEvent.update({
          where: { id: webhookEventId! },
          data: { status: "PROCESSED", processedAt: getCurrentDate() },
        });
      });
    } else {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId! },
        data: { status: "IGNORED", processedAt: getCurrentDate() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const permanent = error instanceof PermanentWebhookError;
    if (permanent) {
      console.warn(JSON.stringify({
        level: "warn",
        scope: "webhook.tenant-midtrans",
        requestId,
        timestamp: getCurrentDate().toISOString(),
        errorMessage: error.message,
      }));
    } else {
      logServerError("webhook.tenant-midtrans", error, { requestId });
    }
    if (webhookEventId) {
      await prisma.webhookEvent
        .update({
          where: { id: webhookEventId },
          data: {
            status: permanent ? "IGNORED" : "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
            processedAt: getCurrentDate(),
          },
        })
        .catch(() => undefined);
    }
    if (permanent) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: error.statusCode, headers: { "X-Request-Id": requestId } },
      );
    }
    return internalErrorResponse(requestId, "Webhook gagal diproses.");
  }
}
