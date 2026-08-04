import { NextRequest, NextResponse } from "next/server";
import { authenticateConnector } from "@/lib/artisan/connector-auth";
import { CreateStudioRoastingBatchSchema } from "@/lib/artisan/types";
import { createStudioRoastingBatch } from "@/lib/studio-roasting-batch";
import {
  connectorIdentifier,
  layeredIdentifiers,
  resolveClientIdentity,
} from "@/lib/client-identity";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  try {
    const auth = await authenticateConnector(request.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Autentikasi Studio gagal." } },
        { status: 401 },
      );
    }
    if (!auth.authorizedByUserId) {
      return NextResponse.json(
        {
          error: {
            code: "STUDIO_REAUTH_REQUIRED",
            message: "Masuk ulang lewat browser agar Studio boleh membuat batch.",
          },
        },
        { status: 403 },
      );
    }

    const identity = resolveClientIdentity(request.headers);
    await enforceRateLimit({
      scope: "studio:create-roasting-batch",
      identifiers: layeredIdentifiers(identity, [connectorIdentifier(auth.connectorId)]),
      limit: 10,
      windowSeconds: 60,
    });

    const parsed = CreateStudioRoastingBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_BATCH", message: "Data batch roasting tidak valid." } },
        { status: 400 },
      );
    }

    const batch = await createStudioRoastingBatch({
      tenantId: auth.tenantId,
      userId: auth.authorizedByUserId,
      machineId: auth.machineId,
      ...parsed.data,
    });
    return NextResponse.json({ success: true, batch }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: error.message } },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    if (error instanceof Error && (
      error.message.includes("Stok")
      || error.message.includes("Green bean")
      || error.message.includes("profil roast")
      || error.message.includes("Mesin")
      || error.message.includes("Target")
    )) {
      return NextResponse.json(
        { error: { code: "BATCH_UNAVAILABLE", message: error.message } },
        { status: 409 },
      );
    }
    logServerError("studio.roasting-batch.create", error, { requestId });
    return internalErrorResponse(requestId, "Batch roasting gagal dibuat.");
  }
}
