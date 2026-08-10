import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    parentRoastingBatch: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    machine: { findFirst: vi.fn() },
    product: { findFirst: vi.fn(), upsert: vi.fn() },
    roast: { findFirst: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    reserveRoastMaterialsInTx: vi.fn(),
    chargeRoastMaterialsInTx: vi.fn(),
    recordAudit: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    parentRoastingBatch: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/roast-lifecycle", () => ({
  reserveRoastMaterialsInTx: mocks.reserveRoastMaterialsInTx,
  chargeRoastMaterialsInTx: mocks.chargeRoastMaterialsInTx,
}));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));

import { createStudioRoastingBatch } from "./studio-roasting-batch";

describe("createStudioRoastingBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.parentRoastingBatch.findFirst.mockResolvedValue(null);
    mocks.tx.machine.findFirst.mockResolvedValue({ id: "machine-1", name: "Pratter 5", capacityKg: 5 });
    mocks.tx.product.findFirst.mockResolvedValue({
      id: "green-1",
      name: "Gayo Natural",
      category: "Specialty",
      origin: "Aceh",
      description: null,
      imageUrl: null,
      stockKg: 20,
    });
    mocks.tx.product.upsert.mockResolvedValue({ id: "roasted-1" });
    mocks.tx.parentRoastingBatch.create.mockResolvedValue({ id: "batch-1", code: "RST-TEST" });
  });

  it("splits by machine capacity and enters the shared reserve/charge lifecycle", async () => {
    mocks.tx.parentRoastingBatch.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ referenceRoastId: "profile-1" });
    const result = await createStudioRoastingBatch({
      tenantId: "tenant-1",
      userId: "user-1",
      machineId: "machine-1",
      operationKey: "e5e1ad87-126d-4a83-84b1-4208e8d3b61d",
      inputProductId: "green-1",
      targetWeightKg: 12,
      roastLevel: "MEDIUM",
    });

    expect(result).toMatchObject({
      id: "batch-1",
      childCount: 3,
      targetChargeWeightGrams: 4000,
    });
    expect(mocks.tx.parentRoastingBatch.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        machineId: "machine-1",
        createdById: "user-1",
        referenceRoastId: "profile-1",
        childBatches: { create: expect.arrayContaining([expect.objectContaining({ tenantId: "tenant-1" })]) },
      }),
    }));
    const createInput = mocks.tx.parentRoastingBatch.create.mock.calls[0][0];
    expect(createInput.data.childBatches.create).toHaveLength(3);
    expect(mocks.reserveRoastMaterialsInTx).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      tenantId: "tenant-1",
      batchId: "batch-1",
      userId: "user-1",
    }));
    expect(mocks.chargeRoastMaterialsInTx).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      tenantId: "tenant-1",
      batchId: "batch-1",
      userId: "user-1",
    }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      userId: "user-1",
      entityType: "ParentRoastingBatch",
    }));
  });

  it("creates an unassigned batch when no web-managed reference exists", async () => {
    const result = await createStudioRoastingBatch({
      tenantId: "tenant-1",
      userId: "user-1",
      machineId: "machine-1",
      operationKey: "024cb621-f4f7-42af-8143-dfab3b4829a5",
      inputProductId: "green-1",
      targetWeightKg: 5,
      roastLevel: "MEDIUM",
    });

    expect(result.referenceProfileId).toBeNull();
    expect(mocks.tx.parentRoastingBatch.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ referenceRoastId: null }),
    }));
  });

  it("returns an existing unassigned batch when Studio retries the same operation", async () => {
    mocks.tx.parentRoastingBatch.findFirst.mockResolvedValueOnce({
      id: "batch-existing",
      code: "RST-EXISTING",
      targetWeightKg: 8,
      referenceRoastId: null,
      childBatches: [{ id: "child-1" }, { id: "child-2" }],
    });

    const result = await createStudioRoastingBatch({
      tenantId: "tenant-1",
      userId: "user-1",
      machineId: "machine-1",
      operationKey: "9679b4f3-b916-4de3-a780-9beafc406cfb",
      inputProductId: "green-1",
      targetWeightKg: 8,
      roastLevel: "MEDIUM",
    });

    expect(result).toEqual({
      id: "batch-existing",
      code: "RST-EXISTING",
      childCount: 2,
      targetChargeWeightGrams: 4000,
      referenceProfileId: null,
    });
    expect(mocks.tx.parentRoastingBatch.create).not.toHaveBeenCalled();
    expect(mocks.reserveRoastMaterialsInTx).not.toHaveBeenCalled();
    expect(mocks.chargeRoastMaterialsInTx).not.toHaveBeenCalled();
  });

  it("rejects a batch before writing when stock is insufficient", async () => {
    mocks.tx.product.findFirst.mockResolvedValue({
      id: "green-1",
      name: "Gayo Natural",
      category: null,
      origin: null,
      description: null,
      imageUrl: null,
      stockKg: 2,
    });

    await expect(createStudioRoastingBatch({
      tenantId: "tenant-1",
      userId: "user-1",
      machineId: "machine-1",
      operationKey: "7ba699ca-ce1e-4c5c-a767-220e39779814",
      inputProductId: "green-1",
      targetWeightKg: 5,
      roastLevel: "LIGHT",
    })).rejects.toThrow("Stok Gayo Natural hanya 2.00 kg.");

    expect(mocks.tx.parentRoastingBatch.create).not.toHaveBeenCalled();
    expect(mocks.reserveRoastMaterialsInTx).not.toHaveBeenCalled();
    expect(mocks.chargeRoastMaterialsInTx).not.toHaveBeenCalled();
  });
});
