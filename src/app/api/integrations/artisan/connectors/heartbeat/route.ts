import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateConnector } from "@/lib/artisan/connector-auth";
import { HeartbeatRequestSchema } from "@/lib/artisan/types";
import { enforceRateLimit, RateLimitError, requestIdentifier } from "@/lib/rate-limit";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    const auth = await authenticateConnector(req.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Autentikasi gagal." } },
        { status: 401 },
      );
    }

    // Rate limit: 60/minute per connector (heartbeat every 60s)
    const ip = requestIdentifier(req.headers);
    await enforceRateLimit({
      scope: "artisan:heartbeat",
      identifier: `${auth.connectorId}:${ip}`,
      limit: 60,
      windowSeconds: 60,
    });

    const body = await req.json();
    const parsed = HeartbeatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Data tidak valid." } },
        { status: 400 },
      );
    }

    // Check if connector exists before updating
    const connector = await prisma.roastdStudio.findUnique({
      where: { id: auth.connectorId },
      select: { id: true },
    });
    if (!connector) {
      return NextResponse.json(
        { error: { code: "CONNECTOR_NOT_FOUND", message: "Connector tidak ditemukan." } },
        { status: 404 },
      );
    }

    await prisma.roastdStudio.update({
      where: { id: auth.connectorId },
      data: {
        lastSeenAt: new Date(),
        appVersion: parsed.data.appVersion,
        computerName: parsed.data.computerName,
        status: "ONLINE",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: e.message } },
        { status: 429, headers: { "Retry-After": String(e.retryAfter) } },
      );
    }
    logServerError("artisan.heartbeat", e, { requestId });
    return internalErrorResponse(requestId, "Heartbeat gagal diproses.");
  }
}
