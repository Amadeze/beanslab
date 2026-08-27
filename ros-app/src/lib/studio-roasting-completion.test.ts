import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    parentRoastingBatch: { findFirst: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    completeRoastInTx: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/roast-lifecycle", () => ({ completeRoastInTx: mocks.completeRoastInTx }));

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
    mocks.completeRoastInTx.mockResolvedValue({
      alreadyCompleted: false,
      batchCode: "RST-TEST",
      actualOutputKg: 8.5,
      outcome: {
        inputKg: 10,
        outputKg: 8.5,
        lossKg: 1.5,
        lossPercent: 15,
        expectedLossPercent: 15,
        expectedMinPercent: 8,
        expectedMaxPercent: 25,
        historySampleCount: 0,
        status: "NORMAL",
      },
    });
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
    expect(mocks.completeRoastInTx).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      tenantId: "tenant-1",
      userId: "user-1",
      batchId: "batch-1",
      actualOutputKg: 8.5,
      source: "ROASTD_STUDIO",
    }));
  });
});
