import { NextRequest, NextResponse } from "next/server";
import { requireTenantPrisma, requireRole } from "@/lib/auth";
import { isNextRedirectError } from "@/lib/api-auth";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

const LIVE_FRESHNESS_MS = 15_000;

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantPrisma = await requireTenantPrisma();

    const machineId = req.nextUrl.searchParams.get("machineId");

    const where: any = {
      status: "ACTIVE",
      lastUpdateAt: {
        gte: new Date(Date.now() - LIVE_FRESHNESS_MS),
      },
    };
    // Batasi panjang param agar nilai liar tidak masuk ke query apa adanya.
    if (machineId) where.machineId = machineId.slice(0, 128);

    const sessions = await (tenantPrisma as any).liveSession.findMany({
      where,
      orderBy: { lastUpdateAt: "desc" },
      take: 10,
      select: {
        id: true,
        sessionId: true,
        machineId: true,
        status: true,
        startedAt: true,
        lastUpdateAt: true,
        currentBT: true,
        currentET: true,
        machine: { select: { name: true } },
      },
    });

    return NextResponse.json({
      sessions,
      serverTime: new Date().toISOString(),
      freshnessMs: LIVE_FRESHNESS_MS,
    });
  } catch (e) {
    if (isNextRedirectError(e)) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sesi tidak valid." } },
        { status: 401 },
      );
    }
    logServerError("artisan.mqtt.live", e, { requestId });
    return internalErrorResponse(requestId, "Gagal memuat data live.");
  }
}
