import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordAudit: vi.fn(),
  transferLotInTx: vi.fn(),
  appendLedger: vi.fn(),
  postRoastingBatch: vi.fn(),
  postStockAdjustment: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/lot-transfer", () => ({ transferLotInTx: mocks.transferLotInTx }));
vi.mock("@/lib/stock", () => ({ appendLedger: mocks.appendLedger }));
vi.mock("@/lib/posting", () => ({
  postRoastingBatch: mocks.postRoastingBatch,
  postStockAdjustment: mocks.postStockAdjustment,
}));

import {
  chargeRoastMaterialsInTx,
  reserveRoastMaterialsInTx,
  resolveRoastingWipLocationInTx,
} from "./roast-lifecycle";

function reservationTx(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "batch-1" }]),
    parentRoastingBatch: {
      findFirst: vi.fn().mockResolvedValue({
        id: "batch-1",
        code: "RST-1",
        inputProductId: "green-1",
        targetWeightKg: 6,
        lifecycleStatus: "PLANNED",
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    lotPlacement: { findMany: vi.fn().mockResolvedValue([]) },
    roastMaterialReservation: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  } as any;
}

const input = { tenantId: "tenant-1", userId: "user-1", batchId: "batch-1" };

describe("reserveRoastMaterialsInTx", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allocates FEFO across physical placements without stock or placement writes", async () => {
    const tx = reservationTx();
    tx.lotPlacement.findMany.mockResolvedValue([
      {
        id: "placement-new",
        lotId: "lot-new",
        locationId: "loc-1",
        quantityKg: 4,
        createdAt: new Date("2026-02-01"),
        lot: {
          expiryDate: new Date("2026-12-01"),
          receivedAt: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
        },
      },
      {
        id: "placement-old",
        lotId: "lot-old",
        locationId: "loc-1",
        quantityKg: 4,
        createdAt: new Date("2026-01-01"),
        lot: {
          expiryDate: new Date("2026-06-01"),
          receivedAt: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
        },
      },
    ]);

    const result = await reserveRoastMaterialsInTx(tx, input);

    expect(result).toEqual({ reservationCount: 2, reservedKg: 6 });
    expect(tx.roastMaterialReservation.create.mock.calls.map((call: any[]) => call[0].data)).toEqual([
      expect.objectContaining({ lotId: "lot-old", sourceLocationId: "loc-1", quantityKg: 4 }),
      expect.objectContaining({ lotId: "lot-new", sourceLocationId: "loc-1", quantityKg: 2 }),
    ]);
    expect(tx.parentRoastingBatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ lifecycleStatus: "PLANNED" }),
      data: { lifecycleStatus: "RESERVED" },
    }));
    expect(tx).not.toHaveProperty("product.update");
    expect(tx).not.toHaveProperty("inventoryLedger.create");
    expect(tx.lotPlacement).not.toHaveProperty("update");
  });

  it("rejects over-reservation after subtracting reservations from competing jobs", async () => {
    const tx = reservationTx();
    tx.parentRoastingBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      code: "RST-1",
      inputProductId: "green-1",
      targetWeightKg: 2,
      lifecycleStatus: "PLANNED",
    });
    tx.lotPlacement.findMany.mockResolvedValue([{
      id: "placement-1",
      lotId: "lot-1",
      locationId: "loc-1",
      quantityKg: 5,
      createdAt: new Date("2026-01-01"),
      lot: {
        expiryDate: new Date("2026-06-01"),
        receivedAt: new Date("2026-01-01"),
        createdAt: new Date("2026-01-01"),
      },
    }]);
    tx.roastMaterialReservation.findMany.mockResolvedValue([{
      lotId: "lot-1",
      sourceLocationId: "loc-1",
      quantityKg: 4,
    }]);

    await expect(reserveRoastMaterialsInTx(tx, input)).rejects.toThrow("Kekurangan 1.000 kg");
    expect(tx.parentRoastingBatch.updateMany).not.toHaveBeenCalled();
  });
});

describe("resolveRoastingWipLocationInTx", () => {
  it("resolves a system WIP inside the source warehouse", async () => {
    const tx = {
      location: {
        findFirst: vi.fn().mockResolvedValue({ warehouseId: "warehouse-a" }),
        upsert: vi.fn().mockResolvedValue({ id: "wip-a" }),
      },
    } as any;

    await expect(resolveRoastingWipLocationInTx(tx, "tenant-1", "source-a")).resolves.toBe("wip-a");
    expect(tx.location.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId_warehouseId_code: {
          tenantId: "tenant-1",
          warehouseId: "warehouse-a",
          code: "SYS-ROASTING-WIP",
        },
      },
      create: expect.objectContaining({ isSystem: true, systemPurpose: "ROASTING_WIP" }),
    }));
  });
});

describe("chargeRoastMaterialsInTx state guards", () => {
  it("rejects charge before RESERVED", async () => {
    const tx = reservationTx();
    await expect(chargeRoastMaterialsInTx(tx, input)).rejects.toThrow(
      "Batch harus berstatus RESERVED",
    );
    expect(mocks.transferLotInTx).not.toHaveBeenCalled();
  });

  it("treats a repeated CHARGED command as idempotent", async () => {
    const tx = reservationTx();
    tx.parentRoastingBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      code: "RST-1",
      lifecycleStatus: "CHARGED",
    });
    tx.roastMaterialReservation.count.mockResolvedValue(2);

    await expect(chargeRoastMaterialsInTx(tx, input)).resolves.toEqual({
      alreadyCharged: true,
      transferCount: 2,
    });
    expect(mocks.transferLotInTx).not.toHaveBeenCalled();
  });
});

