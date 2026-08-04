import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateConnector } from "@/lib/artisan/connector-auth";
import { isAlogFile, parseAlog } from "@/lib/artisan/parser";
import { reconcileLiveSession } from "@/lib/artisan/mqtt-bridge";
import {
  connectorIdentifier,
  layeredIdentifiers,
  resolveClientIdentity,
} from "@/lib/client-identity";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { uploadPrivateObject } from "@/lib/storage";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
  logInfo,
} from "@/lib/api-observability";
import { recordAudit } from "@/lib/audit";
import { calculateRoastProfileMatch } from "@/lib/roast-profile-match";
import {
  completeStudioRoastingBatchIfReady,
  type StudioBatchCompletion,
} from "@/lib/studio-roasting-completion";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

const MAX_UPLOAD_BYTES = parseInt(
  process.env.ARTISAN_MAX_UPLOAD_BYTES || String(10 * 1024 * 1024),
  10,
);

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

    const identity = resolveClientIdentity(req.headers);
    await enforceRateLimit({
      scope: "artisan:upload",
      identifiers: layeredIdentifiers(identity, [connectorIdentifier(auth.connectorId)]),
      limit: 30,
      windowSeconds: 60,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileHashClaimed = formData.get("fileHash") as string | null;
    const originalFilename = formData.get("originalFilename") as string | null;
    const fileModifiedAtStr = formData.get("fileModifiedAt") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "File tidak ditemukan." } },
        { status: 400 },
      );
    }

    if (!originalFilename) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "originalFilename wajib diisi." } },
        { status: 400 },
      );
    }

    // Sanitize filename
    const sanitizedFilename = originalFilename
      .replace(/[^\w\s.\-]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 255);

    if (!isAlogFile(sanitizedFilename)) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "Hanya file .alog yang diizinkan." } },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "FILE_TOO_LARGE",
            message: `Ukuran file melebihi batas maksimum (${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB).`,
          },
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "File kosong." } },
        { status: 400 },
      );
    }

    // Read file bytes and compute hash
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 10) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "File terlalu kecil atau malformed." } },
        { status: 400 },
      );
    }

    const actualHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Verify claimed hash matches
    if (fileHashClaimed && fileHashClaimed !== actualHash) {
      return NextResponse.json(
        {
          error: {
            code: "HASH_MISMATCH",
            message: "Hash file tidak cocok.",
          },
        },
        { status: 400 },
      );
    }

    const parsedFileModifiedAt = fileModifiedAtStr ? new Date(fileModifiedAtStr) : null;
    const fileModifiedAt = parsedFileModifiedAt && !Number.isNaN(parsedFileModifiedAt.getTime())
      ? parsedFileModifiedAt
      : null;

    // Claim this hash before storage/parsing. This makes concurrent desktop
    // retries idempotent instead of letting both requests create a roast.
    const existingImport = await prisma.artisanRoastImport.findFirst({
      where: {
        tenantId: auth.tenantId,
        machineId: auth.machineId,
        fileHash: actualHash,
      },
      select: { id: true, roastId: true, status: true },
    });

    if (existingImport && existingImport.status !== "FAILED") {
      return NextResponse.json({
        success: true,
        duplicate: true,
        importId: existingImport.id,
        roastId: existingImport.roastId,
      });
    }

    let importRecord: { id: string };
    if (existingImport) {
      const claimed = await prisma.artisanRoastImport.updateMany({
        where: { id: existingImport.id, status: "FAILED" },
        data: {
          status: "PARSING",
          errorCode: null,
          errorMessage: null,
          importedAt: null,
          roastId: null,
        },
      });
      if (claimed.count === 0) {
        const activeImport = await prisma.artisanRoastImport.findUnique({
          where: { id: existingImport.id },
          select: { id: true, roastId: true },
        });
        return NextResponse.json({
          success: true,
          duplicate: true,
          importId: activeImport?.id ?? existingImport.id,
          roastId: activeImport?.roastId ?? null,
        });
      }
      importRecord = { id: existingImport.id };
    } else {
      try {
        importRecord = await prisma.artisanRoastImport.create({
          data: {
            tenantId: auth.tenantId,
            machineId: auth.machineId,
            connectorId: auth.connectorId,
            originalFilename: sanitizedFilename,
            fileHash: actualHash,
            fileSize: buffer.length,
            storageKey: `pending:${crypto.randomUUID()}`,
            status: "PARSING",
            fileModifiedAt,
          },
          select: { id: true },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
        const activeImport = await prisma.artisanRoastImport.findFirst({
          where: {
            tenantId: auth.tenantId,
            machineId: auth.machineId,
            fileHash: actualHash,
          },
          select: { id: true, roastId: true },
        });
        if (!activeImport) throw error;
        return NextResponse.json({
          success: true,
          duplicate: true,
          importId: activeImport.id,
          roastId: activeImport.roastId,
        });
      }
    }

    // Keep the source artifact in private object storage so failed imports can
    // actually be reprocessed. If storage is unavailable the desktop queue
    // retries the upload instead of recording a non-existent object key.
    try {
      const storageKey = await uploadPrivateObject({
        tenantId: auth.tenantId,
        namespace: `artisan/${auth.machineId}`,
        buffer,
        mimeType: "application/octet-stream",
        extension: "alog",
      });
      await prisma.artisanRoastImport.update({
        where: { id: importRecord.id },
        data: {
          connectorId: auth.connectorId,
          originalFilename: sanitizedFilename,
          fileSize: buffer.length,
          storageKey,
          status: "UPLOADED",
          fileModifiedAt,
        },
      });
    } catch (storageError) {
      await prisma.artisanRoastImport.update({
        where: { id: importRecord.id },
        data: {
          status: "FAILED",
          errorCode: "STORAGE_UNAVAILABLE",
          errorMessage: "Raw .alog storage failed; the desktop connector may retry safely.",
        },
      }).catch(() => undefined);
      throw storageError;
    }

    // Attempt parsing
    const parseResult = parseAlog(buffer, sanitizedFilename);

    if (parseResult.success) {
      // Create Roast record from parsed data
      const roast = await prisma.roast.create({
        data: {
          tenantId: auth.tenantId,
          machineId: auth.machineId,
          importId: importRecord.id,
          title: parseResult.data.title,
          roastDate: parseResult.data.roastDate ? new Date(parseResult.data.roastDate) : null,
          sourceVersion: parseResult.data.sourceVersion,
          chargeTime: parseResult.data.chargeTime,
          dropTime: parseResult.data.dropTime,
          duration: parseResult.data.durationSeconds,
          chargeTemperature: parseResult.data.chargeTemperature,
          dropTemperature: parseResult.data.dropTemperature,
          dryEndTime: parseResult.data.dryEndTime,
          firstCrackStartTime: parseResult.data.firstCrackStartTime,
          firstCrackEndTime: parseResult.data.firstCrackEndTime,
          secondCrackStartTime: parseResult.data.secondCrackStartTime,
          greenWeightGrams: parseResult.data.metadata.greenWeightGrams as number | undefined,
          roastedWeightGrams: parseResult.data.metadata.roastedWeightGrams as number | undefined,
          lossPercent: parseResult.data.metadata.lossPercent as number | undefined,
          metadata: parseResult.data.metadata as any,
          beanTemperatureSeries: parseResult.data.beanTemperatureSeries as any,
          environmentalTemperatureSeries: parseResult.data.environmentalTemperatureSeries as any,
          events: parseResult.data.events as any,
        },
      });

      // RECONCILE: Link live session to this final roast
      await reconcileLiveSession(auth.tenantId, auth.machineId, roast.id, {
        chargeTime: parseResult.data.chargeTime,
        dropTime: parseResult.data.dropTime,
        duration: parseResult.data.durationSeconds,
        chargeTemperature: parseResult.data.chargeTemperature,
        dropTemperature: parseResult.data.dropTemperature,
        events: parseResult.data.events as any,
      });

      // Update import with roast ID
      await prisma.artisanRoastImport.update({
        where: { id: importRecord.id },
        data: {
          status: "IMPORTED",
          importedAt: new Date(),
          roastId: roast.id,
        },
      });

      // Prefer the explicit Parent Batch + reference profile embedded by Roastd Studio.
      // Filename matching remains only as a legacy fallback for external Artisan uploads.
      const embeddedContext = parseResult.data.metadata.roastdContext;
      const context = embeddedContext && typeof embeddedContext === "object"
        ? embeddedContext as Record<string, unknown>
        : null;
      const requestedBatchId = typeof context?.parentBatchId === "string" ? context.parentBatchId : null;
      const requestedReferenceId = typeof context?.referenceRoastId === "string" ? context.referenceRoastId : null;
      let matchDetails: ReturnType<typeof calculateRoastProfileMatch> | null = null;
      let linkedBatchId: string | null = null;
      let batchCompletion: StudioBatchCompletion | { status: "ERROR"; message: string } | null = null;

      const batchSelect = {
        id: true,
        code: true,
        inputProductId: true,
        inputProduct: { select: { name: true } },
        childBatches: {
          where: { roastId: null },
          select: { id: true },
          take: 1,
        },
      } as const;

      let pendingBatch = requestedBatchId
        ? await prisma.parentRoastingBatch.findFirst({
            where: {
              id: requestedBatchId,
              tenantId: auth.tenantId,
              machineId: auth.machineId,
              status: "PENDING",
            },
            select: batchSelect,
          })
        : null;

      if (pendingBatch && requestedReferenceId) {
        const reference = await prisma.roast.findFirst({
          where: {
            id: requestedReferenceId,
            tenantId: auth.tenantId,
            machineId: auth.machineId,
          },
          select: {
            id: true,
            duration: true,
            beanTemperatureSeries: true,
            events: true,
          },
        });
        if (reference) {
          matchDetails = calculateRoastProfileMatch(
            {
              duration: roast.duration,
              beanTemperatureSeries: roast.beanTemperatureSeries,
              events: roast.events,
            },
            reference,
          );
          await prisma.parentRoastingBatch.update({
            where: { id: pendingBatch.id },
            data: { referenceRoastId: reference.id },
          });
        }
      }

      if (!pendingBatch) {
        pendingBatch = await prisma.parentRoastingBatch.findFirst({
          where: {
            tenantId: auth.tenantId,
            machineId: auth.machineId,
            status: "PENDING",
            childBatches: { some: { roastId: null } },
          },
          orderBy: { createdAt: "asc" },
          select: batchSelect,
        });
      }

      if (pendingBatch) {
        // Never grow a production plan implicitly. A finished Parent Batch must
        // not receive an extra child merely because an old Studio context retries.
        const childId = pendingBatch.childBatches[0]?.id ?? null;

        if (childId) {
          linkedBatchId = pendingBatch.id;
          await prisma.childRoastingBatch.update({
            where: { id: childId },
            data: {
              roastId: roast.id,
              roastDuration: roast.duration,
              dropTemp: roast.dropTemperature,
              matchScore: matchDetails?.score ?? null,
              matchStatus: matchDetails?.status ?? null,
              matchDetails: matchDetails as any,
              matchedAt: matchDetails ? new Date() : null,
            },
          });

          await recordAudit(prisma, {
            tenantId: auth.tenantId,
            action: matchDetails ? "PROFILE_MATCH" : "AUTO_MATCH",
            entityType: "ChildRoastingBatch",
            entityId: childId,
            metadata: {
              roastId: roast.id,
              roastTitle: roast.title,
              batchId: pendingBatch.id,
              machineId: auth.machineId,
              referenceRoastId: requestedReferenceId,
              matchScore: matchDetails?.score,
              matchStatus: matchDetails?.status,
            },
          });

          try {
            batchCompletion = await completeStudioRoastingBatchIfReady({
              tenantId: auth.tenantId,
              batchId: pendingBatch.id,
            });
            logInfo("artisan.upload", "Studio batch lifecycle evaluated", {
              batchId: pendingBatch.id,
              completionStatus: batchCompletion.status,
              actualOutputKg: "actualOutputKg" in batchCompletion
                ? batchCompletion.actualOutputKg
                : undefined,
            });
          } catch (completionError) {
            logServerError("artisan.upload.batch-completion", completionError, {
              requestId,
              batchId: pendingBatch.id,
              roastId: roast.id,
            });
            batchCompletion = {
              status: "ERROR",
              message: "Roast tersimpan, tetapi penutupan batch perlu dicoba ulang dari web.",
            };
          }
        } else if (requestedBatchId) {
          batchCompletion = {
            status: "REVIEW_REQUIRED",
            message: "Semua Child Batch sudah terisi. Roast disimpan tanpa menambah rencana batch baru.",
          };
        }
      }

      await recordAudit(prisma, {
        tenantId: auth.tenantId,
        action: "UPLOAD",
        entityType: "ArtisanRoastImport",
        entityId: importRecord.id,
        metadata: {
          filename: sanitizedFilename,
          fileSize: buffer.length,
          hash: actualHash,
          parsed: true,
        },
      });

      return NextResponse.json({
        success: true,
        duplicate: false,
        importId: importRecord.id,
        roastId: roast.id,
        batchId: linkedBatchId,
        batchCompletion,
        match: matchDetails,
      });
    }

    // Parse failed — keep import for reprocessing
    await prisma.artisanRoastImport.update({
      where: { id: importRecord.id },
      data: {
        status: "FAILED",
        errorCode: parseResult.errorCode,
        errorMessage: parseResult.errorMessage,
      },
    });

    await recordAudit(prisma, {
      tenantId: auth.tenantId,
      action: "IMPORT_FAILED",
      entityType: "ArtisanRoastImport",
      entityId: importRecord.id,
      metadata: {
        filename: sanitizedFilename,
        errorCode: parseResult.errorCode,
        errorMessage: parseResult.errorMessage,
      },
    });

    // Return success to connector — the file was received, parsing failure is non-blocking
    return NextResponse.json({
      success: true,
      duplicate: false,
      importId: importRecord.id,
      roastId: null,
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: e.message } },
        { status: 429, headers: { "Retry-After": String(e.retryAfter) } },
      );
    }
    logServerError("artisan.upload", e, { requestId });
    return internalErrorResponse(requestId, "Upload gagal diproses.");
  }
}
