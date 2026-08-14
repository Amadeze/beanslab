"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId, getSystemUserId } from "./auth";
import { recordAudit } from "./audit";
import { appendLedger } from "./stock";
import { postStockAdjustment } from "./posting";
import { isSystemLocation, SYSTEM_LOCATION_ERROR } from "./system-location";
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
        product: { select: { name: true, type: true } },
        packaging: { select: { name: true } },
        supplyItem: { select: { name: true } },
        inventoryLedgers: {
          select: { entryType: true, quantityKg: true, quantityUnit: true, supplyQuantity: true },
        },
      },
    });
    if (!lot) return { success: false, error: "Lot tidak ditemukan." };
    if (lot.consumedAt) {
      return { success: false, error: "Lot sudah terkonsumsi; tidak dapat dibuatkan opname." };
    }

    const location = await tp.location.findUnique({
      where: { id: input.locationId },
      select: { tenantId: true, name: true, isSystem: true, warehouse: { select: { name: true } } },
    });
    if (!location || location.tenantId !== tenantId) {
      return { success: false, error: "Lokasi tidak ditemukan." };
    }
    if (isSystemLocation(location)) {
      return { success: false, error: SYSTEM_LOCATION_ERROR };
    }

    const placement = await tp.lotPlacement.findFirst({
      where: { tenantId, lotId: input.lotId, locationId: input.locationId },
      select: { quantityKg: true, quantityUnit: true, supplyQty: true },
    });

    const countedKg = input.countedQuantityKg !== undefined ? Number(input.countedQuantityKg) : null;
    const countedUnit = input.countedQuantityUnit !== undefined ? Number(input.countedQuantityUnit) : null;
    const countedSupply = input.countedSupplyQty !== undefined ? Number(input.countedSupplyQty) : null;

    const expectedField = lot.productId
      ? lot.product?.type === "FINISHED_GOODS" ? "unit" : "kg"
      : lot.packagingId ? "unit" : "supply";
    const validCount = expectedField === "kg" ? countedKg : expectedField === "unit" ? countedUnit : countedSupply;
    if (validCount === null || validCount < 0) {
      return { success: false, error: "Jumlah terhitung harus diisi." };
    }

    const opname = await tp.locationOpname.create({
      data: {
        tenantId,
        lotId: input.lotId,
        locationId: input.locationId,
        systemQuantityKg: Number(placement?.quantityKg ?? 0),
        systemQuantityUnit: Number(placement?.quantityUnit ?? 0),
        systemSupplyQty: Number(placement?.supplyQty ?? 0),
        countedQuantityKg: countedKg,
        countedQuantityUnit: countedUnit,
        countedSupplyQty: countedSupply,
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
        include: {
          lot: {
            include: {
              product: { select: { type: true, avgCostPerKg: true, lastHpp: true } },
              packaging: { select: { avgCostPerUnit: true, costPerUnit: true } },
              supplyItem: { select: { avgCostPerUnit: true, category: true, includeInProductHpp: true } },
            },
          },
        },
      });
      if (!opname) throw new Error("Opname tidak ditemukan.");
      if (opname.status === "CONFIRMED") throw new Error("Opname sudah disahkan.");
      if (opname.status === "CANCELLED") throw new Error("Opname sudah dibatalkan.");
      if (opname.lot.consumedAt) {
        throw new Error("Lot sudah terkonsumsi sejak draft dibuat; opname tidak dapat disahkan.");
      }

      const location = await tx.location.findFirst({
        where: { id: opname.locationId, tenantId },
        select: { isSystem: true },
      });
      if (!location) throw new Error("Lokasi tidak ditemukan.");
      if (isSystemLocation(location)) {
        throw new Error(SYSTEM_LOCATION_ERROR);
      }

      // Stale-draft guard: physical count must be confirmed against the CURRENT
      // placement. If quantity changed since the draft was created (e.g. a
      // legit transfer moved stock out), confirming would silently overwrite
      // newer placement state and resurrect/destroy quantities.
      const currentPlacement = await tx.lotPlacement.findFirst({
        where: { tenantId, lotId: opname.lotId, locationId: opname.locationId },
        select: { quantityKg: true, quantityUnit: true, supplyQty: true },
      });
      const currentKg = Number(currentPlacement?.quantityKg ?? 0);
      const currentUnit = currentPlacement?.quantityUnit ?? 0;
      const currentSupply = Number(currentPlacement?.supplyQty ?? 0);
      const isProductKg = opname.lot.productId != null && opname.lot.product?.type !== "FINISHED_GOODS";
      const isProductUnit = opname.lot.productId != null && opname.lot.product?.type === "FINISHED_GOODS";
      const isPackaging = opname.lot.packagingId != null;
      const isSupply = opname.lot.supplyItemId != null;

      const stale = isProductKg
        ? Math.abs(currentKg - Number(opname.systemQuantityKg ?? 0)) > 0.000001
        : isProductUnit || isPackaging
          ? currentUnit !== Number(opname.systemQuantityUnit ?? 0)
          : isSupply
            ? Math.abs(currentSupply - Number(opname.systemSupplyQty ?? 0)) > 0.000001
            : false;
      if (stale) {
        throw new Error(
          "Stok lokasi berubah sejak draft dibuat. Batalkan draft dan buat opname baru.",
        );
      }

      const countedKg = opname.countedQuantityKg !== null ? Number(opname.countedQuantityKg) : null;
      const countedUnit = opname.countedQuantityUnit !== null ? Number(opname.countedQuantityUnit) : null;
      const countedSupply = opname.countedSupplyQty !== null ? Number(opname.countedSupplyQty) : null;
      const systemKg = Number(opname.systemQuantityKg);
      const systemUnit = Number(opname.systemQuantityUnit);
      const systemSupply = Number(opname.systemSupplyQty);

      let varianceKg = 0;
      let varianceUnit = 0;
      let varianceSupply = 0;

      if (isProductKg && countedKg !== null) {
        varianceKg = countedKg - systemKg;
      } else if ((isProductUnit || isPackaging) && countedUnit !== null) {
        varianceUnit = countedUnit - systemUnit;
      } else if (isSupply && countedSupply !== null) {
        varianceSupply = countedSupply - systemSupply;
      }

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
          quantityKg: countedKg ?? 0,
          quantityUnit: countedUnit ?? 0,
          supplyQty: countedSupply ?? 0,
        },
        update: {
          quantityKg: countedKg ?? 0,
          quantityUnit: countedUnit ?? 0,
          supplyQty: countedSupply ?? 0,
        },
      });

      if (isProductKg && Math.abs(varianceKg) > 0.000001) {
        await appendLedger(tx, {
          tenantId,
          productId: opname.lot.productId,
          entryType: varianceKg > 0 ? "IN" : "OUT",
          refType: varianceKg > 0 ? "LOCATION_OPNAME_IN" : "LOCATION_OPNAME_OUT",
          refId: opnameId,
          quantityKg: Math.abs(varianceKg),
          notes: `Koreksi opname lokasi: ${varianceKg > 0 ? "plus" : "minus"} ${Math.abs(varianceKg)}kg`,
          createdById: userId,
        });
      } else if ((isProductUnit || isPackaging) && Math.abs(varianceUnit) > 0) {
        await appendLedger(tx, {
          tenantId,
          ...(isProductUnit ? { productId: opname.lot.productId } : { packagingId: opname.lot.packagingId }),
          entryType: varianceUnit > 0 ? "IN" : "OUT",
          refType: varianceUnit > 0 ? "LOCATION_OPNAME_IN" : "LOCATION_OPNAME_OUT",
          refId: opnameId,
          quantityUnit: Math.abs(varianceUnit),
          notes: `Koreksi opname lokasi: ${varianceUnit > 0 ? "plus" : "minus"} ${Math.abs(varianceUnit)} unit`,
          createdById: userId,
        });
      } else if (isSupply && Math.abs(varianceSupply) > 0.000001) {
        await appendLedger(tx, {
          tenantId,
          supplyItemId: opname.lot.supplyItemId,
          entryType: varianceSupply > 0 ? "IN" : "OUT",
          refType: varianceSupply > 0 ? "LOCATION_OPNAME_IN" : "LOCATION_OPNAME_OUT",
          refId: opnameId,
          supplyQuantity: Math.abs(varianceSupply),
          notes: `Koreksi opname lokasi: ${varianceSupply > 0 ? "plus" : "minus"} ${Math.abs(varianceSupply)} baseUnit`,
          createdById: userId,
        });
      }

      if (Math.abs(varianceKg) > 0.000001 || Math.abs(varianceUnit) > 0 || Math.abs(varianceSupply) > 0.000001) {
        const direction = varianceKg > 0 || varianceUnit > 0 || varianceSupply > 0 ? "IN" : "OUT";
        const quantity = Math.abs(varianceKg || varianceUnit || varianceSupply);
        if (isProductKg || isProductUnit) {
          const product = opname.lot.product;
          const productType = product?.type ?? (isProductUnit ? "FINISHED_GOODS" : "GREEN_BEAN");
          await postStockAdjustment(opnameId, productType, direction, quantity,
            productType === "FINISHED_GOODS" ? Number(product?.lastHpp ?? 0) : Number(product?.avgCostPerKg ?? 0),
            { tx, tenantId, userId });
        } else if (isPackaging) {
          const packaging = opname.lot.packaging;
          await postStockAdjustment(opnameId, "PACKAGING", direction, quantity,
            Number(packaging?.avgCostPerUnit ?? packaging?.costPerUnit ?? 0), { tx, tenantId, userId });
        } else if (isSupply) {
          const supply = opname.lot.supplyItem;
          await postStockAdjustment(opnameId, "SUPPLY", direction, quantity, Number(supply?.avgCostPerUnit ?? 0),
            { tx, tenantId, userId }, { category: supply?.category ?? "OTHER", includeInProductHpp: supply?.includeInProductHpp ?? false });
        }
      }

      const confirmed = await tx.locationOpname.updateMany({
        where: { id: opnameId, status: "DRAFT" },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedById: userId,
        },
      });
      if (confirmed.count === 0) {
        throw new Error("Opname sudah disahkan oleh proses lain.");
      }

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
          varianceKg,
          varianceUnit,
          varianceSupply,
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

    const result = await tp.locationOpname.updateMany({
      where: { id: opnameId, tenantId, status: "DRAFT" },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason || null,
      },
    });
    if (result.count === 0) {
      return { success: false, error: "Opname tidak ditemukan atau bukan draft." };
    }

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
    countedQuantityKg: o.countedQuantityKg !== null ? Number(o.countedQuantityKg) : null,
    countedQuantityUnit: o.countedQuantityUnit !== null ? Number(o.countedQuantityUnit) : null,
    countedSupplyQty: o.countedSupplyQty !== null ? Number(o.countedSupplyQty) : null,
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
    countedQuantityKg: o.countedQuantityKg !== null ? Number(o.countedQuantityKg) : null,
    countedQuantityUnit: o.countedQuantityUnit !== null ? Number(o.countedQuantityUnit) : null,
    countedSupplyQty: o.countedSupplyQty !== null ? Number(o.countedSupplyQty) : null,
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
