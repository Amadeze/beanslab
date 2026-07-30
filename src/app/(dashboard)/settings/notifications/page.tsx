import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth";
import { SettingsNav } from "../_components/SettingsNav";
import { getNotificationPreferences } from "../notification-actions";
import { NotificationPreferencesClient } from "./NotificationPreferencesClient";

export default async function NotificationSettingsPage() {
  const user = await requireRole("OWNER", "MANAGER");
  const preferences = await getNotificationPreferences();
  const enabled = (channel: "EMAIL" | "WHATSAPP", event: string) =>
    preferences.find((item) => item.channel === channel && item.event === event)?.enabled ?? true;
  const initial = Object.fromEntries(["OVERDUE_INVOICE", "PAYMENT_PROOF_SUBMITTED", "PAYMENT_STATUS_UPDATED"].map((event) => [event, {
    EMAIL: enabled("EMAIL", event),
    WHATSAPP: enabled("WHATSAPP", event),
  }])) as Record<"OVERDUE_INVOICE" | "PAYMENT_PROOF_SUBMITTED" | "PAYMENT_STATUS_UPDATED", Record<"EMAIL" | "WHATSAPP", boolean>>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Notifikasi"
        eyebrow="Pengaturan"
        description="Atur notifikasi bukti pembayaran, keputusan verifikasi, dan tagihan jatuh tempo."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl p-4 md:p-6 lg:p-8">
          <NotificationPreferencesClient
            initial={initial}
            configured={{ EMAIL: Boolean(process.env.RESEND_API_KEY), WHATSAPP: Boolean(process.env.WA_API_KEY) }}
          />
        </div>
      </div>
    </div>
  );
}
