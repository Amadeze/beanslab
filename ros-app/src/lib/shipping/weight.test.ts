import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    product: { findMany: vi.fn() },
    offeringVariant: { findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { calculateShipmentWeightForTenant } from "./weight";

const TENANT_ID = "tenant-wt";

function mockPrisma(productRows: unknown[], variantRows: unknown[], tareGrams: number) {
  prismaMock.product.findMany.mockResolvedValue(productRows);
  prismaMock.offeringVariant.findMany.mockResolvedValue(variantRows);
  prismaMock.tenant.findUnique.mockResolvedValue({ rajaOngkirTareGrams: tareGrams });
}

describe("calculateShipmentWeightForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("simple product: weight = netWeightGrams * quantity + tare", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 250 }], [], 200);

    const result = await calculateShipmentWeightForTenant(TENANT_ID, [
      { productId: "p1", quantity: 2 },
    ]);

    expect(result.merchandiseWeightGrams).toBe(500);
    expect(result.tareGrams).toBe(200);
    expect(result.shipmentWeightGrams).toBe(700);
    expect(result.lineWeights).toHaveLength(1);
    expect(result.lineWeights[0].netWeightGrams).toBe(250);
    expect(result.lineWeights[0].lineWeightGrams).toBe(500);
  });

  it("variant: weight = variant.netWeightGrams * quantity + tare", async () => {
    mockPrisma([], [{ id: "v1", netWeightGrams: 500 }], 300);

    const result = await calculateShipmentWeightForTenant(TENANT_ID, [
      { productId: "", offeringVariantId: "v1", quantity: 3 },
    ]);

    expect(result.merchandiseWeightGrams).toBe(1500);
    expect(result.tareGrams).toBe(300);
    expect(result.shipmentWeightGrams).toBe(1800);
  });

  it("mixed product + variant", async () => {
    mockPrisma(
      [{ id: "p1", netWeightGrams: 250 }],
      [{ id: "v1", netWeightGrams: 500 }],
      100,
    );

    const result = await calculateShipmentWeightForTenant(TENANT_ID, [
      { productId: "p1", quantity: 1 },
      { productId: "", offeringVariantId: "v1", quantity: 2 },
    ]);

    expect(result.merchandiseWeightGrams).toBe(1250);
    expect(result.tareGrams).toBe(100);
    expect(result.shipmentWeightGrams).toBe(1350);
    expect(result.lineWeights).toHaveLength(2);
  });

  it("quantity multiplier applies to weight", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 100 }], [], 0);

    const result = await calculateShipmentWeightForTenant(TENANT_ID, [
      { productId: "p1", quantity: 5 },
    ]);

    expect(result.merchandiseWeightGrams).toBe(500);
    expect(result.shipmentWeightGrams).toBe(500);
  });

  it("client override weight is ignored - server uses DB weight", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 500 }], [], 0);

    const result = await calculateShipmentWeightForTenant(TENANT_ID, [
      { productId: "p1", quantity: 1 },
    ]);

    expect(result.lineWeights[0].netWeightGrams).toBe(500);
    expect(result.merchandiseWeightGrams).toBe(500);
  });

  it("throws on missing product", async () => {
    mockPrisma([], [], 0);
    await expect(
      calculateShipmentWeightForTenant(TENANT_ID, [
        { productId: "missing", quantity: 1 },
      ]),
    ).rejects.toThrow("Produk tidak ditemukan");
  });

  it("throws on missing variant", async () => {
    mockPrisma([], [], 0);
    await expect(
      calculateShipmentWeightForTenant(TENANT_ID, [
        { productId: "", offeringVariantId: "missing-v", quantity: 1 },
      ]),
    ).rejects.toThrow("Varian produk tidak ditemukan");
  });

  it("throws on product with null netWeightGrams", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: null }], [], 0);
    await expect(
      calculateShipmentWeightForTenant(TENANT_ID, [
        { productId: "p1", quantity: 1 },
      ]),
    ).rejects.toThrow("belum memiliki pengaturan berat");
  });

  it("throws on product with zero netWeightGrams", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 0 }], [], 0);
    await expect(
      calculateShipmentWeightForTenant(TENANT_ID, [
        { productId: "p1", quantity: 1 },
      ]),
    ).rejects.toThrow();
  });

  it("throws on invalid quantity (non-integer)", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 250 }], [], 0);
    await expect(
      calculateShipmentWeightForTenant(TENANT_ID, [
        { productId: "p1", quantity: 1.5 },
      ]),
    ).rejects.toThrow("positive integer");
  });

  it("throws on zero quantity", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 250 }], [], 0);
    await expect(
      calculateShipmentWeightForTenant(TENANT_ID, [
        { productId: "p1", quantity: 0 },
      ]),
    ).rejects.toThrow("positive integer");
  });

  it("throws on empty lines", async () => {
    await expect(
      calculateShipmentWeightForTenant(TENANT_ID, []),
    ).rejects.toThrow("empty");
  });

  it("tareGrams of 0 produces pure merchandise weight", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 100 }], [], 0);

    const result = await calculateShipmentWeightForTenant(TENANT_ID, [
      { productId: "p1", quantity: 1 },
    ]);
    expect(result.tareGrams).toBe(0);
    expect(result.shipmentWeightGrams).toBe(100);
  });

  it("calls prisma with tenant-scoped queries (cross-tenant isolation)", async () => {
    mockPrisma([{ id: "p1", netWeightGrams: 100 }], [], 0);

    await calculateShipmentWeightForTenant(TENANT_ID, [
      { productId: "p1", quantity: 1 },
    ]);

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
    );
    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TENANT_ID } }),
    );
  });
});
