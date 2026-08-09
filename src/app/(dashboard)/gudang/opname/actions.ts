"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId } from "@/lib/auth";
import { createLocationOpname, confirmLocationOpname, cancelLocationOpname, getLocationOpnameDrafts, getLocationOpnameHistory, type LocationOpnameDraft, type CreateOpnameInput } from "@/lib/lot-opname";

export type { LocationOpnameDraft, CreateOpnameInput, OpnameStatus } from "@/lib/lot-opname";

export type OpnameItem = {
  lotId: string;
  batchCode: string;
  label: string;
  productName: string | null;
  packagingName: string | null;
  supplyItemName: string | null;
  locationId: string;
  locationName: string;
  warehouseName: string;
  placementKg: number;
  placementUnit: number;
  placementSupply: number;
  quantityKg: number;
  quantityUnit: number;
  supplyQuantity: number;
  expiryDate: string | null;
  receivedAt: string;
};

export async function getOpnameItems(): Promise<OpnameItem[]> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const placements = await tp.lotPlacement.findMany({
    where: {
      tenantId,
      location: { isActive: true },
    },
    include: {
      lot: {
        select: {
          batchCode: true,
          quantityKg: true,
          quantityUnit: true,
          supplyQuantity: true,
          expiryDate: true,
          receivedAt: true,
          productId: true,
          packagingId: true,
          supplyItemId: true,
          product: { select: { name: true } },
          packaging: { select: { name: true } },
          supplyItem: { select: { name: true } },
        },
      },
      location: {
        select: {
          name: true,
          isActive: true,
          warehouse: { select: { name: true } },
        },
      },
    },
    orderBy: { lot: { receivedAt: "desc" } },
  });

  return placements.map((p) => ({
    lotId: p.lotId,
    batchCode: p.lot.batchCode,
    label:
      p.lot.product?.name ??
      p.lot.packaging?.name ??
      p.lot.supplyItem?.name ??
      p.lot.batchCode,
    productName: p.lot.product?.name ?? null,
    packagingName: p.lot.packaging?.name ?? null,
    supplyItemName: p.lot.supplyItem?.name ?? null,
    locationId: p.locationId,
    locationName: p.location.name,
    warehouseName: p.location.warehouse.name,
    placementKg: Number(p.quantityKg),
    placementUnit: p.quantityUnit,
    placementSupply: Number(p.supplyQty),
    quantityKg: Number(p.lot.quantityKg),
    quantityUnit: Number(p.lot.quantityUnit),
    supplyQuantity: Number(p.lot.supplyQuantity),
    expiryDate: p.lot.expiryDate ? p.lot.expiryDate.toISOString() : null,
    receivedAt: p.lot.receivedAt.toISOString(),
  }));
}

export async function getOpnameWarehouses() {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();
  return tp.warehouse.findMany({
    where: { tenantId, isActive: true },
    include: { locations: { where: { isActive: true }, select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOpnameDraft(input: CreateOpnameInput): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  return createLocationOpname(input);
}

export async function confirmOpname(opnameId: string): Promise<{ success: boolean; error?: string }> {
  return confirmLocationOpname(opnameId);
}

export async function cancelOpname(opnameId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  return cancelLocationOpname(opnameId, reason);
}

export async function getOpnameDrafts(): Promise<LocationOpnameDraft[]> {
  return getLocationOpnameDrafts();
}

export async function getOpnameHistory(): Promise<LocationOpnameDraft[]> {
  return getLocationOpnameHistory();
}

export async function ensureWarehouse(): Promise<{ warehouseId: string; locationId: string }> {
  const tenantId = await getCurrentTenantId();
  const { ensureDefaultWarehouse } = await import("@/lib/storage-location");
  return ensureDefaultWarehouse(tenantId);
}
