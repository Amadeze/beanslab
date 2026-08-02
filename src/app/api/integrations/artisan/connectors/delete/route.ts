import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { getRequestId, internalErrorResponse, logServerError } from "@/lib/api-observability";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();

    await enforceRateLimit({
      scope: "artisan:delete",
      identifier: user.tenantId,
      limit: 10,
      windowSeconds: 60,
    });

    const body = await req.json();
    const { connectorId } = body;

    if (!connectorId) {
      return NextResponse.json({ error: "connectorId wajib diisi." }, { status: 400 });
    }

    const connector = await tenantPrisma.roastdStudio.findFirst({
      where: { id: connectorId, tenantId: user.tenantId },
      select: { id: true, computerName: true },
    });

    if (!connector) {
      return NextResponse.json({ error: "Connector tidak ditemukan." }, { status: 404 });
    }

    // Nullify foreign keys in related tables first
    await tenantPrisma.artisanRoastImport.updateMany({
      where: { connectorId },
      data: { connectorId: null as any },
    });

    // Delete the connector
    await tenantPrisma.roastdStudio.delete({
      where: { id: connectorId },
    });

    await recordAudit(tenantPrisma, {
      tenantId: user.tenantId,
      userId: user.id,
      action: "DELETE",
      entityType: "RoastdStudio",
      entityId: connectorId,
      metadata: { computerName: connector.computerName },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: e.message },
        { status: 429, headers: { "Retry-After": String(e.retryAfter) } },
      );
    }
    logServerError("artisan.delete", e, { requestId });
    return internalErrorResponse(requestId, "Gagal menghapus connector.");
  }
}
