import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  digestIdentifier,
  layeredIdentifiers,
  resolveClientIdentity,
} from "@/lib/client-identity";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import {
  generateConnectorToken,
  hashConnectorToken,
  hashStudioDeviceCode,
} from "@/lib/artisan/connector-auth";
import { PollStudioDeviceAuthorizationSchema } from "@/lib/artisan/types";
import { recordAudit } from "@/lib/audit";
import { getRequestId, internalErrorResponse, logServerError } from "@/lib/api-observability";

class AuthorizationAlreadyConsumedError extends Error {}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  try {
    const body = await request.json();
    const parsed = PollStudioDeviceAuthorizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Permintaan login tidak valid." } },
        { status: 400 },
      );
    }

    const deviceCodeHash = hashStudioDeviceCode(parsed.data.deviceCode);
    const identity = resolveClientIdentity(request.headers);
    await enforceRateLimit({
      scope: "studio:device-token",
      identifiers: layeredIdentifiers(identity, [
        digestIdentifier("device-code", deviceCodeHash.slice(0, 16)),
      ]),
      limit: 40,
      windowSeconds: 60,
    });

    const authorization = await prisma.studioDeviceAuthorization.findUnique({
      where: { deviceCodeHash },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        tenantId: true,
        machineId: true,
        approvedByUserId: true,
        installationId: true,
        computerName: true,
        platform: true,
        appVersion: true,
        machine: { select: { id: true, name: true } },
      },
    });

    if (!authorization) {
      return NextResponse.json(
        { error: { code: "AUTHORIZATION_NOT_FOUND", message: "Permintaan login tidak ditemukan." } },
        { status: 404 },
      );
    }
    if (authorization.expiresAt <= new Date()) {
      await prisma.studioDeviceAuthorization.updateMany({
        where: { id: authorization.id, status: "PENDING" },
        data: { status: "DENIED" },
      });
      return NextResponse.json(
        { error: { code: "AUTHORIZATION_EXPIRED", message: "Waktu login habis. Coba lagi." } },
        { status: 410 },
      );
    }
    if (authorization.status === "PENDING") {
      return NextResponse.json({ status: "pending" });
    }
    if (authorization.status !== "APPROVED") {
      return NextResponse.json(
        { error: { code: "AUTHORIZATION_UNAVAILABLE", message: "Izin login sudah tidak berlaku." } },
        { status: 410 },
      );
    }
    if (!authorization.tenantId || !authorization.machineId || !authorization.machine || !authorization.approvedByUserId) {
      return NextResponse.json(
        { error: { code: "AUTHORIZATION_INCOMPLETE", message: "Izin login belum lengkap." } },
        { status: 409 },
      );
    }

    const connectorToken = generateConnectorToken();
    const credentialHash = hashConnectorToken(connectorToken);

    const connector = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.studioDeviceAuthorization.updateMany({
        where: { id: authorization.id, status: "APPROVED", consumedAt: null },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new AuthorizationAlreadyConsumedError();

      const existing = await transaction.roastdStudio.findUnique({
        where: { installationId: authorization.installationId },
        select: { id: true },
      });
      if (existing) {
        await transaction.roastdStudio.update({
          where: { id: existing.id },
          data: {
            installationId: `old-${existing.id}`,
            status: "REVOKED",
            revokedAt: new Date(),
          },
        });
      }

      const created = await transaction.roastdStudio.create({
        data: {
          tenantId: authorization.tenantId!,
          machineId: authorization.machineId!,
          installationId: authorization.installationId,
          computerName: authorization.computerName,
          platform: authorization.platform,
          appVersion: authorization.appVersion,
          credentialHash,
          status: "ONLINE",
          authorizedByUserId: authorization.approvedByUserId!,
        },
      });

      await recordAudit(transaction, {
        tenantId: authorization.tenantId!,
        userId: authorization.approvedByUserId!,
        action: "CREATE",
        entityType: "RoastdStudio",
        entityId: created.id,
        metadata: {
          method: "browser_device_authorization",
          machineId: authorization.machineId,
          computerName: authorization.computerName,
        },
      });
      return created;
    });

    return NextResponse.json({
      status: "authorized",
      connectorId: connector.id,
      connectorToken,
      machine: authorization.machine,
    });
  } catch (error) {
    if (error instanceof AuthorizationAlreadyConsumedError) {
      return NextResponse.json(
        { error: { code: "AUTHORIZATION_CONSUMED", message: "Izin login sudah digunakan." } },
        { status: 410 },
      );
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: error.message } },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    logServerError("studio.device-token", error, { requestId });
    return internalErrorResponse(requestId, "Gagal menyelesaikan login Studio.");
  }
}
