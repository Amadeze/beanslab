import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { Prisma, PaymentStatus } from "@prisma/client";
import { claimWebhookEvent, timingSafeEqualText } from "@/lib/webhook-inbox";
import { addMonthsPreservingBillingDay, getCurrentDate } from "@/lib/date-utils";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

type MidtransSubscriptionNotification = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
};

export async function POST(req: Request) {
  const requestId = getRequestId(req.headers);
  let webhookEventId: string | null = null;
  try {
    const data = (await req.json()) as MidtransSubscriptionNotification;
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const signatureKey = data.signature_key;
    const orderId = data.order_id;
    const statusCode = data.status_code;
    const grossAmount = data.gross_amount;

    if (!serverKey) {
      return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
    }

    if (!signatureKey || !orderId || !statusCode || !grossAmount) {
      return NextResponse.json({ error: "Incomplete notification" }, { status: 400 });
    }

    const hash = crypto.createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    if (!timingSafeEqualText(hash, signatureKey)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { midtransOrderId: orderId },
      include: { tenant: { select: { nextBillingDate: true, trialEndsAt: true, createdAt: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (Math.abs(Number(grossAmount) - Number(payment.amount)) > 0.01) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const transactionStatus = data.transaction_status;
    const fraudStatus = data.fraud_status;
    const eventId = `${orderId}:${transactionStatus || "unknown"}:${statusCode}`;
    const claim = await claimWebhookEvent(prisma, {
      tenantId: payment.tenantId,
      provider: "MIDTRANS_SUBSCRIPTION",
      eventId,
      eventType: transactionStatus || "unknown",
      payload: data as Prisma.InputJsonValue,
    });
    webhookEventId = claim.eventId;
    if (!claim.claimed) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    let dbStatus: PaymentStatus = "PENDING";
    let isSuccess = false;

    if (transactionStatus == 'capture'){
      if (fraudStatus == 'challenge'){
        dbStatus = "PENDING";
      } else if (fraudStatus == 'accept'){
        dbStatus = "SUCCESS";
        isSuccess = true;
      }
    } else if (transactionStatus == 'settlement'){
      dbStatus = "SUCCESS";
      isSuccess = true;
    } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire'){
      dbStatus = "FAILED";
    } else if (transactionStatus == 'pending'){
      dbStatus = "PENDING";
    }

    await prisma.$transaction(async (tx) => {
      // Atomic guard: claim the transition to a non-SUCCESS state in a single
      // statement so concurrent notifications (capture + settlement race) can
      // never both extend the billing cycle.
      const guarded = await tx.subscriptionPayment.updateMany({
        where: { id: payment.id, status: { not: "SUCCESS" } },
        data: { status: dbStatus },
      });

      if (guarded.count === 0) {
        await tx.webhookEvent.update({
          where: { id: webhookEventId! },
          data: {
            status: isSuccess ? "PROCESSED" : "IGNORED",
            processedAt: getCurrentDate(),
          },
        });
        return;
      }

      if (!isSuccess) {
        await tx.webhookEvent.update({
          where: { id: webhookEventId! },
          data: { status: "IGNORED", processedAt: getCurrentDate() },
        });
        return;
      }

      const now = getCurrentDate();
      // Kebijakan siklus bulanan: hari dipertahankan, anchor ke trialEndsAt/createdAt
      // agar tanggal tagihan tidak menggeser (31 Jan → 28 Feb → 31 Mar, bukan 28 Mar).
      const tenant = payment.tenant;
      const anchorDate = tenant.trialEndsAt
        ? new Date(tenant.trialEndsAt)
        : tenant.createdAt
        ? new Date(tenant.createdAt)
        : now;
      // Hitung berapa bulan sudah lewat sejak anchor
      const monthsElapsed = Math.max(1, 
        (now.getFullYear() - anchorDate.getFullYear()) * 12 +
        (now.getMonth() - anchorDate.getMonth())
      );
      const nextBilling = addMonthsPreservingBillingDay(anchorDate, monthsElapsed + 1);

      await tx.tenant.update({
        where: { id: payment.tenantId },
        data: {
          subscriptionTier: payment.tier,
          subscriptionStatus: "ACTIVE",
          nextBillingDate: nextBilling
        }
      });
      await tx.webhookEvent.update({
        where: { id: webhookEventId! },
        data: { status: "PROCESSED", processedAt: getCurrentDate() },
      });
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    logServerError("webhook.superadmin-midtrans", error, { requestId });
    if (webhookEventId) {
      await prisma.webhookEvent
        .update({
          where: { id: webhookEventId },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
            processedAt: getCurrentDate(),
          },
        })
        .catch(() => undefined);
    }
    return internalErrorResponse(requestId, "Webhook gagal diproses.");
  }
}
