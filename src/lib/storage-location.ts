import { prisma } from "./prisma";

const DEFAULT_WAREHOUSE_NAME = "Gudang Utama";
const DEFAULT_LOCATION_NAME = "Penyimpanan Utama";
const DEFAULT_WAREHOUSE_CODE = "WH-01";
const DEFAULT_LOCATION_CODE = "A-01";

export interface DefaultWarehouse {
  warehouseId: string;
  locationId: string;
}

type StorageClient = Pick<typeof prisma, "warehouse" | "location" | "lotPlacement">;

async function ensureDefaultWarehouseWithClient(
  client: StorageClient,
  tenantId: string,
): Promise<DefaultWarehouse> {
  const existing = await client.warehouse.findFirst({
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

  const warehouse = existing ?? await client.warehouse.upsert({
    where: { tenantId_code: { tenantId, code: DEFAULT_WAREHOUSE_CODE } },
    create: {
      tenantId,
      code: DEFAULT_WAREHOUSE_CODE,
      name: DEFAULT_WAREHOUSE_NAME,
      isDefault: true,
    },
    update: { isActive: true, isDefault: true },
  });

  const location = await client.location.upsert({
    where: {
      tenantId_warehouseId_code: {
        tenantId,
        warehouseId: warehouse.id,
        code: DEFAULT_LOCATION_CODE,
      },
    },
    create: {
      tenantId,
      warehouseId: warehouse.id,
      code: DEFAULT_LOCATION_CODE,
      name: DEFAULT_LOCATION_NAME,
      isDefault: true,
    },
    update: { isActive: true, isDefault: true },
  });

  return {
    warehouseId: warehouse.id,
    locationId: location.id,
  };
}

export async function ensureDefaultWarehouse(tenantId: string): Promise<DefaultWarehouse> {
  return ensureDefaultWarehouseWithClient(prisma, tenantId);
}

async function getDefaultLocationWithClient(
  client: StorageClient,
  tenantId: string,
): Promise<string | null> {
  const location = await client.location.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
    select: { id: true },
  });
  return location?.id ?? null;
}

export async function getDefaultLocation(tenantId: string): Promise<string | null> {
  return getDefaultLocationWithClient(prisma, tenantId);
}

async function resolveOrCreateDefaultLocationWithClient(
  client: StorageClient,
  tenantId: string,
): Promise<string> {
  const existing = await getDefaultLocationWithClient(client, tenantId);
  if (existing) return existing;

  const defaults = await ensureDefaultWarehouseWithClient(client, tenantId);
  return defaults.locationId;
}

export async function resolveOrCreateDefaultLocation(tenantId: string): Promise<string> {
  return resolveOrCreateDefaultLocationWithClient(prisma, tenantId);
}

/**
 * Create a LotPlacement entry for a newly created lot within an existing
 * transaction. Unless explicitly disabled, a missing destination resolves to
 * the tenant's default location so new lots never become unplaced by default.
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

  if (!locationId && opts.autoPlaceDefault !== false) {
    locationId = await resolveOrCreateDefaultLocationWithClient(tx, tenantId);
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
