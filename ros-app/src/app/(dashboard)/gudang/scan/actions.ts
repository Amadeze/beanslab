"use server";

import { getCurrentTenantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ScannedLocationDetail = {
  locationId: string;
  code: string;
  name: string;
  warehouseName: string;
  warehouseCode: string;
  zone: string | null;
  placements: Array<{
    lotId: string;
    batchCode: string;
    label: string;
    productName: string | null;
    packagingName: string | null;
    supplyItemName: string | null;
    quantityKg: number;
    quantityUnit: number;
    supplyQty: number;
    expiryDate: string | null;
  }>;
};

export async function scanLocation(code: string): Promise<{ success: boolean; data?: ScannedLocationDetail; error?: string }> {
  const tenantId = await getCurrentTenantId();

  const location = await prisma.location.findFirst({
    where: {
      tenantId,
      code,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      zone: true,
      warehouse: { select: { name: true, code: true } },
    },
  });

  if (!location) return { success: false, error: `Lokasi dengan kode "${code}" tidak ditemukan.` };

  const placements = await prisma.lotPlacement.findMany({
    where: {
      tenantId,
      locationId: location.id,
      OR: [
        { quantityKg: { gt: 0 } },
        { quantityUnit: { gt: 0 } },
        { supplyQty: { gt: 0 } },
      ],
      lot: { consumedAt: null },
    },
    include: {
      lot: {
        select: {
          batchCode: true,
          productId: true,
          packagingId: true,
          supplyItemId: true,
          expiryDate: true,
          product: { select: { name: true } },
          packaging: { select: { name: true } },
          supplyItem: { select: { name: true } },
        },
      },
    },
    orderBy: { lot: { receivedAt: "desc" } },
  });

  return {
    success: true,
    data: {
      locationId: location.id,
      code: location.code,
      name: location.name,
      warehouseName: location.warehouse.name,
      warehouseCode: location.warehouse.code,
      zone: location.zone,
      placements: placements.map((p) => ({
        lotId: p.lotId,
        batchCode: p.lot.batchCode,
        label: p.lot.product?.name ?? p.lot.packaging?.name ?? p.lot.supplyItem?.name ?? p.lot.batchCode,
        productName: p.lot.product?.name ?? null,
        packagingName: p.lot.packaging?.name ?? null,
        supplyItemName: p.lot.supplyItem?.name ?? null,
        quantityKg: Number(p.quantityKg),
        quantityUnit: p.quantityUnit,
        supplyQty: Number(p.supplyQty),
        expiryDate: p.lot.expiryDate ? p.lot.expiryDate.toISOString() : null,
      })),
    },
  };
}

export async function scanLot(batchCode: string): Promise<{ success: boolean; data?: ScannedLotDetail; error?: string }> {
  const tenantId = await getCurrentTenantId();

  const lot = await prisma.lot.findFirst({
    where: { tenantId, batchCode },
    include: {
      product: { select: { name: true, type: true } },
      packaging: { select: { name: true } },
      supplyItem: { select: { name: true, trackLot: true } },
      placements: {
        include: {
          location: {
            include: { warehouse: { select: { name: true, code: true } } },
          },
        },
      },
      inventoryLedgers: {
        select: { entryType: true, quantityKg: true, quantityUnit: true, supplyQuantity: true },
      },
    },
  });

  if (!lot) return { success: false, error: `Lot dengan batch code "${batchCode}" tidak ditemukan.` };

  const placedKg = lot.placements.reduce((s, p) => s + Number(p.quantityKg), 0);
  const placedUnit = lot.placements.reduce((s, p) => s + p.quantityUnit, 0);
  const placedSupply = lot.placements.reduce((s, p) => s + Number(p.supplyQty), 0);

  return {
    success: true,
    data: {
      lotId: lot.id,
      batchCode: lot.batchCode,
      label: lot.product?.name ?? lot.packaging?.name ?? lot.supplyItem?.name ?? lot.batchCode,
      productName: lot.product?.name ?? null,
      packagingName: lot.packaging?.name ?? null,
      supplyItemName: lot.supplyItem?.name ?? null,
      quantityKg: Number(lot.quantityKg),
      quantityUnit: Number(lot.quantityUnit),
      supplyQuantity: Number(lot.supplyQuantity),
      placedKg,
      placedUnit,
      placedSupply,
      expiryDate: lot.expiryDate ? lot.expiryDate.toISOString() : null,
      receivedAt: lot.receivedAt.toISOString(),
      placements: lot.placements.map((p) => ({
        locationId: p.locationId,
        locationName: p.location.name,
        locationCode: p.location.code,
        warehouseName: p.location.warehouse.name,
        warehouseCode: p.location.warehouse.code,
        quantityKg: Number(p.quantityKg),
        quantityUnit: p.quantityUnit,
        supplyQty: Number(p.supplyQty),
      })),
    },
  };
}

export type ScannedLotDetail = {
  lotId: string;
  batchCode: string;
  label: string;
  productName: string | null;
  packagingName: string | null;
  supplyItemName: string | null;
  quantityKg: number;
  quantityUnit: number;
  supplyQuantity: number;
  placedKg: number;
  placedUnit: number;
  placedSupply: number;
  expiryDate: string | null;
  receivedAt: string;
  placements: Array<{
    locationId: string;
    locationName: string;
    locationCode: string;
    warehouseName: string;
    warehouseCode: string;
    quantityKg: number;
    quantityUnit: number;
    supplyQty: number;
  }>;
};
