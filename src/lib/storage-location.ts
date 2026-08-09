import { prisma } from "./prisma";

const DEFAULT_WAREHOUSE_NAME = "Gudang Utama";
const DEFAULT_LOCATION_NAME = "Penyimpanan Utama";
const DEFAULT_WAREHOUSE_CODE = "WH-01";
const DEFAULT_LOCATION_CODE = "A-01";

export interface DefaultWarehouse {
  warehouseId: string;
  locationId: string;
}

export async function ensureDefaultWarehouse(tenantId: string): Promise<DefaultWarehouse> {
  const existing = await prisma.warehouse.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
    include: {
      locations: { where: { isDefault: true, isActive: true } },
    },
  });

  if (existing && existing.locations.length > 0) {
    return {
      warehouseId: existing.id,
      locationId: existing.locations[0]!.id,
    };
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      tenantId,
      code: DEFAULT_WAREHOUSE_CODE,
      name: DEFAULT_WAREHOUSE_NAME,
      isDefault: true,
    },
  });

  const location = await prisma.location.create({
    data: {
      tenantId,
      warehouseId: warehouse.id,
      code: DEFAULT_LOCATION_CODE,
      name: DEFAULT_LOCATION_NAME,
      isDefault: true,
    },
  });

  return {
    warehouseId: warehouse.id,
    locationId: location.id,
  };
}

export async function getDefaultLocation(tenantId: string): Promise<string | null> {
  const location = await prisma.location.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
    select: { id: true },
  });
  return location?.id ?? null;
}

export async function resolveOrCreateDefaultLocation(tenantId: string): Promise<string> {
  const existing = await getDefaultLocation(tenantId);
  if (existing) return existing;

  const defaults = await ensureDefaultWarehouse(tenantId);
  return defaults.locationId;
}

/**
 * Create a LotPlacement entry for a newly created lot within an existing
 * transaction. If destinationLocationId is null/undefined and
 * autoPlaceDefault is true, resolves the tenant's default location lazily.
 *
 * This is the single integration point used by receiving, roasting,
 * grinding, production, and eksperimen flows.
 */
export async function createLotPlacementInTx(
  tx: any,
  tenantId: string,
  lotId: string,
  opts: {
    destinationLocationId?: string | null;
    quantityKg?: number;
    quantityUnit?: number;
    supplyQty?: number;
    autoPlaceDefault?: boolean;
  } = {},
) {
  let locationId = opts.destinationLocationId;

  if (!locationId && opts.autoPlaceDefault) {
    locationId = await resolveOrCreateDefaultLocation(tenantId);
  }

  if (!locationId) return null;

  const qtyKg = Number(opts.quantityKg ?? 0);
  const qtyUnit = Number(opts.quantityUnit ?? 0);
  const qtySupply = Number(opts.supplyQty ?? 0);

  if (qtyKg === 0 && qtyUnit === 0 && qtySupply === 0) return null;

  return await tx.lotPlacement.create({
    data: {
      tenantId,
      lotId,
      locationId,
      quantityKg: qtyKg,
      quantityUnit: qtyUnit,
      supplyQty: qtySupply,
    },
  });
}

