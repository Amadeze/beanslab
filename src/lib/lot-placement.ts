"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requireTenantPrisma, getCurrentTenantId, getSystemUserId } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { summarizeLotInventory } from "@/lib/lot";
import { Prisma } from "@prisma/client";

export type PlacementActionResult =
  | { success: true }
  | { success: false; error: string };

export interface PlacementSummary {
  locationId: string;
  locationName: string;
  warehouseName: string;
  quantityKg: number;
  quantityUnit: number;
  supplyQty: number;
}

export interface LotPlacementView {
  lotId: string;
  batchCode: string;
  productName: string | null;
  remainingKg: number;
  remainingUnit: number;
  placedKg: number;
  placedUnit: number;
  placedSupplyQty: number;
  unplacedKg: number;
  unplacedUnit: number;
  isFullyPlaced: boolean;
  placements: PlacementSummary[];
}

/**
 * Place (or re-place) a quantity of a lot into a location.
 * Validates that the total placed does not exceed the lot's remaining balance.
 * Uses upsert semantics: if a placement already exists for lot+location, it is
 * adjusted to the supplied quantity.
 */
export async function placeLot(data: {
  lotId: string;
  locationId: string;
  quantityKg?: number;
  quantityUnit?: number;
  supplyQty?: number;
}): Promise<PlacementActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    if (!data.lotId) return { success: false, error: "Lot wajib dipilih." };
    if (!data.locationId) return { success: false, error: "Lokasi wajib dipilih." };

    const qtyKg = Number(data.quantityKg ?? 0);
    const qtyUnit = Number(data.quantityUnit ?? 0);
    const qtySupply = Number(data.supplyQty ?? 0);

    if (qtyKg < 0 || qtyUnit < 0 || qtySupply < 0) {
      return { success: false, error: "Jumlah tidak boleh negatif." };
    }
    if (qtyKg === 0 && qtyUnit === 0 && qtySupply === 0) {
      return { success: false, error: "Jumlah harus lebih dari 0." };
    }

    await tp.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({
        where: { id: data.lotId, tenantId },
        include: { inventoryLedgers: { select: { entryType: true, quantityKg: true, quantityUnit: true } } },
      });

      if (!lot) {
        return { success: false, error: "Lot tidak ditemukan." } as const;
      }

      const inventory = summarizeLotInventory({
        originalKg: lot.quantityKg,
        originalUnit: lot.quantityUnit,
        ledgers: lot.inventoryLedgers,
        expiryDate: lot.expiryDate,
        consumedAt: lot.consumedAt,
      });

      const existingPlacement = await tx.lotPlacement.findFirst({
        where: { tenantId, lotId: data.lotId, locationId: data.locationId },
        select: { quantityKg: true, quantityUnit: true, supplyQty: true },
      });

      const allPlacements = await tx.lotPlacement.findMany({
        where: { tenantId, lotId: data.lotId },
        select: { quantityKg: true, quantityUnit: true, supplyQty: true },
      });

      const sumKg = allPlacements.reduce((s, p) => s + Number(p.quantityKg), 0);
      const sumUnit = allPlacements.reduce((s, p) => s + p.quantityUnit, 0);
      const sumSupply = allPlacements.reduce((s, p) => s + Number(p.supplyQty), 0);

      const existingKg = Number(existingPlacement?.quantityKg ?? 0);
      const existingUnit = existingPlacement?.quantityUnit ?? 0;
      const existingSupply = Number(existingPlacement?.supplyQty ?? 0);

      const newTotalKg = sumKg - existingKg + qtyKg;
      const newTotalUnit = sumUnit - existingUnit + qtyUnit;
      const newTotalSupply = sumSupply - existingSupply + qtySupply;

      if (lot.productId && Number(lot.quantityKg) > 0) {
        if (Math.round(newTotalKg * 1000) / 1000 > Math.round(inventory.remainingKg * 1000) / 1000) {
          return { success: false, error: "Total penempatan melebihi stok tersisa lot." } as const;
        }
      }

      if (lot.packagingId || lot.supplyItemId) {
        if (newTotalUnit > inventory.remainingUnit) {
          return { success: false, error: "Total penempatan melebihi stok tersisa lot." } as const;
        }
      }

      if (lot.supplyItemId && newTotalSupply > 0) {
        if (Math.round(newTotalSupply * 1000) / 1000 > Math.round(inventory.remainingUnit * 1000) / 1000) {
          return { success: false, error: "Total penempatan melebihi stok tersisa lot." } as const;
        }
      }

      await tx.lotPlacement.upsert({
        where: {
          tenantId_lotId_locationId: { tenantId, lotId: data.lotId, locationId: data.locationId },
        },
        create: {
          tenantId,
          lotId: data.lotId,
          locationId: data.locationId,
          quantityKg: qtyKg,
          quantityUnit: qtyUnit,
          supplyQty: qtySupply,
        },
        update: {
          quantityKg: qtyKg,
          quantityUnit: qtyUnit,
          supplyQty: qtySupply,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId: userId,
        action: "PLACE_LOT",
        entityType: "LotPlacement",
        entityId: data.lotId,
        metadata: {
          locationId: data.locationId,
          quantityKg: qtyKg,
          quantityUnit: qtyUnit,
          supplyQty: qtySupply,
        },
      });
    });

    revalidatePath("/gudang");
    revalidatePath("/inventory/lots");
    return { success: true };
  } catch (err) {
    console.error("[placeLot]", err);
    return { success: false, error: "Gagal menempatkan lot." };
  }
}

/**
 * Remove a placement (unplace a lot from a location).
 */
export async function removePlacement(
  lotId: string,
  locationId: string,
): Promise<PlacementActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    await tp.$transaction(async (tx) => {
      await tx.lotPlacement.deleteMany({
        where: { tenantId, lotId, locationId },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "REMOVE_PLACEMENT",
        entityType: "LotPlacement",
        entityId: lotId,
        metadata: { locationId },
      });
    });

    revalidatePath("/gudang");
    revalidatePath("/inventory/lots");
    return { success: true };
  } catch (err) {
    console.error("[removePlacement]", err);
    return { success: false, error: "Gagal menghapus penempatan." };
  }
}

/**
 * Compute the placement summary for a lot, including unplaced quantities.
 */
export async function getLotPlacementView(lotId: string): Promise<LotPlacementView | null> {
  const tenantId = await getCurrentTenantId();

  const lot = await prisma.lot.findUnique({
    where: { id: lotId, tenantId },
    include: {
      product: { select: { name: true } },
      packaging: { select: { name: true } },
      inventoryLedgers: {
        select: { entryType: true, quantityKg: true, quantityUnit: true },
      },
      placements: {
        include: {
          location: {
            include: { warehouse: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!lot) return null;

  const inventory = summarizeLotInventory({
    originalKg: lot.quantityKg,
    originalUnit: lot.quantityUnit,
    ledgers: lot.inventoryLedgers,
    expiryDate: lot.expiryDate,
    consumedAt: lot.consumedAt,
  });

  const placementSummaries: PlacementSummary[] = lot.placements.map((p) => ({
    locationId: p.locationId,
    locationName: p.location.name,
    warehouseName: p.location.warehouse.name,
    quantityKg: Number(p.quantityKg),
    quantityUnit: p.quantityUnit,
    supplyQty: Number(p.supplyQty),
  }));

  const placedKg = placementSummaries.reduce((s, p) => s + p.quantityKg, 0);
  const placedUnit = placementSummaries.reduce((s, p) => s + p.quantityUnit, 0);
  const placedSupply = placementSummaries.reduce((s, p) => s + p.supplyQty, 0);

  return {
    lotId: lot.id,
    batchCode: lot.batchCode,
    productName: lot.product?.name ?? lot.packaging?.name ?? null,
    remainingKg: inventory.remainingKg,
    remainingUnit: inventory.remainingUnit,
    placedKg,
    placedUnit,
    placedSupplyQty: placedSupply,
    unplacedKg: Math.max(0, inventory.remainingKg - placedKg),
    unplacedUnit: Math.max(0, inventory.remainingUnit - placedUnit),
    isFullyPlaced: placedKg >= inventory.remainingKg && placedUnit >= inventory.remainingUnit,
    placements: placementSummaries,
  };
}

/**
 * Get all lots for a tenant with placement status, for the inventory page.
 */
export async function getLotPlacementStatus(filters: {
  search?: string;
  onlyUnplaced?: boolean;
  page?: number;
  perPage?: number;
}): Promise<{ placements: LotPlacementView[]; total: number }> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 50;
  const skip = (page - 1) * perPage;

  const where: Prisma.LotWhereInput = { tenantId };
  if (filters.search?.trim()) {
    where.OR = [
      { batchCode: { contains: filters.search.trim(), mode: "insensitive" } },
      { product: { name: { contains: filters.search.trim(), mode: "insensitive" } } },
      { supplier: { name: { contains: filters.search.trim(), mode: "insensitive" } } },
    ];
  }

  const [lots, total] = await Promise.all([
    tp.lot.findMany({
      where,
      include: {
        product: { select: { name: true } },
        packaging: { select: { name: true } },
        supplier: { select: { name: true, code: true } },
        inventoryLedgers: { select: { entryType: true, quantityKg: true, quantityUnit: true } },
        placements: {
          include: {
            location: {
              include: { warehouse: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      skip,
      take: perPage,
    }),
    tp.lot.count({ where }),
  ]);

  const views: LotPlacementView[] = lots.map((lot) => {
    const inventory = summarizeLotInventory({
      originalKg: lot.quantityKg,
      originalUnit: lot.quantityUnit,
      ledgers: lot.inventoryLedgers,
      expiryDate: lot.expiryDate,
      consumedAt: lot.consumedAt,
    });

    const placementSummaries: PlacementSummary[] = lot.placements.map((p) => ({
      locationId: p.locationId,
      locationName: p.location.name,
      warehouseName: p.location.warehouse.name,
      quantityKg: Number(p.quantityKg),
      quantityUnit: p.quantityUnit,
      supplyQty: Number(p.supplyQty),
    }));

    const placedKg = placementSummaries.reduce((s, p) => s + p.quantityKg, 0);
    const placedUnit = placementSummaries.reduce((s, p) => s + p.quantityUnit, 0);

    return {
      lotId: lot.id,
      batchCode: lot.batchCode,
      productName: lot.product?.name ?? lot.packaging?.name ?? null,
      remainingKg: inventory.remainingKg,
      remainingUnit: inventory.remainingUnit,
      placedKg,
      placedUnit,
      placedSupplyQty: 0,
      unplacedKg: Math.max(0, inventory.remainingKg - placedKg),
      unplacedUnit: Math.max(0, inventory.remainingUnit - placedUnit),
      isFullyPlaced: placedKg >= inventory.remainingKg && placedUnit >= inventory.remainingUnit,
      placements: placementSummaries,
    };
  });

  return {
    placements: filters.onlyUnplaced
      ? views.filter((v) => !v.isFullyPlaced)
      : views,
    total: filters.onlyUnplaced
      ? views.filter((v) => !v.isFullyPlaced).length
      : total,
  };
}
