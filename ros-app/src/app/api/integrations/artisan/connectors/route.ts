import { NextRequest, NextResponse } from "next/server";
import { requireTenantPrisma } from "@/lib/auth";
import { isNextRedirectError } from "@/lib/api-auth";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

const TWO_MINUTES_MS = 2 * 60 * 1000;

export async function GET(_req: NextRequest) {
  const requestId = getRequestId(_req.headers);
  try {
    const tenantPrisma = await requireTenantPrisma();

    const connectors = await tenantPrisma.roastdStudio.findMany({
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
          select: { id: true, status: true, uploadedAt: true },
          orderBy: { uploadedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = connectors.map((c) => ({
      id: c.id,
      computerName: c.computerName,
      platform: c.platform,
      appVersion: c.appVersion,
      status: c.revokedAt ? "REVOKED" : c.status,
      isOnline:
        !c.revokedAt &&
        c.lastSeenAt &&
        Date.now() - c.lastSeenAt.getTime() < TWO_MINUTES_MS,
      lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
      lastSyncAt: c.imports[0]?.uploadedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      machine: c.machine,
    }));

    return NextResponse.json({ connectors: result });
  } catch (e) {
    if (isNextRedirectError(e)) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sesi tidak valid." } },
        { status: 401 },
      );
    }
    logServerError("artisan.connectors", e, { requestId });
    return internalErrorResponse(requestId, "Gagal memuat data connector.");
  }
}
