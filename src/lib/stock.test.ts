import { describe, expect, it, vi } from "vitest";

import { appendFefoLedgerOut, appendLedger } from "./stock";

function transaction(updateCount = 1) {
  return {
    product: {
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
      findUnique: vi.fn(),
    },
    packaging: {
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
      findUnique: vi.fn(),
    },
    inventoryLedger: {
      create: vi.fn(async ({ data }) => ({ id: "ledger-1", ...data })),
    },
    lot: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("appendLedger", () => {
  it("normalizes the existing { data } call shape", async () => {
    const tx = transaction();
    await appendLedger(tx, {
      data: {
        productId: "product-1",
        entryType: "IN",
        refType: "ADJUSTMENT_IN",
        refId: "ref-1",
        quantityUnit: 5,
        createdById: "user-1",
      },
    });

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { stockUnit: { increment: 5 } },
    });
    expect(tx.inventoryLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ productId: "product-1", quantityUnit: 5 }),
    });
  });

  it("atomically rejects outbound stock that is unavailable", async () => {
    const tx = transaction(0);

    await expect(
      appendLedger(tx, {
        data: {
          productId: "product-1",
          entryType: "OUT",
          refType: "SALE_FG_OUT",
          refId: "invoice-1",
          quantityUnit: 6,
          createdById: "user-1",
        },
      }),
    ).rejects.toThrow("Stok produk tidak cukup");

    expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
  });

  it("requires exactly one inventory target and a positive quantity", async () => {
    const tx = transaction();

    await expect(
      appendLedger(tx, {
        data: {
          productId: "product-1",
          packagingId: "packaging-1",
          entryType: "IN",
          quantityUnit: 1,
        },
      }),
    ).rejects.toThrow("exactly one");

    await expect(
      appendLedger(tx, {
        data: {
          productId: "product-1",
          entryType: "IN",
          quantityUnit: 0,
        },
      }),
    ).rejects.toThrow("greater than zero");
  });

  it("stores lotNumber and expiryDate on ledger entry", async () => {
    const tx = transaction();
    await appendLedger(tx, {
      data: {
        productId: "product-1",
        entryType: "IN",
        refType: "PURCHASE_GB",
        refId: "purchase-1",
        quantityKg: 50,
        lotNumber: "LOT-2024-001",
        expiryDate: new Date("2025-06-01"),
        createdById: "user-1",
      },
    });

    expect(tx.inventoryLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lotNumber: "LOT-2024-001",
        expiryDate: new Date("2025-06-01"),
        quantityKg: 50,
      }),
    });
  });

  it("computes weighted average cost for product (GB/RB)", async () => {
    const tx = transaction();
    tx.product.findUnique = vi.fn().mockResolvedValue({
      stockKg: "100",
      stockUnit: 0,
      avgCostPerKg: "50000",
    });

    await appendLedger(tx, {
      data: {
        productId: "product-1",
        entryType: "IN",
        refType: "PURCHASE_GB",
        refId: "purchase-2",
        quantityKg: 50,
        incomingPrice: 60000,
        createdById: "user-1",
      },
    });

    const expectedAvg = (100 * 50000 + 50 * 60000) / (100 + 50);
    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "product-1" },
        data: expect.objectContaining({
          stockKg: { increment: 50 },
          avgCostPerKg: expectedAvg,
        }),
      }),
    );
  });

  it("computes weighted average cost for packaging", async () => {
    const tx = transaction();
    tx.packaging.findUnique = vi.fn().mockResolvedValue({
      stockUnit: 200,
      avgCostPerUnit: "5000",
    });

    await appendLedger(tx, {
      data: {
        packagingId: "packaging-1",
        entryType: "IN",
        refType: "PURCHASE_PKG",
        refId: "purchase-3",
        quantityUnit: 100,
        incomingPrice: 5500,
        createdById: "user-1",
      },
    });

    const expectedAvg = (200 * 5000 + 100 * 5500) / (200 + 100);
    expect(tx.packaging.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "packaging-1" },
        data: expect.objectContaining({
          stockUnit: { increment: 100 },
          avgCostPerUnit: expectedAvg,
        }),
      }),
    );
  });

  it("rejects IN entry with incomingPrice for FG (unit-based)", async () => {
    const tx = transaction();
    tx.product.findUnique = vi.fn().mockResolvedValue({
      stockKg: "0",
      stockUnit: 10,
      avgCostPerKg: "0",
    });

    await appendLedger(tx, {
      data: {
        productId: "product-fg-1",
        entryType: "IN",
        refType: "PRODUCTION_FG_IN",
        refId: "batch-1",
        quantityUnit: 50,
        incomingPrice: 15000,
        createdById: "user-1",
      },
    });

    // FG should NOT update avgCostPerKg — only stockUnit
    const updateCall = (tx.product.updateMany as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(updateCall[0].data.stockUnit).toEqual({ increment: 50 });
    expect(updateCall[0].data.avgCostPerKg).toBeUndefined();
  });
});

describe("appendFefoLedgerOut", () => {
  it("allocates from the earliest expiry first and closes exhausted lots", async () => {
    const tx = transaction();
    tx.lot.findMany.mockResolvedValue([
      {
        id: "lot-early",
        batchCode: "LOT-EARLY",
        expiryDate: new Date("2026-08-01"),
        quantityKg: 5,
        quantityUnit: 0,
        inventoryLedgers: [{ entryType: "IN", quantityKg: 5, quantityUnit: null }],
      },
      {
        id: "lot-later",
        batchCode: "LOT-LATER",
        expiryDate: new Date("2026-12-01"),
        quantityKg: 10,
        quantityUnit: 0,
        inventoryLedgers: [{ entryType: "IN", quantityKg: 10, quantityUnit: null }],
      },
    ]);

    await appendFefoLedgerOut(tx, {
      tenantId: "tenant-1",
      productId: "green-bean-1",
      quantityKg: 8,
      refType: "ROASTING_GB_OUT",
      refId: "roast-1",
      createdById: "user-1",
    });

    expect(tx.inventoryLedger.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ lotId: "lot-early", quantityKg: 5 }),
    });
    expect(tx.inventoryLedger.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ lotId: "lot-later", quantityKg: 3 }),
    });
    expect(tx.lot.update).toHaveBeenCalledWith({
      where: { id: "lot-early" },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it("uses an untracked fallback for legacy stock without lots", async () => {
    const tx = transaction();

    await appendFefoLedgerOut(tx, {
      tenantId: "tenant-1",
      productId: "finished-good-1",
      quantityUnit: 4,
      refType: "SALE_FG_OUT",
      refId: "invoice-1",
      createdById: "user-1",
    });

    expect(tx.inventoryLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lotId: null,
        productId: "finished-good-1",
        quantityUnit: 4,
      }),
    });
  });

  it("allocates from lots beyond the 20-batch cap without falling back to untracked", async () => {
    const tx = transaction();
    const lots = Array.from({ length: 25 }, (_, i) => ({
      id: `lot-${i}`,
      batchCode: `LOT-${String(i).padStart(2, "0")}`,
      expiryDate: new Date(Date.UTC(2026, 7 + i, 1)),
      quantityKg: 5,
      quantityUnit: 0,
      inventoryLedgers: [{ entryType: "IN", quantityKg: 5, quantityUnit: null }],
    }));
    tx.lot.findMany.mockImplementation(({ take } = {}) => Promise.resolve(take ? lots.slice(0, take) : lots));

    await appendFefoLedgerOut(tx, {
      tenantId: "tenant-1",
      productId: "green-bean-1",
      quantityKg: 103,
      refType: "ROASTING_GB_OUT",
      refId: "roast-1",
      createdById: "user-1",
    });

    const createCalls = (tx.inventoryLedger.create as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0].data,
    );
    expect(createCalls).toHaveLength(21);
    expect(createCalls.some((entry) => entry.lotId === null)).toBe(false);
    expect(createCalls[19]).toMatchObject({ lotId: "lot-19", quantityKg: 5 });
    expect(createCalls[20]).toMatchObject({ lotId: "lot-20", quantityKg: 3 });
    expect(tx.lot.update).toHaveBeenCalledTimes(20);
    expect(tx.lot.update).toHaveBeenCalledWith({
      where: { id: "lot-19" },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it("allocates the full 20-batch cap plus beyond in strict FEFO order", async () => {
    const tx = transaction();
    const lots = Array.from({ length: 25 }, (_, i) => ({
      id: `lot-${i}`,
      batchCode: `LOT-${String(i).padStart(2, "0")}`,
      expiryDate: new Date(Date.UTC(2026, 7 + i, 1)),
      quantityKg: 5,
      quantityUnit: 0,
      inventoryLedgers: [{ entryType: "IN", quantityKg: 5, quantityUnit: null }],
    }));
    tx.lot.findMany.mockImplementation(({ take } = {}) => Promise.resolve(take ? lots.slice(0, take) : lots));

    await appendFefoLedgerOut(tx, {
      tenantId: "tenant-1",
      productId: "green-bean-1",
      quantityKg: 125,
      refType: "ROASTING_GB_OUT",
      refId: "roast-2",
      createdById: "user-1",
    });

    const createCalls = (tx.inventoryLedger.create as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0].data,
    );
    expect(createCalls).toHaveLength(25);
    expect(createCalls.map((entry) => entry.lotId)).toEqual(
      Array.from({ length: 25 }, (_, i) => `lot-${i}`),
    );
    expect(createCalls.some((entry) => entry.lotId === null)).toBe(false);
    expect(tx.lot.update).toHaveBeenCalledTimes(25);
  });
});
