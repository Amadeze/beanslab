import { NextRequest, NextResponse } from "next/server";
import { authenticateConnector } from "@/lib/artisan/connector-auth";
import { processMqttLive } from "@/lib/artisan/mqtt-bridge";
import { MqttSessionRequestSchema } from "@/lib/artisan/types";
import {
  enforceRateLimit,
  RateLimitError,
  requestIdentifier,
} from "@/lib/rate-limit";
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

    // Rate limit: 120/minute per connector (MQTT updates are frequent)
    const ip = requestIdentifier(req.headers);
    await enforceRateLimit({
      scope: "artisan:mqtt",
      identifier: `${auth.connectorId}:${ip}`,
      limit: 120,
      windowSeconds: 60,
    });

    const body = await req.json();
    const parsed = MqttSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Data tidak valid." } },
        { status: 400 },
      );
    }

    // Process MQTT live telemetry
    const result = await processMqttLive(
      auth.tenantId,
      auth.machineId,
      {
        eventType: parsed.data.eventType,
        data: (parsed.data.data as Record<string, unknown>) || {},
      },
      auth.connectorId,
    );

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      status: result.status,
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: e.message } },
        { status: 429, headers: { "Retry-After": String(e.retryAfter) } },
      );
    }
    logServerError("artisan.mqtt", e, { requestId });
    return internalErrorResponse(requestId, "MQTT session gagal diproses.");
  }
}
