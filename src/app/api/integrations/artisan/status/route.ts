import { NextRequest, NextResponse } from "next/server";
import { requireTenantPrisma, requireCurrentUser } from "@/lib/auth";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

const TWO_MINUTES_MS = 2 * 60 * 1000;

export async function GET(_req: NextRequest) {
  const requestId = getRequestId(_req.headers);
  try {
    const user = await requireCurrentUser();
    const tenantPrisma = await requireTenantPrisma();

    const [connectorCount, onlineCount, importStats, machineCount] =
      await Promise.all([
        tenantPrisma.roastdStudio.count({
          where: { revokedAt: null },
        }),
        tenantPrisma.roastdStudio.findMany({
          where: {
            revokedAt: null,
            lastSeenAt: { not: null },
          },
          select: { lastSeenAt: true, id: true },
        }),
        tenantPrisma.artisanRoastImport.aggregate({
          _count: { id: true },
          _sum: { fileSize: true },
          where: { tenantId: user.tenantId },
        }),
        tenantPrisma.machine.count({ where: { isActive: true } }),
      ]);

    const onlineConnectorCount = onlineCount.filter(
      (c) => c.lastSeenAt && Date.now() - c.lastSeenAt.getTime() < TWO_MINUTES_MS,
    ).length;

    return NextResponse.json({
      totalConnectors: connectorCount,
      onlineConnectors: onlineConnectorCount,
      totalImports: importStats._count.id,
      totalImportSizeBytes: Number(importStats._sum.fileSize ?? 0),
      totalMachines: machineCount,
    });
  } catch (e) {
    logServerError("artisan.status", e, { requestId });
    return internalErrorResponse(requestId, "Gagal memuat status integrasi.");
  }
}
