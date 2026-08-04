import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isAlogFile, parseAlog } from "@/lib/artisan/parser";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("OWNER", "MANAGER", "OPERATOR");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const machineId = formData.get("machineId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "File tidak ditemukan." },
        { status: 400 },
      );
    }

    const filename = file.name || "upload.alog";
    if (!isAlogFile(filename)) {
      return NextResponse.json(
        { error: "Hanya file .alog yang diizinkan." },
        { status: 400 },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Ukuran file melebihi 10MB." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const actualHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Parse the file
    const parseResult = parseAlog(buffer, filename);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: `Gagal parse: ${parseResult.errorMessage}` },
        { status: 400 },
      );
    }

    // Find or use first machine. A client-supplied machineId is never trusted:
    // the FK on the import/roast rows does not guarantee the machine belongs to
    // the caller's tenant, so ownership (tenantId + isActive) is verified here.
    let targetMachineId = machineId;
    if (targetMachineId) {
      const machine = await prisma.machine.findFirst({
        where: { id: targetMachineId, tenantId: user.tenantId, isActive: true },
        select: { id: true },
      });
      if (!machine) {
        return NextResponse.json(
          { error: "Mesin tidak ditemukan." },
          { status: 404 },
        );
      }
    } else {
      const machine = await prisma.machine.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true },
      });
      if (!machine) {
        return NextResponse.json(
          { error: "Tidak ada mesin yang tersedia. Buat mesin terlebih dahulu." },
          { status: 400 },
        );
      }
      targetMachineId = machine.id;
    }

    // Check for duplicate
    const existing = await prisma.artisanRoastImport.findUnique({
      where: {
        tenantId_machineId_fileHash: {
          tenantId: user.tenantId,
          machineId: targetMachineId,
          fileHash: actualHash,
        },
      },
      select: { id: true, roastId: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        importId: existing.id,
        roastId: existing.roastId,
        message: "File sudah pernah diupload sebelumnya.",
      });
    }

    // Create import record (using a dummy connectorId for manual upload)
    const importRecord = await prisma.artisanRoastImport.create({
      data: {
        tenantId: user.tenantId,
        machineId: targetMachineId,
        connectorId: "manual-upload",
        originalFilename: filename,
        fileHash: actualHash,
        fileSize: buffer.length,
        storageKey: `manual/${user.tenantId}/${Date.now()}.alog`,
        status: "UPLOADED",
      },
    });

    // Create Roast record
    const data = parseResult.data;
    const roast = await prisma.roast.create({
      data: {
        tenantId: user.tenantId,
        machineId: targetMachineId,
        importId: importRecord.id,
        title: data.title ?? undefined,
        roastDate: data.roastDate ? new Date(data.roastDate) : undefined,
        sourceVersion: data.sourceVersion ?? undefined,
        chargeTime: data.chargeTime,
        dropTime: data.dropTime,
        duration: data.durationSeconds,
        chargeTemperature: data.chargeTemperature,
        dropTemperature: data.dropTemperature,
        dryEndTime: data.dryEndTime,
        firstCrackStartTime: data.firstCrackStartTime,
        firstCrackEndTime: data.firstCrackEndTime,
        secondCrackStartTime: data.secondCrackStartTime,
        greenWeightGrams: data.metadata.greenWeightGrams as number | undefined,
        roastedWeightGrams: data.metadata.roastedWeightGrams as number | undefined,
        lossPercent: data.metadata.lossPercent as number | undefined,
        metadata: data.metadata as any,
        beanTemperatureSeries: data.beanTemperatureSeries as any,
        environmentalTemperatureSeries: data.environmentalTemperatureSeries as any,
        events: data.events as any,
      },
    });

    // Update import status
    await prisma.artisanRoastImport.update({
      where: { id: importRecord.id },
      data: {
        status: "IMPORTED",
        importedAt: new Date(),
        roastId: roast.id,
      },
    });

    return NextResponse.json({
      success: true,
      duplicate: false,
      importId: importRecord.id,
      roastId: roast.id,
      parsed: {
        title: data.title,
        duration: data.durationSeconds,
        chargeTemp: data.chargeTemperature,
        dropTemp: data.dropTemperature,
        btPoints: data.beanTemperatureSeries.length,
        etPoints: data.environmentalTemperatureSeries.length,
        events: data.events.length,
      },
    });
  } catch (e) {
    console.error("Manual upload error:", e);
    return NextResponse.json(
      { error: "Gagal memproses file." },
      { status: 500 },
    );
  }
}
