import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    parentRoastingBatch: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    lot: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    appendLedger: vi.fn(),
    postRoastingBatch: vi.fn(),
    recordAudit: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/stock", () => ({ appendLedger: mocks.appendLedger }));
vi.mock("@/lib/posting", () => ({ postRoastingBatch: mocks.postRoastingBatch }));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));

import {
  completeStudioRoastingBatchIfReady,
  summarizeStudioBatchOutput,
} from "./studio-roasting-completion";

describe("summarizeStudioBatchOutput", () => {
  it("waits until every planned Child Batch has a roast", () => {
    expect(summarizeStudioBatchOutput([
      { roastId: "roast-1", roast: { roastedWeightGrams: 4200 } },
      { roastId: null, roast: null },
    ])).toEqual({ status: "WAITING_FOR_CHILDREN", remainingChildren: 1 });
  });

  it("requires an output weight for every linked roast", () => {
    expect(summarizeStudioBatchOutput([
      { roastId: "roast-1", roast: { roastedWeightGrams: null } },
    ])).toEqual({ status: "WAITING_FOR_OUTPUT_WEIGHT", missingChildren: 1 });
  });

  it("sums child outputs in kilograms", () => {
    expect(summarizeStudioBatchOutput([
      { roastId: "roast-1", roast: { roastedWeightGrams: 4210 } },
      { roastId: "roast-2", roast: { roastedWeightGrams: 4195 } },
    ])).toEqual({ status: "READY", actualOutputKg: 8.405 });
  });
});

describe("completeStudioRoastingBatchIfReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.parentRoastingBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      code: "RST-TEST",
      status: "PENDING",
      createdById: "user-1",
      inputProductId: "green-1",
      outputProductId: "roasted-1",
      targetWeightKg: 10,
      actualOutputKg: null,
      inputProduct: { avgCostPerKg: 100_000, name: "Gayo Natural" },
      outputProduct: { name: "Gayo Natural Medium" },
      childBatches: [
        { roastId: "roast-1", roast: { roastedWeightGrams: 4250 } },
        { roastId: "roast-2", roast: { roastedWeightGrams: 4250 } },
      ],
    });
    mocks.tx.parentRoastingBatch.findMany.mockResolvedValue([]);
    mocks.tx.parentRoastingBatch.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.lot.create.mockResolvedValue({ id: "lot-1", batchCode: "RST-TEST-RB" });
    mocks.postRoastingBatch.mockResolvedValue("JE-TEST");
  });

  it("completes stock, lot, journal, and audit exactly once when the last child arrives", async () => {
    const result = await completeStudioRoastingBatchIfReady({
      tenantId: "tenant-1",
      batchId: "batch-1",
    });

    expect(result).toMatchObject({
      status: "COMPLETED",
      batchCode: "RST-TEST",
      actualOutputKg: 8.5,
      outcome: { lossPercent: 15, status: "NORMAL" },
    });
    expect(mocks.tx.parentRoastingBatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "batch-1", tenantId: "tenant-1", status: "PENDING" },
      data: expect.objectContaining({ status: "COMPLETED", actualOutputKg: 8.5 }),
    }));
    expect(mocks.appendLedger).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      data: expect.objectContaining({
        refType: "ROASTING_RB_IN",
        quantityKg: 8.5,
        lotId: "lot-1",
      }),
    }));
    expect(mocks.postRoastingBatch).toHaveBeenCalledOnce();
    expect(mocks.recordAudit).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      action: "COMPLETE",
      metadata: { source: "ROASTD_STUDIO", childCount: 2 },
    }));
  });
});
