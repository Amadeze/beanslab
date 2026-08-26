import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { isNextRedirectError } from "@/lib/api-auth";
import { tenantIdentifier } from "@/lib/client-identity";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import {
  generatePairingCode,
  hashPairingCode,
} from "@/lib/artisan/connector-auth";
import { CreatePairingCodeSchema } from "@/lib/artisan/types";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";
import { recordAudit } from "@/lib/audit";

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();

    await enforceRateLimit({
      scope: "artisan:pairing",
      identifiers: [tenantIdentifier(user.tenantId)],
      limit: 5,
      windowSeconds: 60,
    });

    const body = await req.json();
    const parsed = CreatePairingCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify machine belongs to tenant
    const machine = await tenantPrisma.machine.findFirst({
      where: { id: parsed.data.machineId, isActive: true },
      select: { id: true, name: true },
    });
    if (!machine) {
      return NextResponse.json(
        { error: "Mesin tidak ditemukan atau tidak aktif." },
        { status: 404 },
      );
    }

    // Generate code and hash
    const code = generatePairingCode();
    const codeHash = hashPairingCode(code);
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

    const pairingCode = await tenantPrisma.artisanPairingCode.create({
      data: {
        tenantId: user.tenantId,
        machineId: parsed.data.machineId,
        createdByUserId: user.id,
        codeHash,
        expiresAt,
      },
    });

    await recordAudit(tenantPrisma, {
      tenantId: user.tenantId,
      userId: user.id,
      action: "CREATE",
      entityType: "ArtisanPairingCode",
      entityId: pairingCode.id,
      metadata: { machineId: parsed.data.machineId, machineName: machine.name },
    });

    return NextResponse.json({
      code,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: e.message },
        { status: 429, headers: { "Retry-After": String(e.retryAfter) } },
      );
    }
    if (isNextRedirectError(e)) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sesi tidak valid." } },
        { status: 401 },
      );
    }
    logServerError("artisan.pairing-codes", e, { requestId });
    return internalErrorResponse(requestId, "Gagal membuat kode pairing.");
  }
}
