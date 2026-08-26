import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  digestIdentifier,
  layeredIdentifiers,
  resolveClientIdentity,
} from "@/lib/client-identity";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
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
    const body = await req.json();
    const parsed = PairConnectorRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Data tidak valid." } },
        { status: 400 },
      );
    }

    const identity = resolveClientIdentity(req.headers);
    await enforceRateLimit({
      scope: "artisan:connector-pair",
      identifiers: layeredIdentifiers(identity, [
        digestIdentifier("pairing-code", parsed.data.pairingCode),
      ]),
      limit: 5,
      windowSeconds: 60,
    });

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
    if (new Date() > pairingRecord.expiresAt) {
      return NextResponse.json(
        { error: { code: "PAIRING_CODE_EXPIRED", message: "Kode pairing sudah expired." } },
        { status: 410 },
      );
    }

    // 2. Klaim kode secara atomik (anti-TOCTOU): hanya satu request konkuren
    // yang berhasil menggeser usedAt null → terisi. Pengecekan usedAt/expires
    // masuk ke WHERE klaim, bukan sekadar read-check-write terpisah.
    const connectorToken = generateConnectorToken();
    const credentialHash = hashConnectorToken(connectorToken);

    const connector = await prisma.$transaction(async (tx) => {
      const claimed = await tx.artisanPairingCode.updateMany({
        where: {
          id: pairingRecord.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      // 3. Handle old connector with same installationId
      const existing = await tx.roastdStudio.findUnique({
        where: { installationId },
        select: { id: true },
      });
      if (existing) {
        // Update old connector with unique placeholder to free up installationId
        await tx.roastdStudio.update({
          where: { id: existing.id },
          data: {
            installationId: `old-${existing.id}`,
            status: "REVOKED",
            revokedAt: new Date(),
          },
        });
      }

      // 4. Create new connector — gagal di sini me-roll back klaim kode juga.
      return tx.roastdStudio.create({
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
    });

    if (!connector) {
      return NextResponse.json(
        { error: { code: "PAIRING_CODE_USED", message: "Kode pairing sudah digunakan." } },
        { status: 410 },
      );
    }

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
