import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ArtisanIntegrationClient } from "./_components/ArtisanIntegrationClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav } from "../../_components/SettingsNav";

const TWO_MINUTES_MS = 2 * 60 * 1000;

export default async function ArtisanIntegrationPage() {
  const user = await requireRole("OWNER");

  const [machines, connectors] = await Promise.all([
    prisma.machine.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.artisanConnector.findMany({
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
    }),
  ]);

  const now = Date.now();
  const connectorsWithStatus = connectors.map((c) => ({
    id: c.id,
    computerName: c.computerName,
    platform: c.platform,
    appVersion: c.appVersion,
    status: c.revokedAt ? "REVOKED" : c.status,
    isOnline:
      !c.revokedAt &&
      c.lastSeenAt &&
      now - c.lastSeenAt.getTime() < TWO_MINUTES_MS,
    lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
    lastSyncAt: c.imports[0]?.uploadedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    machine: c.machine,
  }));

  const downloadUrl = process.env.ARTISAN_CONNECTOR_DOWNLOAD_URL || "/downloads/ArtisanSync-1.0.0-Setup.exe";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Koneksi Artisan"
        eyebrow="Pengaturan"
        description="Hubungkan Artisan Coffee Roaster dengan roastd.id melalui desktop sync."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          <ArtisanIntegrationClient
            machines={machines}
            connectors={connectorsWithStatus}
            downloadUrl={downloadUrl}
          />
        </div>
      </div>
    </div>
  );
}
