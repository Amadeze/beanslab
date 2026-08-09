"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId, getSystemUserId } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type TransferActionResult =
  | { success: true; transferId: string }
  | { success: false; error: string };

export interface TransferRow {
  id: string;
  lotId: string;
  batchCode: string;
  productName: string | null;
  sourceLocationName: string;
  sourceWarehouseName: string;
  destinationLocationName: string;
  destinationWarehouseName: string;
  quantityKg: number | null;
  quantityUnit: number | null;
  supplyQty: number | null;
  status: string;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Atomically transfer quantity of a lot from one location to another.
 * Decrements source LotPlacement, increments (or upserts) destination
 * LotPlacement. Validates that source has sufficient quantity.
 */
export async function transferLot(data: {
  lotId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantityKg?: number;
  quantityUnit?: number;
  supplyQty?: number;
  notes?: string;
}): Promise<TransferActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    if (data.sourceLocationId === data.destinationLocationId) {
      return { success: false, error: "Sumber dan tujuan tidak boleh sama." };
    }

    const qtyKg = Number(data.quantityKg ?? 0);
    const qtyUnit = Number(data.quantityUnit ?? 0);
    const qtySupply = Number(data.supplyQty ?? 0);

    if (qtyKg < 0 || qtyUnit < 0 || qtySupply < 0) {
      return { success: false, error: "Jumlah tidak boleh negatif." };
    }
    if (qtyKg === 0 && qtyUnit === 0 && qtySupply === 0) {
      return { success: false, error: "Jumlah harus lebih dari 0." };
    }

    const transferId = await tp.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({
        where: { id: data.lotId, tenantId },
        select: { quantityKg: true, quantityUnit: true, supplyItemId: true, productId: true, packagingId: true },
      });
      if (!lot) {
        throw new Error("LOT_NOT_FOUND");
      }

      const sourcePlacement = await tx.lotPlacement.findFirst({
        where: { tenantId, lotId: data.lotId, locationId: data.sourceLocationId },
      });

      if (!sourcePlacement) {
        throw new Error("SOURCE_PLACEMENT_NOT_FOUND");
      }

      const sourceKg = Number(sourcePlacement.quantityKg);
      const sourceUnit = sourcePlacement.quantityUnit;
      const sourceSupply = Number(sourcePlacement.supplyQty);

      if (lot.productId && Number(lot.quantityKg) > 0) {
        if (qtyKg > sourceKg) {
          throw new Error("INSUFFICIENT_SOURCE_KG");
        }
      }
      if (qtyUnit > sourceUnit) {
        throw new Error("INSUFFICIENT_SOURCE_UNIT");
      }
      if (qtySupply > sourceSupply) {
        throw new Error("INSUFFICIENT_SOURCE_SUPPLY");
      }

      await tx.lotPlacement.update({
        where: { id: sourcePlacement.id },
        data: {
          quantityKg: { decrement: qtyKg },
          quantityUnit: { decrement: qtyUnit },
          supplyQty: { decrement: qtySupply },
        },
      });

      await tx.lotPlacement.upsert({
        where: {
          tenantId_lotId_locationId: {
            tenantId,
            lotId: data.lotId,
            locationId: data.destinationLocationId,
          },
        },
        create: {
          tenantId,
          lotId: data.lotId,
          locationId: data.destinationLocationId,
          quantityKg: qtyKg,
          quantityUnit: qtyUnit,
          supplyQty: qtySupply,
        },
        update: {
          quantityKg: { increment: qtyKg },
          quantityUnit: { increment: qtyUnit },
          supplyQty: { increment: qtySupply },
        },
      });

      const transfer = await tx.locationTransfer.create({
        data: {
          tenantId,
          lotId: data.lotId,
          sourceLocationId: data.sourceLocationId,
          destinationLocationId: data.destinationLocationId,
          quantityKg: qtyKg || null,
          quantityUnit: qtyUnit || null,
          supplyQty: qtySupply || null,
          notes: data.notes,
          status: "COMPLETED",
          completedAt: new Date(),
          createdById: userId,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "TRANSFER_LOT",
        entityType: "LocationTransfer",
        entityId: transfer.id,
        metadata: {
          lotId: data.lotId,
          sourceLocationId: data.sourceLocationId,
          destinationLocationId: data.destinationLocationId,
          quantityKg: qtyKg,
          quantityUnit: qtyUnit,
          supplyQty: qtySupply,
        },
      });

      return transfer.id;
    });

    revalidatePath("/gudang");
    revalidatePath("/inventory/lots");
    revalidatePath(`/inventory/lots/${data.lotId}`);
    return { success: true, transferId };
  } catch (err: any) {
    console.error("[transferLot]", err);
    const msg = err?.message ?? "Gagal memindah lot.";
    if (msg === "LOT_NOT_FOUND") return { success: false, error: "Lot tidak ditemukan." };
    if (msg === "SOURCE_PLACEMENT_NOT_FOUND") return { success: false, error: "Lot tidak ditempatkan di lokasi sumber." };
    if (msg === "INSUFFICIENT_SOURCE_KG") return { success: false, error: "Stok kg di lokasi sumber tidak mencukupi." };
    if (msg === "INSUFFICIENT_SOURCE_UNIT") return { success: false, error: "Stok unit di lokasi sumber tidak mencukupi." };
    if (msg === "INSUFFICIENT_SOURCE_SUPPLY") return { success: false, error: "Stok supply di lokasi sumber tidak mencukupi." };
    return { success: false, error: msg };
  }
}

/**
 * List transfer history for a given lot.
 */
export async function getTransferHistory(lotId: string): Promise<TransferRow[]> {
  const tenantId = await getCurrentTenantId();
  const transfers = await requireTenantPrisma().then((tp) =>
    tp.locationTransfer.findMany({
      where: { tenantId, lotId },
      include: {
        lot: { select: { batchCode: true, product: { select: { name: true } } } },
        sourceLocation: { include: { warehouse: { select: { name: true } } } },
        destinationLocation: { include: { warehouse: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  return transfers.map((t) => ({
    id: t.id,
    lotId: t.lotId,
    batchCode: t.lot.batchCode,
    productName: t.lot.product?.name ?? null,
    sourceLocationName: t.sourceLocation.name,
    sourceWarehouseName: t.sourceLocation.warehouse.name,
    destinationLocationName: t.destinationLocation.name,
    destinationWarehouseName: t.destinationLocation.warehouse.name,
    quantityKg: t.quantityKg ? Number(t.quantityKg) : null,
    quantityUnit: t.quantityUnit ?? null,
    supplyQty: t.supplyQty ? Number(t.supplyQty) : null,
    status: t.status,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
  }));
}
