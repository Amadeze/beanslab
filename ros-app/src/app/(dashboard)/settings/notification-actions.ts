"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";

const ALLOWED_CHANNELS = new Set(["EMAIL", "WHATSAPP"]);
const ALLOWED_EVENTS = new Set(["OVERDUE_INVOICE", "PAYMENT_PROOF_SUBMITTED", "PAYMENT_STATUS_UPDATED"]);

export type NotificationPreferenceRow = {
  id: string;
  channel: string;
  event: string;
  enabled: boolean;
};

export async function getNotificationPreferences(): Promise<NotificationPreferenceRow[]> {
  try {
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = await getCurrentTenantId();

    const prefs = await tenantPrisma.notificationPreference.findMany({
      where: { tenantId },
      orderBy: { channel: "asc" },
    });

    return prefs.map((p) => ({
      id: p.id,
      channel: p.channel,
      event: p.event,
      enabled: p.enabled,
    }));
  } catch (error: any) {
    console.error("[getNotificationPreferences]", error);
    return [];
  }
}

export async function upsertNotificationPreference(
  channel: string,
  event: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    if (!ALLOWED_CHANNELS.has(channel) || !ALLOWED_EVENTS.has(event)) {
      return { success: false, error: "Kombinasi notifikasi tidak didukung." };
    }
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = await getCurrentTenantId();

    await tenantPrisma.$transaction(async (tx) => {
      const before = await tx.notificationPreference.findUnique({
        where: { tenantId_channel_event: { tenantId, channel, event } },
        select: { id: true, enabled: true },
      });
      const preference = await tx.notificationPreference.upsert({
        where: {
          tenantId_channel_event: {
            tenantId,
            channel,
            event,
          },
        },
        update: { enabled },
        create: { tenantId, channel, event, enabled },
      });
      await recordAudit(tx, {
        tenantId,
        userId: user.id,
        action: "UPDATE",
        entityType: "NotificationPreference",
        entityId: preference.id,
        before: before ? { enabled: before.enabled } : null,
        after: { channel, event, enabled },
      });
    });

    revalidatePath("/settings/notifications");
    return { success: true };
  } catch (error: any) {
    console.error("[upsertNotificationPreference]", error);
    return { success: false, error: error.message || "Gagal menyimpan preferensi notifikasi." };
  }
}
