import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { planHasFeature } from "@/lib/plans";
import { getTenantAccessState } from "@/lib/subscription";
import { claimWebhookEvent } from "@/lib/webhook-inbox";
import { getCurrentDate } from "@/lib/date-utils";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";
import { findTenantByArtisanWebhookToken } from "@/lib/artisan/webhook-auth";
import { MACHINE_ID_SCHEMA } from "@/lib/artisan/types";

const ArtisanPayloadSchema = z.object({
  event: z.string().min(1).max(64),
  event_id: z.string().min(1).max(128).optional(),
  parent_batch_id: z.string().min(1).max(128).optional(),
  // machine_id masuk ke eventId yang dipersist — batasi panjangnya agar
  // payload liar tidak membengkakkan tabel webhook_events.
  machine_id: MACHINE_ID_SCHEMA,
  timestamp: z.union([z.string(), z.number()]).optional(),
  metrics: z
    .object({
      duration_seconds: z.number().int().nonnegative().optional(),
      drop_temperature: z.number().min(-50).max(500).optional(),
    })
    .optional(),
});

function recordedAt(timestamp: string | number | undefined) {
  if (timestamp === undefined) return getCurrentDate();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req.headers);
  let webhookEventId: string | null = null;

  try {
    const url = new URL(req.url);
    const authorization = req.headers.get("authorization");
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!bearerToken) {
      return NextResponse.json({ error: "Missing authentication token" }, { status: 401 });
    }
    const token = bearerToken;

    const tenant = await findTenantByArtisanWebhookToken(prisma, token);

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Invalid token or tenant" }, { status: 401 });
    }
    if (getTenantAccessState(tenant) !== "ACTIVE") {
      return NextResponse.json({ error: "Tenant subscription is inactive" }, { status: 403 });
    }
    if (!tenant.isArtisanEnabled) {
      return NextResponse.json({ error: "Artisan integration is disabled" }, { status: 403 });
    }
    if (!planHasFeature(tenant.subscriptionTier, "ARTISAN")) {
      return NextResponse.json({ error: "Artisan is not available on this plan" }, { status: 403 });
    }

    const rawPayload: unknown = await req.json();
    const parsed = ArtisanPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid Artisan payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const timestampStr = String(data.timestamp || "");
    const isDummyTimestamp = !timestampStr || timestampStr === "no-timestamp" || timestampStr.includes("%YYYY");
    const uniqueTime = isDummyTimestamp ? Date.now().toString() : timestampStr;
    
    const eventId =
      data.event_id ??
      `${data.machine_id}:${uniqueTime}:${data.event}`;
      
    const eventTime = isDummyTimestamp ? new Date() : recordedAt(data.timestamp);
    if (!eventTime) {
      return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
    }

    const claim = await claimWebhookEvent(prisma, {
      tenantId: tenant.id,
      provider: "ARTISAN",
      eventId,
      eventType: data.event,
      payload: rawPayload as Prisma.InputJsonValue,
    });
    webhookEventId = claim.eventId;
    if (!claim.claimed) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    if (data.event !== "DROP") {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId! },
        data: { status: "IGNORED", processedAt: getCurrentDate() },
      });
      return NextResponse.json({ success: true, ignored: true });
    }

    const candidates = await prisma.parentRoastingBatch.findMany({
      where: {
        tenantId: tenant.id,
        status: "PENDING",
        ...(data.parent_batch_id ? { id: data.parent_batch_id } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: data.parent_batch_id ? 1 : 2,
      select: { id: true, code: true },
    });

    if (candidates.length === 0) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId! },
        data: {
          status: "FAILED",
          error: "No pending roasting batch found.",
          processedAt: getCurrentDate(),
        },
      });
      return NextResponse.json({ error: "No pending roasting batch found" }, { status: 404 });
    }

    if (!data.parent_batch_id && candidates.length > 1) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId! },
        data: {
          status: "FAILED",
          error: "Multiple pending batches require parent_batch_id.",
          processedAt: getCurrentDate(),
        },
      });
      return NextResponse.json(
        {
          error: "Multiple pending batches found; parent_batch_id is required",
          batches: candidates,
        },
        { status: 409 },
      );
    }

    const parent = candidates[0];
    await prisma.$transaction(async (tx) => {
      const activeParent = await tx.parentRoastingBatch.findFirst({
        where: {
          id: parent.id,
          tenantId: tenant.id,
          status: "PENDING",
        },
        select: { id: true },
      });
      if (!activeParent) {
        throw new Error("Roasting batch is no longer pending.");
      }
      await tx.childRoastingBatch.create({
        data: {
          tenantId: tenant.id,
          parentId: parent.id,
          artisanEventId: `${tenant.id}:${eventId}`,
          roastDuration: data.metrics?.duration_seconds ?? null,
          dropTemp: data.metrics?.drop_temperature ?? null,
          recordedAt: eventTime,
        },
      });
      await tx.webhookEvent.update({
        where: { id: webhookEventId! },
        data: { status: "PROCESSED", processedAt: getCurrentDate() },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Child batch attached.",
      parentBatchId: parent.id,
      parentBatchCode: parent.code,
    });
  } catch (error) {
    logServerError("webhook.artisan", error, { requestId });
    if (webhookEventId) {
      await prisma.webhookEvent
        .update({
          where: { id: webhookEventId },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
            processedAt: getCurrentDate(),
          },
        })
        .catch(() => undefined);
    }
    return internalErrorResponse(requestId, "Webhook gagal diproses.");
  }
}
