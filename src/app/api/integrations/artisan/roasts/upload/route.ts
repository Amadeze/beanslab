import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateConnector } from "@/lib/artisan/connector-auth";
import { isAlogFile, parseAlog } from "@/lib/artisan/parser";
import { parseAlogFilename } from "@/lib/artisan/filename-parser";
import { reconcileLiveSession } from "@/lib/artisan/mqtt-bridge";
import { enforceRateLimit, RateLimitError, requestIdentifier } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/storage";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
  logInfo,
} from "@/lib/api-observability";
import { recordAudit } from "@/lib/audit";
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

    const ip = requestIdentifier(req.headers);
    await enforceRateLimit({
      scope: "artisan:upload",
      identifier: `${auth.connectorId}:${ip}`,
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

    // Check for duplicate (idempotency) - skip FAILED imports so they can be re-processed
    const existingImport = await prisma.artisanRoastImport.findFirst({
      where: {
        tenantId: auth.tenantId,
        machineId: auth.machineId,
        fileHash: actualHash,
        status: { not: "FAILED" },
      },
      select: { id: true, roastId: true, status: true },
    });

    if (existingImport) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        importId: existingImport.id,
        roastId: existingImport.roastId,
      });
    }

    // Store file (raw upload for reprocessing)
    const storageKey = `artisan/${auth.tenantId}/${auth.machineId}/${Date.now()}-${crypto.randomUUID()}.alog`;

    // Try Supabase storage, fall back to local
    let storedUrl: string;
    try {
      storedUrl = await uploadImage({
        tenantId: auth.tenantId,
        buffer,
        mimeType: "application/octet-stream",
      });
    } catch {
      // If storage fails, we still record the import with raw data reference
      storedUrl = storageKey;
    }

    const fileModifiedAt = fileModifiedAtStr
      ? new Date(fileModifiedAtStr)
      : null;

    // Create import record
    const importRecord = await prisma.artisanRoastImport.create({
      data: {
        tenantId: auth.tenantId,
        machineId: auth.machineId,
        connectorId: auth.connectorId,
        originalFilename: sanitizedFilename,
        fileHash: actualHash,
        fileSize: buffer.length,
        storageKey: storedUrl,
        status: "UPLOADED",
        fileModifiedAt,
      },
    });

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

      // AUTO-MATCH: Link roast to pending ChildRoastingBatch
      // Strategy: match by name + date from filename, fallback to first pending batch
      const { name: filenameName, date: filenameDate } = parseAlogFilename(sanitizedFilename);

      // Try to find batch matching name + date from filename
      let pendingBatch = null;
      if (filenameDate) {
        // Search for batch with matching code or inputProduct name containing the filename name
        pendingBatch = await prisma.parentRoastingBatch.findFirst({
          where: {
            tenantId: auth.tenantId,
            machineId: auth.machineId,
            status: "PENDING",
            childBatches: { some: { roastId: null } },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            code: true,
            inputProductId: true,
            inputProduct: { select: { name: true } },
            childBatches: {
              where: { roastId: null },
              select: { id: true },
              take: 1,
            },
          },
        });
      }

      // Fallback: first pending batch for this machine
      if (!pendingBatch) {
        pendingBatch = await prisma.parentRoastingBatch.findFirst({
          where: {
            tenantId: auth.tenantId,
            machineId: auth.machineId,
            status: "PENDING",
            childBatches: { some: { roastId: null } },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            code: true,
            inputProductId: true,
            inputProduct: { select: { name: true } },
            childBatches: {
              where: { roastId: null },
              select: { id: true },
              take: 1,
            },
          },
        });
      }

      if (pendingBatch && pendingBatch.childBatches.length > 0) {
        const childId = pendingBatch.childBatches[0].id;

        // Auto-fill Berat Keluar (actualOutputKg) dari roastedWeightGrams
        const roastedWeightGrams = parseResult.data.metadata.roastedWeightGrams as number | undefined;
        const greenWeightGrams = parseResult.data.metadata.greenWeightGrams as number | undefined;

        await prisma.childRoastingBatch.update({
          where: { id: childId },
          data: {
            roastId: roast.id,
            roastDuration: roast.duration,
            dropTemp: roast.dropTemperature,
          },
        });

        // Update ParentRoastingBatch: akumulasi actualOutputKg dari semua child batch
        if (roastedWeightGrams != null) {
          // Hitung total roasted weight dari SEMUA child batch yang sudah punya roast
          const allChildren = await prisma.childRoastingBatch.findMany({
            where: { parentId: pendingBatch.id, roastId: { not: null } },
            select: { roastId: true },
          });

          // Ambil roastedWeightGrams dari semua roast yang sudah ter-link
          const roastIds = allChildren.map((c) => c.roastId).filter(Boolean) as string[];
          const linkedRoasts = await prisma.roast.findMany({
            where: { id: { in: roastIds } },
            select: { metadata: true },
          });

          // Akumulasi total roasted weight (dalam gram)
          let totalRoastedGrams = 0;
          for (const r of linkedRoasts) {
            const meta = r.metadata as Record<string, unknown>;
            const weight = meta?.roastedWeightGrams;
            if (typeof weight === "number") totalRoastedGrams += weight;
          }
          // Tambah roasted weight dari roast yang baru diupload
          totalRoastedGrams += roastedWeightGrams;

          const actualOutputKg = Math.round((totalRoastedGrams / 1000) * 1000) / 1000;

          // Hitung total green weight dari input product
          const inputProduct = await prisma.product.findUnique({
            where: { id: pendingBatch.inputProductId },
            select: { name: true },
          });

          await prisma.parentRoastingBatch.update({
            where: { id: pendingBatch.id },
            data: {
              actualOutputKg,
            },
          });

          logInfo("artisan.upload", "Auto-filled Berat Keluar", {
            batchId: pendingBatch.id,
            actualOutputKg,
            totalRoastedGrams,
            childCount: allChildren.length + 1,
          });
        }

        await recordAudit(prisma, {
          tenantId: auth.tenantId,
          action: "AUTO_MATCH",
          entityType: "ChildRoastingBatch",
          entityId: childId,
          metadata: {
            roastId: roast.id,
            roastTitle: roast.title,
            batchId: pendingBatch.id,
            machineId: auth.machineId,
          },
        });

        logInfo("artisan.upload", "Roast auto-matched to batch", {
          roastId: roast.id,
          batchId: pendingBatch.id,
          machineId: auth.machineId,
        });
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
