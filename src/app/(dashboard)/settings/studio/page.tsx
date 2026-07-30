import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { prisma } from "@/lib/prisma";
import { SettingsNav } from "../_components/SettingsNav";
import { ArtisanIntegrationClient as StudioClient } from "../integrations/artisan/_components/ArtisanIntegrationClient";

const TWO_MINUTES_MS = 2 * 60 * 1000;

export default async function StudioPage() {
  const user = await requireRole("OWNER");
  const connectors = await prisma.artisanConnector.findMany({
    where: { tenantId: user.tenantId },
    select: {
      id: true,
      computerName: true,
      platform: true,
      appVersion: true,
      status: true,
      lastSeenAt: true,
      revokedAt: true,
      createdAt: true,
      machine: { select: { id: true, name: true } },
      imports: {
        select: { uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const devices = connectors.map((connector) => ({
    id: connector.id,
    computerName: connector.computerName,
    platform: connector.platform,
    appVersion: connector.appVersion,
    status: connector.revokedAt ? "REVOKED" : connector.status,
    isOnline:
      !connector.revokedAt &&
      Boolean(
        connector.lastSeenAt &&
          now - connector.lastSeenAt.getTime() < TWO_MINUTES_MS,
      ),
    lastSeenAt: connector.lastSeenAt?.toISOString() ?? null,
    lastSyncAt: connector.imports[0]?.uploadedAt?.toISOString() ?? null,
    createdAt: connector.createdAt.toISOString(),
    machine: connector.machine,
  }));

  const downloadUrl =
    process.env.ARTISAN_CONNECTOR_DOWNLOAD_URL ||
    "/downloads/RoastdStudio-0.10.2-x64-setup.exe";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Roastd Studio"
        eyebrow="Perangkat roasting"
        description="Unduh Studio dan pantau perangkat yang terhubung. Login dari aplikasi—tanpa token atau pairing manual."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          <StudioClient connectors={devices} downloadUrl={downloadUrl} />
        </div>
      </div>
    </div>
  );
}
