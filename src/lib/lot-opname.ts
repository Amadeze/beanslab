"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId, getSystemUserId } from "./auth";
import { recordAudit } from "./audit";
import { appendLedger } from "./stock";
import { revalidatePath } from "next/cache";

export type OpnameStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface LocationOpnameDraft {
  id: string;
  lotId: string;
  locationId: string;
  lotLabel: string;
  locationLabel: string;
  warehouseName: string;
  systemQuantityKg: number;
  systemQuantityUnit: number;
  systemSupplyQty: number;
  countedQuantityKg: number | null;
  countedQuantityUnit: number | null;
  countedSupplyQty: number | null;
  varianceKg: number;
  varianceUnit: number;
  varianceSupply: number;
  status: OpnameStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface CreateOpnameInput {
  lotId: string;
  locationId: string;
  countedQuantityKg?: number;
  countedQuantityUnit?: number;
  countedSupplyQty?: number;
  notes?: string;
}

export async function createLocationOpname(input: CreateOpnameInput): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    const lot = await tp.lot.findUnique({
      where: { id: input.lotId, tenantId },
      include: {
        product: { select: { name: true } },
        packaging: { select: { name: true } },
        supplyItem: { select: { name: true } },
        inventoryLedgers: {
          select: { entryType: true, quantityKg: true, quantityUnit: true, supplyQuantity: true },
        },
      },
    });
    if (!lot) return { success: false, error: "Lot tidak ditemukan." };

    const location = await tp.location.findUnique({
      where: { id: input.locationId },
      select: { tenantId: true, name: true, warehouse: { select: { name: true } } },
    });
    if (!location || location.tenantId !== tenantId) {
      return { success: false, error: "Lokasi tidak ditemukan." };
    }

    const placement = await tp.lotPlacement.findFirst({
      where: { tenantId, lotId: input.lotId, locationId: input.locationId },
      select: { quantityKg: true, quantityUnit: true, supplyQty: true },
    });

    const countedKg = Number(input.countedQuantityKg ?? 0);
    const countedUnit = Number(input.countedQuantityUnit ?? 0);
    const countedSupply = Number(input.countedSupplyQty ?? 0);

    if (countedKg === 0 && countedUnit === 0 && countedSupply === 0) {
      return { success: false, error: "Jumlah terhitung harus lebih dari 0." };
    }

    const opname = await tp.locationOpname.create({
      data: {
        tenantId,
        lotId: input.lotId,
        locationId: input.locationId,
        systemQuantityKg: Number(lot.quantityKg),
        systemQuantityUnit: Number(lot.quantityUnit),
        systemSupplyQty: Number(lot.supplyQuantity),
        countedQuantityKg: countedKg > 0 ? countedKg : null,
        countedQuantityUnit: countedUnit > 0 ? countedUnit : null,
        countedSupplyQty: countedSupply > 0 ? countedSupply : null,
        notes: input.notes || null,
        createdById: userId,
      },
    });

    await recordAudit(tp, {
      tenantId,
      userId,
      action: "CREATE",
      entityType: "LocationOpname",
      entityId: opname.id,
      metadata: {
        lotId: input.lotId,
        locationId: input.locationId,
        placementQtyKg: Number(placement?.quantityKg ?? 0),
        placementQtyUnit: placement?.quantityUnit ?? 0,
        placementSupplyQty: Number(placement?.supplyQty ?? 0),
      },
    });

    return { success: true, id: opname.id };
  } catch (err) {
    console.error("[createLocationOpname]", err);
    return { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

export async function confirmLocationOpname(opnameId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    await tp.$transaction(async (tx) => {
      const opname = await tx.locationOpname.findUnique({
        where: { id: opnameId, tenantId },
        include: { lot: true },
      });
      if (!opname) throw new Error("Opname tidak ditemukan.");
      if (opname.status === "CONFIRMED") throw new Error("Opname sudah disahkan.");
      if (opname.status === "CANCELLED") throw new Error("Opname sudah dibatalkan.");

      const countedKg = Number(opname.countedQuantityKg ?? 0);
      const countedUnit = Number(opname.countedQuantityUnit ?? 0);
      const countedSupply = Number(opname.countedSupplyQty ?? 0);
      const systemKg = Number(opname.systemQuantityKg);
      const systemUnit = Number(opname.systemQuantityUnit);
      const systemSupply = Number(opname.systemSupplyQty);

      // Update placement to match counted quantity
      await tx.lotPlacement.upsert({
        where: {
          tenantId_lotId_locationId: {
            tenantId,
            lotId: opname.lotId,
            locationId: opname.locationId,
          },
        },
        create: {
          tenantId,
          lotId: opname.lotId,
          locationId: opname.locationId,
          quantityKg: countedKg,
          quantityUnit: countedUnit,
          supplyQty: countedSupply,
        },
        update: {
          quantityKg: countedKg,
          quantityUnit: countedUnit,
          supplyQty: countedSupply,
        },
      });

      // Reconcile canonical ledger for any variance
      if (opname.lot.productId && countedKg > 0) {
        const variance = countedKg - systemKg;
        if (Math.abs(variance) > 0.000001) {
          await appendLedger(tx, {
            tenantId,
            productId: opname.lot.productId,
            entryType: variance > 0 ? "IN" : "OUT",
            refType: variance > 0 ? "LOCATION_OPNAME_IN" : "LOCATION_OPNAME_OUT",
            refId: opnameId,
            quantityKg: Math.abs(variance),
            notes: `Koreksi opname lokasi: ${variance > 0 ? "plus" : "minus"} ${Math.abs(variance)}kg`,
            createdById: userId,
          });
        }
      } else if (opname.lot.packagingId && countedUnit > 0) {
        const variance = countedUnit - systemUnit;
        if (Math.abs(variance) > 0) {
          await appendLedger(tx, {
            tenantId,
            packagingId: opname.lot.packagingId,
            entryType: variance > 0 ? "IN" : "OUT",
            refType: variance > 0 ? "LOCATION_OPNAME_IN" : "LOCATION_OPNAME_OUT",
            refId: opnameId,
            quantityUnit: Math.abs(variance),
            notes: `Koreksi opname lokasi: ${variance > 0 ? "plus" : "minus"} ${Math.abs(variance)} unit`,
            createdById: userId,
          });
        }
      } else if (opname.lot.supplyItemId && countedSupply > 0) {
        const variance = countedSupply - systemSupply;
        if (Math.abs(variance) > 0.000001) {
          await appendLedger(tx, {
            tenantId,
            supplyItemId: opname.lot.supplyItemId,
            entryType: variance > 0 ? "IN" : "OUT",
            refType: variance > 0 ? "LOCATION_OPNAME_IN" : "LOCATION_OPNAME_OUT",
            refId: opnameId,
            supplyQuantity: Math.abs(variance),
            notes: `Koreksi opname lokasi: ${variance > 0 ? "plus" : "minus"} ${Math.abs(variance)} baseUnit`,
            createdById: userId,
          });
        }
      }

      await tx.locationOpname.update({
        where: { id: opnameId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedById: userId,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CONFIRM",
        entityType: "LocationOpname",
        entityId: opnameId,
        metadata: {
          lotId: opname.lotId,
          locationId: opname.locationId,
          countedKg,
          countedUnit,
          countedSupply,
          varianceKg: countedKg - systemKg,
          varianceUnit: countedUnit - systemUnit,
          varianceSupply: countedSupply - systemSupply,
        },
      });
    });

    revalidatePath("/gudang/opname");
    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    console.error("[confirmLocationOpname]", err);
    return { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

export async function cancelLocationOpname(opnameId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    const opname = await tp.locationOpname.findUnique({
      where: { id: opnameId, tenantId },
      select: { status: true },
    });
    if (!opname) return { success: false, error: "Opname tidak ditemukan." };
    if (opname.status !== "DRAFT") return { success: false, error: "Hanya opname draft yang dapat dibatalkan." };

    await tp.locationOpname.update({
      where: { id: opnameId, tenantId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason || null,
      },
    });

    await recordAudit(tp, {
      tenantId,
      userId,
      action: "CANCEL",
      entityType: "LocationOpname",
      entityId: opnameId,
      metadata: { reason: reason || null },
    });

    revalidatePath("/gudang/opname");
    return { success: true };
  } catch (err) {
    console.error("[cancelLocationOpname]", err);
    return { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

export async function getLocationOpnameDrafts(): Promise<LocationOpnameDraft[]> {
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const opnames = await tp.locationOpname.findMany({
    where: { tenantId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      lotId: true,
      locationId: true,
      systemQuantityKg: true,
      systemQuantityUnit: true,
      systemSupplyQty: true,
      countedQuantityKg: true,
      countedQuantityUnit: true,
      countedSupplyQty: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      lot: {
        select: {
          batchCode: true,
          product: { select: { name: true } },
          packaging: { select: { name: true } },
          supplyItem: { select: { name: true } },
        },
      },
      location: {
        select: {
          name: true,
          warehouse: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
  });

  return opnames.map((o) => ({
    id: o.id,
    lotId: o.lotId,
    locationId: o.locationId,
    lotLabel: o.lot.product?.name ?? o.lot.packaging?.name ?? o.lot.supplyItem?.name ?? o.lot.batchCode,
    locationLabel: o.location.name,
    warehouseName: o.location.warehouse.name,
    systemQuantityKg: Number(o.systemQuantityKg ?? 0),
    systemQuantityUnit: o.systemQuantityUnit ?? 0,
    systemSupplyQty: Number(o.systemSupplyQty ?? 0),
    countedQuantityKg: o.countedQuantityKg ? Number(o.countedQuantityKg) : null,
    countedQuantityUnit: o.countedQuantityUnit,
    countedSupplyQty: o.countedSupplyQty ? Number(o.countedSupplyQty) : null,
    varianceKg: Number(o.countedQuantityKg ?? 0) - Number(o.systemQuantityKg ?? 0),
    varianceUnit: (o.countedQuantityUnit ?? 0) - (o.systemQuantityUnit ?? 0),
    varianceSupply: Number(o.countedSupplyQty ?? 0) - Number(o.systemSupplyQty ?? 0),
    status: "DRAFT",
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    createdByName: o.createdBy?.name ?? null,
  }));
}

export async function getLocationOpnameHistory(): Promise<LocationOpnameDraft[]> {
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const opnames = await tp.locationOpname.findMany({
    where: { tenantId, status: { in: ["CONFIRMED", "CANCELLED"] } },
    orderBy: { confirmedAt: "desc" },
    select: {
      id: true,
      lotId: true,
      locationId: true,
      systemQuantityKg: true,
      systemQuantityUnit: true,
      systemSupplyQty: true,
      countedQuantityKg: true,
      countedQuantityUnit: true,
      countedSupplyQty: true,
      notes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lot: {
        select: {
          batchCode: true,
          product: { select: { name: true } },
          packaging: { select: { name: true } },
          supplyItem: { select: { name: true } },
        },
      },
      location: {
        select: {
          name: true,
          warehouse: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
  });

  return opnames.map((o) => ({
    id: o.id,
    lotId: o.lotId,
    locationId: o.locationId,
    lotLabel: o.lot.product?.name ?? o.lot.packaging?.name ?? o.lot.supplyItem?.name ?? o.lot.batchCode,
    locationLabel: o.location.name,
    warehouseName: o.location.warehouse.name,
    systemQuantityKg: Number(o.systemQuantityKg ?? 0),
    systemQuantityUnit: o.systemQuantityUnit ?? 0,
    systemSupplyQty: Number(o.systemSupplyQty ?? 0),
    countedQuantityKg: o.countedQuantityKg ? Number(o.countedQuantityKg) : null,
    countedQuantityUnit: o.countedQuantityUnit,
    countedSupplyQty: o.countedSupplyQty ? Number(o.countedSupplyQty) : null,
    varianceKg: Number(o.countedQuantityKg ?? 0) - Number(o.systemQuantityKg ?? 0),
    varianceUnit: (o.countedQuantityUnit ?? 0) - (o.systemQuantityUnit ?? 0),
    varianceSupply: Number(o.countedSupplyQty ?? 0) - Number(o.systemSupplyQty ?? 0),
    status: (o.status ?? "DRAFT") as OpnameStatus,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    createdByName: o.createdBy?.name ?? null,
  }));
}
