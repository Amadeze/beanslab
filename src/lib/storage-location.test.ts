import { describe, expect, it, vi } from "vitest";

import { createLotPlacementInTx } from "./storage-location";
import { SYSTEM_LOCATION_ERROR } from "./system-location";

function tx() {
  return {
    location: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    warehouse: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "wh-1" }),
    },
    lotPlacement: {
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "placement-1", ...(data as object) })),
    },
  };
}

describe("createLotPlacementInTx", () => {
  it("rejects a system location as destination and creates no placement", async () => {
    const client = tx();
    client.location.findFirst.mockResolvedValue({ isSystem: true });

    await expect(
      createLotPlacementInTx(client as any, "tenant-1", "lot-1", {
        destinationLocationId: "sys-wip",
        quantityKg: 5,
      }),
    ).rejects.toThrow(SYSTEM_LOCATION_ERROR);

    expect(client.location.findFirst).toHaveBeenCalledWith({
      where: { id: "sys-wip", tenantId: "tenant-1" },
      select: { isSystem: true },
    });
    expect(client.lotPlacement.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown/cross-tenant destination with a clean error", async () => {
    const client = tx();
    client.location.findFirst.mockResolvedValue(null);

    await expect(
      createLotPlacementInTx(client as any, "tenant-1", "lot-1", {
        destinationLocationId: "other-tenant-loc",
        quantityKg: 5,
      }),
    ).rejects.toThrow("Lokasi tidak ditemukan.");

    expect(client.lotPlacement.create).not.toHaveBeenCalled();
  });

  it("places at a normal non-system destination", async () => {
    const client = tx();
    client.location.findFirst.mockResolvedValue({ isSystem: false });

    const placement = await createLotPlacementInTx(client as any, "tenant-1", "lot-1", {
      destinationLocationId: "a-01",
      quantityKg: 5,
    });

    expect(client.lotPlacement.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        lotId: "lot-1",
        locationId: "a-01",
        quantityKg: 5,
        quantityUnit: 0,
        supplyQty: 0,
      },
    });
    expect(placement?.id).toBe("placement-1");
  });

  it("auto-resolves the default non-system location when no destination is given", async () => {
    const client = tx();
    client.location.findFirst
      .mockResolvedValueOnce(null) // default lookup: none
      .mockResolvedValueOnce({ isSystem: false }); // guard lookup on resolved id
    client.location.upsert.mockResolvedValue({ id: "loc-default" });

    const placement = await createLotPlacementInTx(client as any, "tenant-1", "lot-1", {
      quantityKg: 5,
    });

    expect(client.lotPlacement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ locationId: "loc-default", quantityKg: 5 }),
    });
    expect(placement?.id).toBe("placement-1");
  });

  it("is a no-op for zero quantity without validating the destination", async () => {
    const client = tx();

    const placement = await createLotPlacementInTx(client as any, "tenant-1", "lot-1", {
      destinationLocationId: "a-01",
      quantityKg: 0,
      quantityUnit: 0,
      supplyQty: 0,
    });

    expect(placement).toBeNull();
    expect(client.location.findFirst).not.toHaveBeenCalled();
    expect(client.lotPlacement.create).not.toHaveBeenCalled();
  });
});
