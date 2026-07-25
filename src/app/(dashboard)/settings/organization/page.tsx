import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsClient } from "../_components/SettingsClient";
import { SettingsNav } from "../_components/SettingsNav";

export default async function OrganizationSettingsPage() {
  const user = await requireRole("OWNER");
  let tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant) throw new Error("Tenant not found.");

  if (!tenant.artisanWebhookToken) {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { artisanWebhookToken: `art_${randomBytes(16).toString("hex")}` },
    });
  }

  const {
    midtransServerKey,
    artisanWebhookToken: _artisanWebhookToken,
    ...safeTenant
  } = tenant;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Profil & Portal"
        eyebrow="Pengaturan"
        description="Identitas roastery, storefront, kontak, dan pembayaran portal."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          <SettingsClient
            tenant={{
              ...safeTenant,
              midtransServerKeyConfigured: Boolean(midtransServerKey),
              setupCompletedAt: tenant.setupCompletedAt,
            }}
          />
        </div>
      </div>
    </div>
  );
}
