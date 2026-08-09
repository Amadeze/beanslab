"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Warehouse } from "@prisma/client";

export type VisualLocation = {
  id: string;
  code: string;
  name: string;
  zone: string | null;
  isActive: boolean;
  isDefault: boolean;
  rackGroup: string;
  placements: Array<{
    lotId: string;
    batchCode: string;
    label: string;
    quantityKg: number;
    quantityUnit: number;
    supplyQty: number;
    expiryDate: string | null;
    supplierName: string | null;
  }>;
  totalKg: number;
  totalUnit: number;
  totalSupply: number;
  lotCount: number;
  hasExpiryWarning: boolean;
};

export type VisualWarehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  isDefault: boolean;
  rackGroups: Record<string, VisualLocation[]>;
};

function deriveRackGroup(loc: { zone: string | null; code: string }): string {
  if (loc.zone) return loc.zone;
  const parts = loc.code.split("-");
  if (parts.length > 0 && parts[0]) return parts[0].toUpperCase();
  return "DEFAULT";
}

function formatExpiryWarning(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const diff = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  return diff < 30;
}

export type VisualWarehouseMap = {
  warehouses: VisualWarehouse[];
};

export async function getVisualWarehouseMap(): Promise<VisualWarehouseMap> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tenantId = await getCurrentTenantId();

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId, isActive: true },
    include: {
      locations: {
        where: { isActive: true },
        include: {
          placements: {
            where: { quantityKg: { gt: 0 }, quantityUnit: { gt: 0 }, supplyQty: { gt: 0 } },
            include: {
              lot: {
                select: {
                  batchCode: true,
                  productId: true,
                  packagingId: true,
                  supplyItemId: true,
                  expiryDate: true,
                  quantityKg: true,
                  quantityUnit: true,
                  supplyQuantity: true,
                  product: { select: { name: true } },
                  packaging: { select: { name: true } },
                  supplyItem: { select: { name: true } },
                  supplier: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result: VisualWarehouse[] = warehouses.map((w) => {
    const rackGroups: Record<string, VisualLocation[]> = {};

    for (const loc of w.locations) {
      const rackGroup = deriveRackGroup(loc);

      const placements = loc.placements
        .filter((p) => {
          const hasKg = Number(p.quantityKg) > 0;
          const hasUnit = p.quantityUnit > 0;
          const hasSupply = Number(p.supplyQty) > 0;
          return hasKg || hasUnit || hasSupply;
        })
        .map((p) => ({
          lotId: p.lotId,
          batchCode: p.lot.batchCode,
          label:
            p.lot.product?.name ??
            p.lot.packaging?.name ??
            p.lot.supplyItem?.name ??
            p.lot.batchCode,
          quantityKg: Number(p.quantityKg),
          quantityUnit: p.quantityUnit,
          supplyQty: Number(p.supplyQty),
          expiryDate: p.lot.expiryDate ? p.lot.expiryDate.toISOString() : null,
          supplierName: p.lot.supplier?.name ?? null,
        }));

      const totalKg = placements.reduce((s, p) => s + p.quantityKg, 0);
      const totalUnit = placements.reduce((s, p) => s + p.quantityUnit, 0);
      const totalSupply = placements.reduce((s, p) => s + p.supplyQty, 0);

      const visualLoc: VisualLocation = {
        id: loc.id,
        code: loc.code,
        name: loc.name,
        zone: loc.zone,
        isActive: loc.isActive,
        isDefault: loc.isDefault,
        rackGroup,
        placements,
        totalKg,
        totalUnit,
        totalSupply,
        lotCount: placements.length,
        hasExpiryWarning: placements.some((p) => formatExpiryWarning(p.expiryDate)),
      };

      if (!rackGroups[rackGroup]) rackGroups[rackGroup] = [];
      rackGroups[rackGroup].push(visualLoc);
    }

    return {
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      isActive: w.isActive,
      isDefault: w.isDefault,
      rackGroups,
    };
  });

  return { warehouses: result };
}

export async function getWarehouseById(warehouseId: string): Promise<(Warehouse & { locations: any[] }) | null> {
  const tenantId = await getCurrentTenantId();
  return prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId, isActive: true },
    include: { locations: true },
  });
}
