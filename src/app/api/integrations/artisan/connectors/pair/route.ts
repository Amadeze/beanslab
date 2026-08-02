import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, RateLimitError, requestIdentifier } from "@/lib/rate-limit";
import {
  hashPairingCode,
  generateConnectorToken,
  hashConnectorToken,
} from "@/lib/artisan/connector-auth";
import { PairConnectorRequestSchema } from "@/lib/artisan/types";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    const ip = requestIdentifier(req.headers);
    await enforceRateLimit({
      scope: "artisan:connector-pair",
      identifier: ip,
      limit: 5,
      windowSeconds: 60,
    });

    const body = await req.json();
    const parsed = PairConnectorRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Data tidak valid." } },
        { status: 400 },
      );
    }

    const { pairingCode, installationId, computerName, platform, appVersion } = parsed.data;

    // 1. Lookup pairing code
    const codeHash = hashPairingCode(pairingCode);
    const pairingRecord = await prisma.artisanPairingCode.findUnique({
      where: { codeHash },
      select: {
        id: true, tenantId: true, machineId: true,
        expiresAt: true, usedAt: true,
        machine: { select: { id: true, name: true } },
      },
    });

    if (!pairingRecord) {
      return NextResponse.json(
        { error: { code: "INVALID_PAIRING_CODE", message: "Kode pairing tidak valid." } },
        { status: 404 },
      );
    }
    if (pairingRecord.usedAt) {
      return NextResponse.json(
        { error: { code: "PAIRING_CODE_USED", message: "Kode pairing sudah digunakan." } },
        { status: 410 },
      );
    }
    if (new Date() > pairingRecord.expiresAt) {
      return NextResponse.json(
        { error: { code: "PAIRING_CODE_EXPIRED", message: "Kode pairing sudah expired." } },
        { status: 410 },
      );
    }

    // 2. Handle old connector with same installationId
    const existing = await prisma.roastdStudio.findUnique({
      where: { installationId },
      select: { id: true },
    });
    if (existing) {
      // Update old connector with unique placeholder to free up installationId
      await prisma.roastdStudio.update({
        where: { id: existing.id },
        data: {
          installationId: `old-${existing.id}`,
          status: "REVOKED",
          revokedAt: new Date(),
        },
      });
    }

    // 3. Create new connector
    const connectorToken = generateConnectorToken();
    const credentialHash = hashConnectorToken(connectorToken);

    const connector = await prisma.roastdStudio.create({
      data: {
        tenantId: pairingRecord.tenantId,
        machineId: pairingRecord.machineId,
        installationId,
        computerName,
        platform,
        appVersion,
        credentialHash,
        status: "ONLINE",
      },
    });

    // 4. Mark pairing code as used
    await prisma.artisanPairingCode.update({
      where: { id: pairingRecord.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({
      connectorId: connector.id,
      connectorToken,
      machine: { id: pairingRecord.machine.id, name: pairingRecord.machine.name },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: e.message } },
        { status: 429, headers: { "Retry-After": String(e.retryAfter) } },
      );
    }
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[PAIR ERROR]", err.message, err.stack);
    logServerError("artisan.connector-pair", e, { requestId });
    return internalErrorResponse(requestId, "Gagal melakukan pairing.");
  }
}
