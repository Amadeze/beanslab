import { Prisma, type PrismaClient } from "@prisma/client";
import {
  sendOverdueReminderEmail,
  sendOverdueReminderWhatsApp,
} from "./notifications";
import { getTenantAccessState } from "./subscription";
import { getCurrentDate } from "@/lib/date-utils";

function reminderDate(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function sendOverdueReminders(
  prisma: PrismaClient,
  now = getCurrentDate(),
) {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIAL"] },
      dueDate: { lt: now },
      tenant: {
        isActive: true,
        subscriptionStatus: "ACTIVE",
      },
    },
    orderBy: { dueDate: "asc" },
    take: 500,
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      tenant: {
        select: {
          id: true,
          name: true,
          isActive: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          nextBillingDate: true,
        },
      },
    },
  });

  const date = reminderDate(now);
  const tenantIds = [...new Set(invoices.map((invoice) => invoice.tenantId))];
  const preferences = tenantIds.length > 0
    ? await prisma.notificationPreference.findMany({
        where: { tenantId: { in: tenantIds }, event: "OVERDUE_INVOICE" },
        select: { tenantId: true, channel: true, enabled: true },
      })
    : [];
  const preferenceMap = new Map(
    preferences.map((preference) => [
      `${preference.tenantId}:${preference.channel}`,
      preference.enabled,
    ]),
  );
  const channelEnabled = (tenantId: string, channel: string) =>
    preferenceMap.get(`${tenantId}:${channel}`) !== false;
  const result = {
    overdueInvoices: invoices.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const invoice of invoices) {
    if (getTenantAccessState(invoice.tenant, now) !== "ACTIVE") {
      result.skipped += 1;
      continue;
    }
    const balance = Number(invoice.grandTotal) - Number(invoice.paidAmount);
    if (balance <= 0.01) {
      result.skipped += 1;
      continue;
    }
    const channels = [
      channelEnabled(invoice.tenantId, "EMAIL") && process.env.RESEND_API_KEY && invoice.customer.email
        ? { channel: "EMAIL", destination: invoice.customer.email }
        : null,
      channelEnabled(invoice.tenantId, "WHATSAPP") && process.env.WA_API_KEY && invoice.customer.phone
        ? { channel: "WHATSAPP", destination: invoice.customer.phone }
        : null,
    ].filter((channel): channel is { channel: string; destination: string } => Boolean(channel));

    if (channels.length === 0) {
      result.skipped += 1;
      continue;
    }

    for (const channel of channels) {
      let deliveryId: string;
      try {
        const delivery = await prisma.reminderDelivery.create({
          data: {
            tenantId: invoice.tenantId,
            invoiceId: invoice.id,
            channel: channel.channel,
            reminderDate: date,
          },
        });
        deliveryId = delivery.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          result.skipped += 1;
          continue;
        }
        throw error;
      }

      try {
        const deliveryResult =
          channel.channel === "EMAIL"
            ? await sendOverdueReminderEmail({
                to: channel.destination,
                customerName: invoice.customer.name,
                invoiceCode: invoice.code,
                tenantName: invoice.tenant.name,
                balance,
                dueDate: invoice.dueDate!,
                paymentUrl: invoice.paymentUrl,
              })
            : await sendOverdueReminderWhatsApp({
                phone: channel.destination,
                customerName: invoice.customer.name,
                invoiceCode: invoice.code,
                tenantName: invoice.tenant.name,
                balance,
                paymentUrl: invoice.paymentUrl,
              });

        if (!deliveryResult.success) {
          throw new Error(JSON.stringify(deliveryResult.error));
        }
        await prisma.reminderDelivery.update({
          where: { id: deliveryId },
          data: { status: "SENT", sentAt: getCurrentDate() },
        });
        result.sent += 1;
      } catch (error) {
        await prisma.reminderDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown error",
          },
        });
        result.failed += 1;
      }
    }
  }

  return result;
}
