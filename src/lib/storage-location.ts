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
